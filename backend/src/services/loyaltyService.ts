import mongoose, { ClientSession } from "mongoose";
import AppSettings, { ILoyaltyConfig } from "../models/AppSettings";
import Customer from "../models/Customer";
import LoyaltyTransaction, { LoyaltyTxnType } from "../models/LoyaltyTransaction";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";

/**
 * Loyalty coins engine.
 *
 * Invariants (checked by reconcileLoyalty):
 *   1. Customer.loyaltyCoins === Σ CREDIT coins − Σ DEBIT coins in the ledger
 *   2. Customer.loyaltyCoins === Σ remainingCoins of that customer's credit lots
 *
 * Every mutation writes its ledger row FIRST. The row's unique idempotencyKey
 * acts as a lock, so retries / double clicks / concurrent requests can never
 * apply the same action twice, even without Mongo transactions.
 */

export const DEFAULT_LOYALTY_CONFIG: ILoyaltyConfig = {
  enabled: true,
  earnEnabled: true,
  redeemEnabled: true,
  coinsPerRupee: 10,
  maxRedeemPercent: 10,
  minRedeemCoins: 0,
  expiryEnabled: false,
  expiryDays: 365,
  orderDiscountsEnabled: true,
  orderDiscounts: [
    { orderNumber: 1, percent: 5, maxDiscount: 0, minOrderValue: 0 },
    { orderNumber: 2, percent: 10, maxDiscount: 0, minOrderValue: 0 },
  ],
};

const FAR_FUTURE = new Date("9999-12-31T00:00:00.000Z");

const STAT_FIELD: Record<LoyaltyTxnType, string> = {
  EARN: "loyaltyStats.totalEarned",
  REDEEM: "loyaltyStats.totalRedeemed",
  EXPIRE: "loyaltyStats.totalExpired",
  ADMIN_CREDIT: "loyaltyStats.totalAdminCredited",
  ADMIN_DEBIT: "loyaltyStats.totalAdminDebited",
  EARN_REVERSAL: "loyaltyStats.totalReversed",
  REDEEM_RELEASE: "loyaltyStats.totalReleased",
};

export class LoyaltyError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Config & maths helpers
// ---------------------------------------------------------------------------

export const getLoyaltyConfig = async (): Promise<ILoyaltyConfig> => {
  const settings: any = await AppSettings.getSettings();
  const raw = settings?.loyaltyConfig?.toObject ? settings.loyaltyConfig.toObject() : settings?.loyaltyConfig || {};
  const cfg: ILoyaltyConfig = { ...DEFAULT_LOYALTY_CONFIG, ...raw };
  cfg.coinsPerRupee = Math.max(1, Math.floor(Number(cfg.coinsPerRupee) || DEFAULT_LOYALTY_CONFIG.coinsPerRupee));
  cfg.maxRedeemPercent = Math.min(100, Math.max(0, Number(cfg.maxRedeemPercent) || 0));
  cfg.minRedeemCoins = Math.max(0, Math.floor(Number(cfg.minRedeemCoins) || 0));
  cfg.expiryDays = Math.max(1, Math.floor(Number(cfg.expiryDays) || DEFAULT_LOYALTY_CONFIG.expiryDays));
  cfg.orderDiscounts = Array.isArray(cfg.orderDiscounts) ? cfg.orderDiscounts : [];
  return cfg;
};

export const toPaise = (rupees: number): number => Math.round((Number(rupees) || 0) * 100);
export const fromPaise = (paise: number): number => Math.round(paise) / 100;

export const coinsToRupees = (coins: number, coinsPerRupee: number): number =>
  Math.round((coins / coinsPerRupee) * 100) / 100;

/**
 * Coins a single order line earns.
 *  fixed   -> value coins per unit
 *  percent -> value % of the line amount, converted to coins at coinsPerRupee
 */
export const computeLineEarnCoins = (
  type: string | undefined,
  value: number | undefined,
  lineTotalPaise: number,
  quantity: number,
  coinsPerRupee: number
): number => {
  const v = Number(value) || 0;
  if (!type || type === "none" || v <= 0) return 0;
  if (type === "fixed") return Math.floor(v * quantity + 1e-9);
  if (type === "percent") return Math.floor((lineTotalPaise * v * coinsPerRupee) / 10000 + 1e-9);
  return 0;
};

