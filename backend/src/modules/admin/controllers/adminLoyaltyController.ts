import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import AppSettings from "../../../models/AppSettings";
import Customer from "../../../models/Customer";
import LoyaltyTransaction from "../../../models/LoyaltyTransaction";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import {
  adminAdjustCoins,
  coinsToRupees,
  computeLineEarnCoins,
  expireDueLots,
  getCustomerLoyaltySummary,
  getLoyaltyConfig,
  reconcileLoyalty,
  toPaise,
} from "../../../services/loyaltyService";
import { resolveItemUnitPrice } from "../../../utils/pricing";

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageParams = (req: Request, maxLimit = 100) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

// Orders that were actually placed (excludes cancelled/rejected and unpaid online attempts)
const PLACED_ORDER_MATCH = {
  status: { $nin: ["Cancelled", "Rejected"] },
  paymentStatus: { $ne: "Failed" },
  $nor: [{ paymentMethod: "Online", paymentStatus: { $ne: "Paid" }, status: "Pending" }],
};

// ==================== Settings ====================

export const getLoyaltySettings = asyncHandler(async (_req: Request, res: Response) => {
  const config = await getLoyaltyConfig();
  return res.status(200).json({ success: true, data: config });
});

export const updateLoyaltySettings = asyncHandler(async (req: Request, res: Response) => {
  const current = await getLoyaltyConfig();
  const body = req.body || {};
  const next: any = { ...current };
  const errors: string[] = [];

  for (const key of ["enabled", "earnEnabled", "redeemEnabled", "expiryEnabled", "orderDiscountsEnabled"]) {
    if (body[key] !== undefined) next[key] = !!body[key];
  }

  if (body.coinsPerRupee !== undefined) {
    const v = Number(body.coinsPerRupee);
    if (!Number.isInteger(v) || v < 1) errors.push("Coins per ₹1 must be a whole number of at least 1");
    else next.coinsPerRupee = v;
  }
  if (body.maxRedeemPercent !== undefined) {
    const v = Number(body.maxRedeemPercent);
    if (!Number.isFinite(v) || v < 0 || v > 100) errors.push("Max redeem % must be between 0 and 100");
    else next.maxRedeemPercent = v;
  }
  if (body.minRedeemCoins !== undefined) {
    const v = Number(body.minRedeemCoins);
    if (!Number.isInteger(v) || v < 0) errors.push("Minimum coins to redeem must be a whole number (0 or more)");
    else next.minRedeemCoins = v;
  }
  if (body.expiryDays !== undefined) {
    const v = Number(body.expiryDays);
    if (!Number.isInteger(v) || v < 1) errors.push("Expiry days must be a whole number of at least 1");
    else next.expiryDays = v;
  }
  if (body.orderDiscounts !== undefined) {
    if (!Array.isArray(body.orderDiscounts)) {
      errors.push("Order discounts must be a list");
    } else {
      const seen = new Set<number>();
      const tiers = body.orderDiscounts.map((t: any) => ({
        orderNumber: Number(t.orderNumber),
        percent: Number(t.percent),
        maxDiscount: Number(t.maxDiscount) || 0,
        minOrderValue: Number(t.minOrderValue) || 0,
      }));
      for (const t of tiers) {
        if (!Number.isInteger(t.orderNumber) || t.orderNumber < 1) errors.push("Order number must be 1 or more");
        else if (seen.has(t.orderNumber)) errors.push(`Order #${t.orderNumber} is listed twice`);
        seen.add(t.orderNumber);
        if (!Number.isFinite(t.percent) || t.percent < 0 || t.percent > 100) errors.push(`Order #${t.orderNumber}: discount % must be 0-100`);
        if (t.maxDiscount < 0 || t.minOrderValue < 0) errors.push(`Order #${t.orderNumber}: amounts cannot be negative`);
      }
      next.orderDiscounts = tiers.sort((a: any, b: any) => a.orderNumber - b.orderNumber);
    }
  }

  if (errors.length) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  const settings: any = await AppSettings.getSettings();
  settings.loyaltyConfig = next;
  settings.updatedBy = req.user?.userId;
  await settings.save();

  console.log(`[Loyalty] Settings updated by admin ${req.user?.userId}`);
  return res.status(200).json({ success: true, message: "Loyalty settings saved", data: await getLoyaltyConfig() });
});

// ==================== Overview ====================