/**
 * Split an integer amount across weights so the parts are integers that sum
 * EXACTLY to the amount (largest-remainder method). Used for paise allocation.
 */
export const allocateProportionally = (amount: number, weights: number[]): number[] => {
  const result = weights.map(() => 0);
  const totalWeight = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (amount <= 0 || totalWeight <= 0) return result;
  const raw = weights.map((w) => (Math.max(0, w) * amount) / totalWeight);
  let allocated = 0;
  raw.forEach((r, i) => {
    result[i] = Math.floor(r);
    allocated += result[i];
  });
  let remainder = amount - allocated;
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), w: weights[i] }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.frac - a.frac || b.w - a.w);
  for (let k = 0; remainder > 0 && order.length > 0; k = (k + 1) % order.length) {
    result[order[k].i] += 1;
    remainder -= 1;
  }
  return result;
};

const isDuplicateKeyError = (err: any) => err && (err.code === 11000 || err.code === 11001);

const runInTransaction = async <T>(
  fn: (session: ClientSession | null) => Promise<T>,
  external?: ClientSession | null
): Promise<T> => {
  if (external) return fn(external);
  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    session = null;
  }
  try {
    const result = await fn(session);
    if (session) await session.commitTransaction();
    return result;
  } catch (err) {
    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }
};

const opts = (session?: ClientSession | null) => (session ? { session } : {});

const alreadyApplied = async (key: string | undefined, session?: ClientSession | null) =>
  !!key && !!(await LoyaltyTransaction.exists({ idempotencyKey: key }).session(session || null));

// ---------------------------------------------------------------------------
// Low level ledger primitives
// ---------------------------------------------------------------------------

interface CreditParams {
  customerId: string;
  type: Extract<LoyaltyTxnType, "EARN" | "ADMIN_CREDIT" | "REDEEM_RELEASE">;
  coins: number;
  coinsPerRupee: number;
  idempotencyKey?: string;
  order?: any;
  orderNumber?: string;
  orderItem?: any;
  items?: any[];
  createLot: boolean;
  expiresAt?: Date | null;
  note?: string;
  actorType?: "SYSTEM" | "ADMIN" | "CUSTOMER";
  actorId?: string;
  session?: ClientSession | null;
}

/** Returns the ledger row, or null when this idempotencyKey was already applied. */
const applyCredit = async (p: CreditParams) => {
  const coins = Math.floor(p.coins);
  if (coins <= 0) return null;
  // Check first: inside a transaction a duplicate-key error would abort the whole transaction
  if (await alreadyApplied(p.idempotencyKey, p.session)) return null;

  let row: any;
  try {
    [row] = await LoyaltyTransaction.create(
      [
        {
          customer: p.customerId,
          type: p.type,
          direction: "CREDIT",
          coins,
          coinsPerRupee: p.coinsPerRupee,
          rupeeValue: coinsToRupees(coins, p.coinsPerRupee),
          balanceBefore: 0,
          balanceAfter: 0,
          order: p.order,
          orderNumber: p.orderNumber,
          orderItem: p.orderItem,
          items: p.items,
          remainingCoins: p.createLot ? coins : 0,
          expiresAt: p.createLot ? p.expiresAt || null : null,
          lotSortKey: p.createLot ? p.expiresAt || FAR_FUTURE : undefined,
          idempotencyKey: p.idempotencyKey,
          note: p.note,
          actorType: p.actorType || "SYSTEM",
          actorId: p.actorId,
        },
      ],
      opts(p.session)
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) return null;
    throw err;
  }

  const customer = await Customer.findOneAndUpdate(
    { _id: p.customerId },
    { $inc: { loyaltyCoins: coins, [STAT_FIELD[p.type]]: coins } },
    { new: true, ...opts(p.session) }
  );
  if (!customer) {
    await LoyaltyTransaction.deleteOne({ _id: row._id }, opts(p.session));
    throw new LoyaltyError("Customer not found", 404);
  }

  row.balanceAfter = customer.loyaltyCoins;
  row.balanceBefore = customer.loyaltyCoins - coins;
  await row.save(opts(p.session));
  return row;
};

/**
 * Take `coins` out of the customer's lots: preferred lots first, then the lot
 * that expires soonest (FIFO by expiry, then by age).
 */
const consumeLots = async (
  customerId: string,
  coins: number,
  session?: ClientSession | null,
  preferLotIds: string[] = []
) => {
  const consumed: Array<{ lot: any; coins: number }> = [];
  let need = coins;

  const takeFrom = async (lot: any) => {
    while (need > 0) {
      const fresh: any = await LoyaltyTransaction.findById(lot._id, null, opts(session));
      const available = fresh?.remainingCoins || 0;
      if (available <= 0) return;
      const take = Math.min(available, need);
      const updated = await LoyaltyTransaction.findOneAndUpdate(
        { _id: lot._id, remainingCoins: { $gte: take } },
        { $inc: { remainingCoins: -take } },
        { new: true, ...opts(session) }
      );
      if (updated) {
        consumed.push({ lot: lot._id, coins: take });
        need -= take;
        return;
      }
      // Someone else touched this lot concurrently; re-read and retry
    }
  };

  for (const id of preferLotIds) {
    if (need <= 0) break;
    await takeFrom({ _id: id });
  }

  while (need > 0) {
    const lots = await LoyaltyTransaction.find(
      { customer: customerId, direction: "CREDIT", remainingCoins: { $gt: 0 } },
      null,
      opts(session)
    )
      .sort({ lotSortKey: 1, createdAt: 1 })
      .limit(20);
    if (lots.length === 0) break;
    for (const lot of lots) {
      if (need <= 0) break;
      await takeFrom(lot);
    }
  }

  return { consumed, shortfall: need };
};

interface DebitParams {
  customerId: string;
  type: Extract<LoyaltyTxnType, "REDEEM" | "ADMIN_DEBIT" | "EARN_REVERSAL">;
  coins: number;
  coinsPerRupee: number;
  idempotencyKey?: string;
  allowPartial?: boolean; // debit min(coins, balance) instead of failing
  preferLotIds?: string[];
  order?: any;
  orderNumber?: string;
  orderItem?: any;
  note?: string;
  actorType?: "SYSTEM" | "ADMIN" | "CUSTOMER";
  actorId?: string;
  session?: ClientSession | null;
}