export const getLoyaltyOverview = asyncHandler(async (_req: Request, res: Response) => {
  const cfg = await getLoyaltyConfig();
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [byType, balances, pendingEarn, discounts, expiring, productsWithCoins] = await Promise.all([
    LoyaltyTransaction.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 }, coins: { $sum: "$coins" }, value: { $sum: "$rupeeValue" } } },
    ]),
    Customer.aggregate([
      { $match: { loyaltyCoins: { $gt: 0 } } },
      { $group: { _id: null, coins: { $sum: "$loyaltyCoins" }, customers: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { loyaltyEarnStatus: "Pending", ...PLACED_ORDER_MATCH } },
      { $group: { _id: null, coins: { $sum: "$loyaltyCoinsToEarn" }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...PLACED_ORDER_MATCH, source: { $ne: "POS" } } },
      {
        $group: {
          _id: null,
          orderSequenceDiscount: { $sum: { $ifNull: ["$orderSequenceDiscount", 0] } },
          couponDiscount: { $sum: { $ifNull: ["$couponDiscount", 0] } },
          loyaltyDiscount: { $sum: { $ifNull: ["$loyaltyDiscount", 0] } },
          firstOrderDiscounts: {
            $sum: { $cond: [{ $and: [{ $eq: ["$orderSequenceNumber", 1] }, { $gt: ["$orderSequenceDiscount", 0] }] }, 1, 0] },
          },
          secondOrderDiscounts: {
            $sum: { $cond: [{ $and: [{ $eq: ["$orderSequenceNumber", 2] }, { $gt: ["$orderSequenceDiscount", 0] }] }, 1, 0] },
          },
          couponOrders: { $sum: { $cond: [{ $gt: ["$couponDiscount", 0] }, 1, 0] } },
          coinOrders: { $sum: { $cond: [{ $gt: ["$loyaltyCoinsRedeemed", 0] }, 1, 0] } },
        },
      },
    ]),
    LoyaltyTransaction.aggregate([
      { $match: { direction: "CREDIT", remainingCoins: { $gt: 0 }, expiresAt: { $ne: null, $lte: soon } } },
      { $group: { _id: null, coins: { $sum: "$remainingCoins" } } },
    ]),
    Product.countDocuments({ loyaltyCoinType: { $in: ["fixed", "percent"] }, loyaltyCoinValue: { $gt: 0 } }),
  ]);

  const typeMap: Record<string, { count: number; coins: number; value: number }> = {};
  for (const t of byType) typeMap[t._id] = { count: t.count, coins: t.coins, value: Math.round(t.value * 100) / 100 };
  const outstanding = balances[0]?.coins || 0;
  const d = discounts[0] || {};
  const round2 = (v: number) => Math.round((v || 0) * 100) / 100;

  return res.status(200).json({
    success: true,
    data: {
      config: cfg,
      ledger: typeMap,
      outstandingCoins: outstanding,
      outstandingValue: coinsToRupees(outstanding, cfg.coinsPerRupee),
      customersWithCoins: balances[0]?.customers || 0,
      pendingEarnCoins: pendingEarn[0]?.coins || 0,
      pendingEarnOrders: pendingEarn[0]?.orders || 0,
      expiringIn30Days: expiring[0]?.coins || 0,
      productsWithCoins,
      discounts: {
        orderSequence: round2(d.orderSequenceDiscount),
        coupon: round2(d.couponDiscount),
        loyalty: round2(d.loyaltyDiscount),
        total: round2((d.orderSequenceDiscount || 0) + (d.couponDiscount || 0) + (d.loyaltyDiscount || 0)),
        firstOrderCount: d.firstOrderDiscounts || 0,
        secondOrderCount: d.secondOrderDiscounts || 0,
        couponOrders: d.couponOrders || 0,
        coinOrders: d.coinOrders || 0,
      },
    },
  });
});

// ==================== Ledger ====================