const applyDebit = async (p: DebitParams) => {
  let coins = Math.floor(p.coins);
  if (coins <= 0) return null;
  if (await alreadyApplied(p.idempotencyKey, p.session)) return null;

  if (p.allowPartial) {
    const current: any = await Customer.findById(p.customerId, "loyaltyCoins", opts(p.session));
    if (!current) throw new LoyaltyError("Customer not found", 404);
    coins = Math.min(coins, current.loyaltyCoins || 0);
    if (coins <= 0) return null;
  }

  let row: any;
  try {
    [row] = await LoyaltyTransaction.create(
      [
        {
          customer: p.customerId,
          type: p.type,
          direction: "DEBIT",
          coins,
          coinsPerRupee: p.coinsPerRupee,
          rupeeValue: coinsToRupees(coins, p.coinsPerRupee),
          balanceBefore: 0,
          balanceAfter: 0,
          order: p.order,
          orderNumber: p.orderNumber,
          orderItem: p.orderItem,
          idempotencyKey: p.idempotencyKey,
          note: p.note,
          actorType: p.actorType || "SYSTEM",
          actorId: p.actorId,
        },
      ],
      opts(p.session)
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) return null;
    throw err;
  }

  const customer = await Customer.findOneAndUpdate(
    { _id: p.customerId, loyaltyCoins: { $gte: coins } },
    { $inc: { loyaltyCoins: -coins, [STAT_FIELD[p.type]]: coins } },
    { new: true, ...opts(p.session) }
  );
  if (!customer) {
    await LoyaltyTransaction.deleteOne({ _id: row._id }, opts(p.session));
    throw new LoyaltyError("Insufficient loyalty coin balance");
  }

  const { consumed, shortfall } = await consumeLots(p.customerId, coins, p.session, p.preferLotIds);
  row.lotsConsumed = consumed;
  row.balanceAfter = customer.loyaltyCoins;
  row.balanceBefore = customer.loyaltyCoins + coins;
  if (shortfall > 0) {
    row.note = `${row.note ? row.note + " | " : ""}Lot shortfall ${shortfall} (run reconcile)`;
    console.warn(`[Loyalty] Lot shortfall of ${shortfall} coins for customer ${p.customerId} (${p.type})`);
  }
  await row.save(opts(p.session));
  return row;
};

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/** Expire every lot whose expiry date has passed (optionally for one customer). */
export const expireDueLots = async (customerId?: string): Promise<{ lots: number; coins: number }> => {
  const cfg = await getLoyaltyConfig();
  if (!cfg.expiryEnabled) return { lots: 0, coins: 0 };

  const query: any = {
    direction: "CREDIT",
    remainingCoins: { $gt: 0 },
    expiresAt: { $ne: null, $lte: new Date() },
  };
  if (customerId) query.customer = customerId;

  let lots = 0;
  let total = 0;
  const due = await LoyaltyTransaction.find(query).limit(500);
  for (const lot of due) {
    try {
      const expiredCoins = await runInTransaction(async (session) => {
        const fresh: any = await LoyaltyTransaction.findById(lot._id, null, opts(session));
        const coins = fresh?.remainingCoins || 0;
        if (coins <= 0) return 0;
        // Conditional zeroing: if a redemption touched this lot meanwhile, skip this round
        const zeroed = await LoyaltyTransaction.findOneAndUpdate(
          { _id: lot._id, remainingCoins: coins },
          { $set: { remainingCoins: 0, expired: true } },
          opts(session)
        );
        if (!zeroed) return 0;

        const customer = await Customer.findOneAndUpdate(
          { _id: lot.customer, loyaltyCoins: { $gte: coins } },
          { $inc: { loyaltyCoins: -coins, [STAT_FIELD.EXPIRE]: coins } },
          { new: true, ...opts(session) }
        );
        if (!customer) throw new Error(`Balance below lot remainder for customer ${lot.customer}`);

        await LoyaltyTransaction.create(
          [
            {
              customer: lot.customer,
              type: "EXPIRE",
              direction: "DEBIT",
              coins,
              coinsPerRupee: lot.coinsPerRupee,
              rupeeValue: coinsToRupees(coins, lot.coinsPerRupee),
              balanceBefore: customer.loyaltyCoins + coins,
              balanceAfter: customer.loyaltyCoins,
              order: lot.order,
              orderNumber: lot.orderNumber,
              lotsConsumed: [{ lot: lot._id, coins }],
              note: `Coins expired (credited ${new Date(lot.createdAt).toISOString().slice(0, 10)})`,
              actorType: "SYSTEM",
            },
          ],
          opts(session)
        );
        return coins;
      });
      if (expiredCoins > 0) {
        lots += 1;
        total += expiredCoins;
      }
    } catch (err) {
      console.error(`[Loyalty] Failed to expire lot ${lot._id}:`, err);
    }
  }
  if (lots > 0) console.log(`[Loyalty] Expired ${total} coins across ${lots} lots`);
  return { lots, coins: total };
};

let expiryTimer: NodeJS.Timeout | null = null;
export const startLoyaltyExpiryScheduler = (intervalMs = 60 * 60 * 1000) => {
  if (expiryTimer) return;
  const tick = () => expireDueLots().catch((e) => console.error("[Loyalty] Expiry job failed:", e));
  setTimeout(tick, 30 * 1000);
  expiryTimer = setInterval(tick, intervalMs);
};

// ---------------------------------------------------------------------------
// Order lifecycle hooks
// ---------------------------------------------------------------------------