export const getLoyaltyTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = pageParams(req, 1000);
  const query: any = {};
  const { type, direction, search, orderNumber, from, to, customerId } = req.query as Record<string, string>;

  if (type) query.type = { $in: type.split(",") };
  if (direction === "CREDIT" || direction === "DEBIT") query.direction = direction;
  if (orderNumber) query.orderNumber = { $regex: escapeRegex(orderNumber.trim()), $options: "i" };
  if (customerId && mongoose.isValidObjectId(customerId)) query.customer = customerId;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    const customers = await Customer.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }, "_id").limit(200);
    query.customer = { $in: customers.map((c: any) => c._id) };
  }

  const [rows, total, sums] = await Promise.all([
    LoyaltyTransaction.find(query)
      .populate("customer", "name phone email")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LoyaltyTransaction.countDocuments(query),
    LoyaltyTransaction.aggregate([
      // aggregate() does not cast, so a plain string customer id must become an ObjectId
      { $match: typeof query.customer === "string" ? { ...query, customer: new mongoose.Types.ObjectId(query.customer) } : query },
      { $group: { _id: "$direction", coins: { $sum: "$coins" }, value: { $sum: "$rupeeValue" } } },
    ]),
  ]);

  const totals = { creditCoins: 0, debitCoins: 0, creditValue: 0, debitValue: 0 };
  for (const s of sums) {
    if (s._id === "CREDIT") {
      totals.creditCoins = s.coins;
      totals.creditValue = Math.round(s.value * 100) / 100;
    } else {
      totals.debitCoins = s.coins;
      totals.debitValue = Math.round(s.value * 100) / 100;
    }
  }

  return res.status(200).json({
    success: true,
    data: rows,
    totals,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ==================== Customers ====================

export const getLoyaltyCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = pageParams(req);
  const { search, sort, onlyWithCoins } = req.query as Record<string, string>;
  const query: any = { isDeleted: { $ne: true } };
  if (onlyWithCoins === "true") query.loyaltyCoins = { $gt: 0 };
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    query.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }
  const sortSpec: any =
    sort === "earned"
      ? { "loyaltyStats.totalEarned": -1 }
      : sort === "redeemed"
        ? { "loyaltyStats.totalRedeemed": -1 }
        : sort === "name"
          ? { name: 1 }
          : { loyaltyCoins: -1, _id: 1 };

  const cfg = await getLoyaltyConfig();
  const [rows, total] = await Promise.all([
    Customer.find(query, "name phone email loyaltyCoins loyaltyStats totalOrders createdAt")
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    data: rows.map((c: any) => ({ ...c, loyaltyCoins: c.loyaltyCoins || 0, coinValue: coinsToRupees(c.loyaltyCoins || 0, cfg.coinsPerRupee) })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getLoyaltyCustomerDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid customer id" });
  const customer = await Customer.findById(id, "name phone email loyaltyCoins loyaltyStats");
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  const summary = await getCustomerLoyaltySummary(id);
  const placedOrders = await Order.countDocuments({ customer: id, source: { $ne: "POS" }, ...PLACED_ORDER_MATCH });
  return res.status(200).json({ success: true, data: { customer, summary, placedOrders } });
});

export const adjustCustomerCoins = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { direction, coins, note, requestId } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid customer id" });
  if (direction !== "CREDIT" && direction !== "DEBIT") {
    return res.status(400).json({ success: false, message: "Direction must be CREDIT or DEBIT" });
  }
  try {
    const row = await adminAdjustCoins({
      customerId: id,
      direction,
      coins: Number(coins),
      note: String(note || ""),
      adminId: req.user?.userId,
      requestId: requestId ? String(requestId) : undefined,
    });
    if (!row) {
      return res.status(200).json({ success: true, message: "This adjustment was already applied" });
    }
    console.log(`[Loyalty] Admin ${req.user?.userId} ${direction} ${row.coins} coins for customer ${id}: ${note}`);
    return res.status(200).json({ success: true, message: "Coins updated", data: row });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Failed to adjust coins" });
  }
});

// ==================== Product coins ====================

const validateCoinConfig = (type: any, value: any): { ok: boolean; error?: string; type?: string; value?: number } => {
  if (!["none", "fixed", "percent"].includes(type)) return { ok: false, error: "Coin type must be none, fixed or percent" };
  const v = type === "none" ? 0 : Number(value);
  if (!Number.isFinite(v) || v < 0) return { ok: false, error: "Coin value cannot be negative" };
  if (type === "fixed" && !Number.isInteger(v)) return { ok: false, error: "Fixed coins must be a whole number" };
  if (type === "percent" && v > 100) return { ok: false, error: "Percentage cannot exceed 100" };
  return { ok: true, type: v === 0 ? "none" : type, value: v };
};