/** Spend coins on an order at checkout. Throws if the balance is insufficient. */
export const redeemCoinsForOrder = async (params: {
  customerId: string;
  coins: number;
  coinsPerRupee: number;
  orderId: any;
  orderNumber: string;
  session?: ClientSession | null;
}) => {
  return applyDebit({
    customerId: params.customerId,
    type: "REDEEM",
    coins: params.coins,
    coinsPerRupee: params.coinsPerRupee,
    idempotencyKey: `REDEEM:${params.orderId}`,
    order: params.orderId,
    orderNumber: params.orderNumber,
    note: `Redeemed on order ${params.orderNumber}`,
    actorType: "CUSTOMER",
    actorId: params.customerId,
    session: params.session,
  });
};

/**
 * Give back coins redeemed on an order that was never actually placed
 * (online payment not completed). Placed orders keep coins forfeited,
 * as coins are non-refundable once an order is confirmed.
 */
export const releaseRedeemedCoinsForOrder = async (orderId: string, reason: string, session?: ClientSession | null) => {
  return runInTransaction(async (s) => {
    const redeemRow: any = await LoyaltyTransaction.findOne({ idempotencyKey: `REDEEM:${orderId}` }, null, opts(s));
    if (!redeemRow) return null;

    const row = await applyCredit({
      customerId: redeemRow.customer.toString(),
      type: "REDEEM_RELEASE",
      coins: redeemRow.coins,
      coinsPerRupee: redeemRow.coinsPerRupee,
      idempotencyKey: `RELEASE:${orderId}`,
      order: redeemRow.order,
      orderNumber: redeemRow.orderNumber,
      createLot: false,
      note: reason,
      actorType: "SYSTEM",
      session: s,
    });
    if (!row) return null; // already released

    // Put the coins back into the exact lots they came from
    for (const part of redeemRow.lotsConsumed || []) {
      await LoyaltyTransaction.updateOne({ _id: part.lot }, { $inc: { remainingCoins: part.coins } }, opts(s));
    }
    row.lotsConsumed = redeemRow.lotsConsumed;
    await row.save(opts(s));

    await Order.updateOne({ _id: orderId }, { $set: { loyaltyRedeemStatus: "Released" } }, opts(s));
    return row;
  }, session);
};

/** Mark redeemed coins as forfeited (order cancelled after it was placed). */
export const markRedeemForfeited = async (orderId: string, session?: ClientSession | null) => {
  await Order.updateOne(
    { _id: orderId, loyaltyRedeemStatus: "Redeemed" },
    { $set: { loyaltyRedeemStatus: "Forfeited" } },
    opts(session)
  );
  await Order.updateOne(
    { _id: orderId, loyaltyEarnStatus: "Pending" },
    { $set: { loyaltyEarnStatus: "Forfeited" } },
    opts(session)
  );
};

/**
 * Credit the coins an order earns. Called when the order reaches Delivered.
 * Only items that were actually delivered count (rejected sellers /
 * cancelled or returned items are excluded). Idempotent per order.
 */