export const getLoyaltyProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = pageParams(req);
  const { search, category, seller, coinType } = req.query as Record<string, string>;
  const query: any = {};
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    query.$or = [{ productName: rx }, { sku: rx }];
  }
  if (category && mongoose.isValidObjectId(category)) {
    query.$and = [{ $or: [{ category }, { subcategory: category }, { subSubCategory: category }] }];
  }
  if (seller && mongoose.isValidObjectId(seller)) query.seller = seller;
  if (coinType === "configured") query.loyaltyCoinType = { $in: ["fixed", "percent"] };
  else if (coinType === "none") query.loyaltyCoinType = { $nin: ["fixed", "percent"] };
  else if (coinType === "fixed" || coinType === "percent") query.loyaltyCoinType = coinType;

  const cfg = await getLoyaltyConfig();
  const [rows, total] = await Promise.all([
    Product.find(query, "productName mainImage price discPrice variations sku status seller category loyaltyCoinType loyaltyCoinValue")
      .populate("seller", "storeName sellerName")
      .populate("category", "name")
      .sort({ updatedAt: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  return res.status(200).json({
    success: true,
    data: rows.map((p: any) => {
      const unitPrice = resolveItemUnitPrice(p, p.variations?.[0]);
      const coinsPerUnit = computeLineEarnCoins(p.loyaltyCoinType, p.loyaltyCoinValue, toPaise(unitPrice), 1, cfg.coinsPerRupee);
      return {
        _id: p._id,
        productName: p.productName,
        mainImage: p.mainImage,
        sku: p.sku,
        status: p.status,
        seller: p.seller,
        category: p.category,
        unitPrice,
        loyaltyCoinType: p.loyaltyCoinType || "none",
        loyaltyCoinValue: p.loyaltyCoinValue || 0,
        coinsPerUnit,
        coinsValuePerUnit: coinsToRupees(coinsPerUnit, cfg.coinsPerRupee),
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const updateProductCoins = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid product id" });
  const check = validateCoinConfig(req.body?.loyaltyCoinType, req.body?.loyaltyCoinValue);
  if (!check.ok) return res.status(400).json({ success: false, message: check.error });

  const product = await Product.findByIdAndUpdate(
    id,
    { $set: { loyaltyCoinType: check.type, loyaltyCoinValue: check.value } },
    { new: true, runValidators: true }
  ).select("productName loyaltyCoinType loyaltyCoinValue");
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  console.log(`[Loyalty] Admin ${req.user?.userId} set coins for product ${id}: ${check.type} ${check.value}`);
  return res.status(200).json({ success: true, message: "Product coins updated", data: product });
});

/**
 * Apply one coin rule to many products: either explicit productIds, or every
 * product matching a category and/or seller filter.
 */
export const bulkUpdateProductCoins = asyncHandler(async (req: Request, res: Response) => {
  const { productIds, category, seller, applyToAll, loyaltyCoinType, loyaltyCoinValue, onlyUnconfigured } = req.body || {};
  const check = validateCoinConfig(loyaltyCoinType, loyaltyCoinValue);
  if (!check.ok) return res.status(400).json({ success: false, message: check.error });

  const filter: any = {};
  if (Array.isArray(productIds) && productIds.length > 0) {
    filter._id = { $in: productIds.filter((x: any) => mongoose.isValidObjectId(x)) };
  } else {
    if (category && mongoose.isValidObjectId(category)) {
      filter.$or = [{ category }, { subcategory: category }, { subSubCategory: category }];
    }
    if (seller && mongoose.isValidObjectId(seller)) filter.seller = seller;
    if (!filter.$or && !filter.seller && applyToAll !== true) {
      return res.status(400).json({ success: false, message: "Select products, a category, a seller, or confirm apply to all" });
    }
  }
  if (onlyUnconfigured) filter.loyaltyCoinType = { $nin: ["fixed", "percent"] };

  const result = await Product.updateMany(filter, { $set: { loyaltyCoinType: check.type, loyaltyCoinValue: check.value } });
  console.log(`[Loyalty] Admin ${req.user?.userId} bulk-set coins (${check.type} ${check.value}) on ${result.modifiedCount} products`);
  return res.status(200).json({
    success: true,
    message: `Updated ${result.modifiedCount} product(s)`,
    data: { matched: result.matchedCount, modified: result.modifiedCount },
  });
});

// ==================== Maintenance ====================

export const runLoyaltyExpiry = asyncHandler(async (_req: Request, res: Response) => {
  const cfg = await getLoyaltyConfig();
  if (!cfg.expiryEnabled) {
    return res.status(400).json({ success: false, message: "Coin expiry is turned off in settings" });
  }
  const result = await expireDueLots();
  return res.status(200).json({ success: true, message: `Expired ${result.coins} coins from ${result.lots} credit(s)`, data: result });
});

export const reconcileLoyaltyBalances = asyncHandler(async (req: Request, res: Response) => {
  const fix = req.query.fix === "true" || req.body?.fix === true;
  const result = await reconcileLoyalty({ fix });
  return res.status(200).json({
    success: true,
    message: result.mismatches.length
      ? `${result.mismatches.length} mismatch(es) found${fix ? " and balances corrected from the ledger" : ""}`
      : "All balances match the ledger",
    data: result,
  });
});