export const creditEarnedCoinsForOrder = async (orderId: string) => {
  try {
    const cfg = await getLoyaltyConfig();
    const order: any = await Order.findById(orderId);
    if (!order || order.status !== "Delivered") return null;
    if (order.loyaltyEarnStatus === "Credited") return null;
    if (order.source === "POS") return null;

    const excludedSellers = new Set(
      (order.sellerAcceptances || [])
        .filter((sa: any) => ["Rejected", "Cancelled"].includes(sa.status))
        .map((sa: any) => sa.seller.toString())
    );
    const items: any[] = await OrderItem.find({ order: orderId });
    const eligible = items.filter(
      (it) =>
        (it.loyaltyCoins || 0) > 0 &&
        !["Cancelled", "Returned"].includes(it.status) &&
        !excludedSellers.has(it.seller.toString())
    );
    const coins = eligible.reduce((s, it) => s + (it.loyaltyCoins || 0), 0);

    if (coins <= 0) {
      if (order.loyaltyEarnStatus === "Pending") {
        await Order.updateOne({ _id: orderId }, { $set: { loyaltyEarnStatus: "None", loyaltyCoinsEarned: 0 } });
      }
      return null;
    }

    const expiresAt = cfg.expiryEnabled ? new Date(Date.now() + cfg.expiryDays * 24 * 60 * 60 * 1000) : null;

    const row = await runInTransaction(async (session) => {
      const r = await applyCredit({
        customerId: order.customer.toString(),
        type: "EARN",
        coins,
        coinsPerRupee: order.loyaltyCoinsPerRupee || cfg.coinsPerRupee,
        idempotencyKey: `EARN:${orderId}`,
        order: order._id,
        orderNumber: order.orderNumber,
        items: eligible.map((it) => ({
          product: it.product,
          productName: it.productName,
          seller: it.seller,
          quantity: it.quantity,
          coins: it.loyaltyCoins,
        })),
        createLot: true,
        expiresAt,
        note: `Earned on order ${order.orderNumber}`,
        actorType: "SYSTEM",
        session,
      });
      if (r) {
        await Order.updateOne(
          { _id: orderId },
          { $set: { loyaltyEarnStatus: "Credited", loyaltyCoinsEarned: coins } },
          opts(session)
        );
      }
      return r;
    });
    if (row) console.log(`[Loyalty] Credited ${coins} coins for order ${order.orderNumber}`);
    return row;
  } catch (err) {
    // Never let loyalty break the delivery flow; the call is idempotent and can be retried
    console.error(`[Loyalty] Failed to credit coins for order ${orderId}:`, err);
    return null;
  }
};

/** Take back coins earned by an order item that was returned & refunded. */
export const reverseEarnedCoinsForItem = async (orderItemId: string, actorId?: string) => {
  try {
    const item: any = await OrderItem.findById(orderItemId);
    if (!item || !(item.loyaltyCoins > 0)) return null;
    const earnRow: any = await LoyaltyTransaction.findOne({ idempotencyKey: `EARN:${item.order}` });
    if (!earnRow) return null; // coins were never credited for this order
    const credited = (earnRow.items || []).find((i: any) => i.product?.toString() === item.product.toString());
    const coins = Math.min(item.loyaltyCoins, credited?.coins ?? item.loyaltyCoins);

    return await runInTransaction((session) =>
      applyDebit({
        customerId: earnRow.customer.toString(),
        type: "EARN_REVERSAL",
        coins,
        coinsPerRupee: earnRow.coinsPerRupee,
        idempotencyKey: `EARN_REVERSAL:${orderItemId}`,
        allowPartial: true, // never push a balance negative; shortfall is visible in the note
        preferLotIds: [earnRow._id.toString()],
        order: earnRow.order,
        orderNumber: earnRow.orderNumber,
        orderItem: item._id,
        note: `Returned: ${item.productName}`,
        actorType: actorId ? "ADMIN" : "SYSTEM",
        actorId,
        session,
      })
    );
  } catch (err) {
    console.error(`[Loyalty] Failed to reverse coins for order item ${orderItemId}:`, err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

export const adminAdjustCoins = async (params: {
  customerId: string;
  direction: "CREDIT" | "DEBIT";
  coins: number;
  note: string;
  adminId?: string;
  requestId?: string;
}) => {
  const coins = Math.floor(Number(params.coins));
  if (!Number.isFinite(coins) || coins <= 0) throw new LoyaltyError("Coins must be a positive whole number");
  if (!params.note || !params.note.trim()) throw new LoyaltyError("A reason is required for manual adjustments");
  const cfg = await getLoyaltyConfig();
  const key = params.requestId ? `ADMIN:${params.requestId}` : undefined;

  return runInTransaction(async (session) => {
    if (params.direction === "CREDIT") {
      const expiresAt = cfg.expiryEnabled ? new Date(Date.now() + cfg.expiryDays * 24 * 60 * 60 * 1000) : null;
      return applyCredit({
        customerId: params.customerId,
        type: "ADMIN_CREDIT",
        coins,
        coinsPerRupee: cfg.coinsPerRupee,
        idempotencyKey: key,
        createLot: true,
        expiresAt,
        note: params.note.trim(),
        actorType: "ADMIN",
        actorId: params.adminId,
        session,
      });
    }
    return applyDebit({
      customerId: params.customerId,
      type: "ADMIN_DEBIT",
      coins,
      coinsPerRupee: cfg.coinsPerRupee,
      idempotencyKey: key,
      note: params.note.trim(),
      actorType: "ADMIN",
      actorId: params.adminId,
      session,
    });
  });
};

/** Customer-facing summary: balance, value, expiring soon, lifetime stats. */
export const getCustomerLoyaltySummary = async (customerId: string) => {
  await expireDueLots(customerId);
  const cfg = await getLoyaltyConfig();
  const customer: any = await Customer.findById(customerId, "loyaltyCoins loyaltyStats");
  if (!customer) throw new LoyaltyError("Customer not found", 404);

  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiring = await LoyaltyTransaction.aggregate([
    {
      $match: {
        customer: new mongoose.Types.ObjectId(customerId),
        direction: "CREDIT",
        remainingCoins: { $gt: 0 },
        expiresAt: { $ne: null, $lte: soon },
      },
    },
    { $group: { _id: null, coins: { $sum: "$remainingCoins" }, nextExpiry: { $min: "$expiresAt" } } },
  ]);

  const balance = customer.loyaltyCoins || 0;
  return {
    balance,
    balanceValue: coinsToRupees(balance, cfg.coinsPerRupee),
    coinsPerRupee: cfg.coinsPerRupee,
    maxRedeemPercent: cfg.maxRedeemPercent,
    minRedeemCoins: cfg.minRedeemCoins,
    enabled: cfg.enabled,
    redeemEnabled: cfg.enabled && cfg.redeemEnabled,
    earnEnabled: cfg.enabled && cfg.earnEnabled,
    expiryEnabled: cfg.expiryEnabled,
    expiryDays: cfg.expiryDays,
    expiringSoon: {
      coins: expiring[0]?.coins || 0,
      nextExpiry: expiring[0]?.nextExpiry || null,
    },
    stats: customer.loyaltyStats || {},
  };
};

/**
 * Audit balances against the ledger. With fix=true, Customer.loyaltyCoins is
 * reset to the ledger-derived balance (the ledger is the source of truth).
 */
export const reconcileLoyalty = async (options: { customerId?: string; fix?: boolean } = {}) => {
  const match: any = {};
  if (options.customerId) match.customer = new mongoose.Types.ObjectId(options.customerId);

  const ledger = await LoyaltyTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$customer",
        credits: { $sum: { $cond: [{ $eq: ["$direction", "CREDIT"] }, "$coins", 0] } },
        debits: { $sum: { $cond: [{ $eq: ["$direction", "DEBIT"] }, "$coins", 0] } },
        lotRemaining: {
          $sum: { $cond: [{ $eq: ["$direction", "CREDIT"] }, { $ifNull: ["$remainingCoins", 0] }, 0] },
        },
      },
    },
  ]);

  const ledgerMap = new Map<string, any>(ledger.map((l: any) => [l._id.toString(), l]));
  const customerQuery: any = options.customerId
    ? { _id: options.customerId }
    : { $or: [{ loyaltyCoins: { $ne: 0 } }, { _id: { $in: ledger.map((l: any) => l._id) } }] };
  const customers: any[] = await Customer.find(customerQuery, "name phone loyaltyCoins");

  const mismatches: any[] = [];
  for (const c of customers) {
    const l = ledgerMap.get(c._id.toString()) || { credits: 0, debits: 0, lotRemaining: 0 };
    const ledgerBalance = l.credits - l.debits;
    const stored = c.loyaltyCoins || 0;
    if (ledgerBalance !== stored || l.lotRemaining !== ledgerBalance) {
      mismatches.push({
        customerId: c._id,
        name: c.name,
        phone: c.phone,
        storedBalance: stored,
        ledgerBalance,
        lotRemaining: l.lotRemaining,
      });
      if (options.fix && ledgerBalance >= 0 && ledgerBalance !== stored) {
        await Customer.updateOne({ _id: c._id }, { $set: { loyaltyCoins: ledgerBalance } });
      }
    }
  }

  return { checked: customers.length, mismatches, fixed: !!options.fix };
};
