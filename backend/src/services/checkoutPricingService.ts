import { ClientSession } from "mongoose";
import AppSettings from "../models/AppSettings";
import Coupon from "../models/Coupon";
import Customer from "../models/Customer";
import Order from "../models/Order";
import {
  allocateProportionally,
  coinsToRupees,
  computeLineEarnCoins,
  fromPaise,
  getLoyaltyConfig,
  toPaise,
} from "./loyaltyService";

/**
 * Single source of truth for checkout pricing. Used by both the checkout quote
 * endpoint (what the customer sees) and createOrder (what is charged), so the
 * two can never disagree. All arithmetic is done in integer paise.
 *
 *   subtotal (items)
 *   − order-sequence discount (e.g. 5% first order / 10% second order)
 *   − coupon discount
 *   + platform fee + delivery fee
 *   = amount before coins
 *   − loyalty coins (capped at maxRedeemPercent of amount before coins)
 *   = total payable
 *
 * Every discount is funded by the platform; seller payouts stay on item totals.
 */

export interface PricingLineInput {
  product: any; // Product document (needs _id, seller, category ids, loyalty fields)
  unitPrice: number;
  quantity: number;
}

export interface PricingInput {
  customerId: string;
  lines: PricingLineInput[];
  platformFee: number;
  deliveryFee: number;
  couponCode?: string;
  useCoins?: boolean;
  session?: ClientSession | null;
}

export interface PricedLine {
  lineTotal: number;
  discountShare: number;
  loyaltyCoins: number;
}

export interface PricingResult {
  subtotal: number;
  platformFee: number;
  deliveryFee: number;
  orderSequence: {
    orderNumber: number;
    percent: number;
    discount: number;
    applied: boolean;
    message?: string;
  };
  coupon: {
    code?: string;
    couponId?: string;
    discount: number;
    applied: boolean;
    error?: string;
    description?: string;
  };
  loyalty: {
    enabled: boolean;
    balance: number;
    balanceValue: number;
    coinsPerRupee: number;
    maxRedeemPercent: number;
    minRedeemCoins: number;
    maxUsableCoins: number;
    maxUsableDiscount: number;
    coinsUsed: number;
    discount: number;
    applied: boolean;
    message?: string;
  };
  totalDiscount: number;
  amountBeforeCoins: number;
  total: number;
  coinsToEarn: number;
  coinsToEarnValue: number;
  lines: PricedLine[];
  // per seller amount (sums exactly to total) – used for COD split collection
  sellerAmounts: Map<string, number>;
}

const idStr = (v: any): string => (v && v._id ? v._id.toString() : v ? v.toString() : "");

/**
 * Orders that count towards a customer's order sequence: everything except
 * cancelled/rejected orders, POS sales and online orders whose payment never
 * completed.
 */
export const countPlacedOrders = async (customerId: string, session?: ClientSession | null) => {
  return Order.countDocuments({
    customer: customerId,
    source: { $ne: "POS" },
    status: { $nin: ["Cancelled", "Rejected"] },
    paymentStatus: { $ne: "Failed" },
    $nor: [{ paymentMethod: "Online", paymentStatus: { $ne: "Paid" }, status: "Pending" }],
  }).session(session || null);
};

const endOfDay = (d: Date) => {
  const e = new Date(d);
  // Admin picks a date only; treat it as valid through the whole day (IST-safe margin)
  if (e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0) {
    e.setUTCHours(23, 59, 59, 999);
  }
  return e;
};

interface CouponEvalLine {
  lineTotalPaise: number;
  productId: string;
  sellerId: string;
  categoryIds: string[];
}

/**
 * Validate a coupon against the customer and cart lines and compute its
 * discount in paise. Shared by checkout pricing and the coupon validate API.
 */
export const evaluateCoupon = async (params: {
  code: string;
  customerId?: string;
  lines: CouponEvalLine[];
  session?: ClientSession | null;
}): Promise<{ ok: boolean; error?: string; coupon?: any; discountPaise: number; eligible: boolean[] }> => {
  const eligibleNone = params.lines.map(() => false);
  const code = (params.code || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Coupon code is required", discountPaise: 0, eligible: eligibleNone };

  const settings: any = await AppSettings.getSettings();
  if (settings?.features && settings.features.coupons === false) {
    return { ok: false, error: "Coupons are currently disabled", discountPaise: 0, eligible: eligibleNone };
  }

  const coupon: any = await Coupon.findOne({ code, isActive: true }).session(params.session || null);
  if (!coupon) return { ok: false, error: "Invalid coupon code", discountPaise: 0, eligible: eligibleNone };

  const now = new Date();
  if (now < new Date(coupon.startDate)) {
    return { ok: false, error: "Coupon is not active yet", discountPaise: 0, eligible: eligibleNone, coupon };
  }
  if (now > endOfDay(new Date(coupon.endDate))) {
    return { ok: false, error: "Coupon has expired", discountPaise: 0, eligible: eligibleNone, coupon };
  }
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, error: "Coupon usage limit reached", discountPaise: 0, eligible: eligibleNone, coupon };
  }

  if (params.customerId && coupon.usageLimitPerUser) {
    const used = await Order.countDocuments({
      customer: params.customerId,
      coupon: coupon._id,
      status: { $nin: ["Cancelled", "Rejected"] },
      $nor: [{ paymentMethod: "Online", paymentStatus: { $ne: "Paid" }, status: "Pending" }],
    }).session(params.session || null);
    if (used >= coupon.usageLimitPerUser) {
      return { ok: false, error: "You have already used this coupon", discountPaise: 0, eligible: eligibleNone, coupon };
    }
  }

  const subtotalPaise = params.lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  if (coupon.minimumPurchase && subtotalPaise < toPaise(coupon.minimumPurchase)) {
    return {
      ok: false,
      error: `Minimum order value of ₹${coupon.minimumPurchase} required`,
      discountPaise: 0,
      eligible: eligibleNone,
      coupon,
    };
  }

  const ids = new Set((coupon.applicableIds || []).map((x: any) => x.toString()));
  const eligible = params.lines.map((l) => {
    switch (coupon.applicableTo) {
      case "Product":
        return ids.has(l.productId);
      case "Seller":
        return ids.has(l.sellerId);
      case "Category":
        return l.categoryIds.some((c) => ids.has(c));
      default:
        return true;
    }
  });
  const eligiblePaise = params.lines.reduce((s, l, i) => s + (eligible[i] ? l.lineTotalPaise : 0), 0);
  if (eligiblePaise <= 0) {
    return { ok: false, error: "Coupon is not applicable to the items in your cart", discountPaise: 0, eligible, coupon };
  }

  let discountPaise: number;
  if (coupon.discountType === "Percentage") {
    discountPaise = Math.round((eligiblePaise * coupon.discountValue) / 100);
    if (coupon.maximumDiscount && coupon.maximumDiscount > 0) {
      discountPaise = Math.min(discountPaise, toPaise(coupon.maximumDiscount));
    }
  } else {
    discountPaise = toPaise(coupon.discountValue);
  }
  discountPaise = Math.max(0, Math.min(discountPaise, eligiblePaise));

  return { ok: true, coupon, discountPaise, eligible };
};

export const computeCheckoutPricing = async (input: PricingInput): Promise<PricingResult> => {
  const cfg = await getLoyaltyConfig();
  const session = input.session || null;

  const lineTotals = input.lines.map((l) => toPaise(l.unitPrice) * l.quantity);
  const subtotalPaise = lineTotals.reduce((s, v) => s + v, 0);
  const platformFeePaise = Math.max(0, toPaise(input.platformFee));
  const deliveryFeePaise = Math.max(0, toPaise(input.deliveryFee));

  // 1. Order-sequence discount (first order / second order ...)
  const placed = await countPlacedOrders(input.customerId, session);
  const orderNumber = placed + 1;
  let seqPercent = 0;
  let seqPaise = 0;
  let seqMessage: string | undefined;
  if (cfg.enabled && cfg.orderDiscountsEnabled) {
    const tier = cfg.orderDiscounts.find((t) => Number(t.orderNumber) === orderNumber);
    if (tier && tier.percent > 0) {
      if (tier.minOrderValue > 0 && subtotalPaise < toPaise(tier.minOrderValue)) {
        seqMessage = `Add items worth ₹${fromPaise(toPaise(tier.minOrderValue) - subtotalPaise)} more to get ${tier.percent}% off`;
      } else {
        seqPercent = tier.percent;
        seqPaise = Math.round((subtotalPaise * tier.percent) / 100);
        if (tier.maxDiscount > 0) seqPaise = Math.min(seqPaise, toPaise(tier.maxDiscount));
      }
    }
  }

  // 2. Coupon
  const couponLines: CouponEvalLine[] = input.lines.map((l, i) => ({
    lineTotalPaise: lineTotals[i],
    productId: idStr(l.product._id),
    sellerId: idStr(l.product.seller),
    categoryIds: [l.product.category, l.product.subcategory, l.product.subSubCategory].filter(Boolean).map(idStr),
  }));
  let couponPaise = 0;
  let couponEligible = input.lines.map(() => false);
  const coupon: PricingResult["coupon"] = { discount: 0, applied: false };
  if (input.couponCode && input.couponCode.trim()) {
    const res = await evaluateCoupon({ code: input.couponCode, customerId: input.customerId, lines: couponLines, session });
    coupon.code = input.couponCode.trim().toUpperCase();
    if (res.ok) {
      couponPaise = res.discountPaise;
      couponEligible = res.eligible;
      coupon.couponId = res.coupon._id.toString();
      coupon.description = res.coupon.description;
      coupon.applied = true;
    } else {
      coupon.error = res.error;
    }
  }

  // Item-level discounts can never exceed the item subtotal
  if (seqPaise > subtotalPaise) seqPaise = subtotalPaise;
  if (seqPaise + couponPaise > subtotalPaise) couponPaise = subtotalPaise - seqPaise;
  coupon.discount = fromPaise(couponPaise);

  const amountBeforeCoinsPaise = subtotalPaise - seqPaise - couponPaise + platformFeePaise + deliveryFeePaise;

  // 3. Loyalty coins
  const customer: any = await Customer.findById(input.customerId, "loyaltyCoins").session(session);
  const balance = customer?.loyaltyCoins || 0;
  const redeemOn = cfg.enabled && cfg.redeemEnabled;
  let maxRupees = 0;
  let loyaltyMessage: string | undefined;
  if (redeemOn) {
    if (balance < cfg.minRedeemCoins) {
      loyaltyMessage = `Minimum ${cfg.minRedeemCoins} coins needed to redeem`;
    } else {
      const capByOrder = Math.floor((amountBeforeCoinsPaise * cfg.maxRedeemPercent) / 100 / 100); // whole rupees
      const capByBalance = Math.floor(balance / cfg.coinsPerRupee);
      maxRupees = Math.max(0, Math.min(capByOrder, capByBalance));
      if (maxRupees === 0 && balance > 0) {
        loyaltyMessage =
          capByBalance === 0
            ? `You need at least ${cfg.coinsPerRupee} coins to redeem ₹1`
            : `Order amount too low to use coins (max ${cfg.maxRedeemPercent}% of order)`;
      }
    }
  }
  const applyCoins = redeemOn && !!input.useCoins && maxRupees > 0;
  const coinsUsed = applyCoins ? maxRupees * cfg.coinsPerRupee : 0;
  const coinPaise = applyCoins ? maxRupees * 100 : 0;

  const totalPaise = Math.max(0, amountBeforeCoinsPaise - coinPaise);
  const totalDiscountPaise = seqPaise + couponPaise + coinPaise;

  // 4. Allocate each discount over the lines (exact, in paise)
  const seqAlloc = allocateProportionally(seqPaise, lineTotals);
  const couponAlloc = allocateProportionally(
    couponPaise,
    lineTotals.map((v, i) => (couponEligible[i] ? v : 0))
  );
  const coinAlloc = allocateProportionally(coinPaise, lineTotals);

  // 5. Coins earned per line (frozen on the order item)
  const earnOn = cfg.enabled && cfg.earnEnabled;
  const lines: PricedLine[] = input.lines.map((l, i) => ({
    lineTotal: fromPaise(lineTotals[i]),
    discountShare: fromPaise(seqAlloc[i] + couponAlloc[i] + coinAlloc[i]),
    loyaltyCoins: earnOn
      ? computeLineEarnCoins(l.product.loyaltyCoinType, l.product.loyaltyCoinValue, lineTotals[i], l.quantity, cfg.coinsPerRupee)
      : 0,
  }));
  const coinsToEarn = lines.reduce((s, l) => s + l.loyaltyCoins, 0);

  // 6. Per seller amount to collect (sums exactly to the order total)
  const sellerIds: string[] = [];
  const sellerSubtotals: number[] = [];
  input.lines.forEach((l, i) => {
    const sid = idStr(l.product.seller);
    let idx = sellerIds.indexOf(sid);
    if (idx === -1) {
      sellerIds.push(sid);
      sellerSubtotals.push(0);
      idx = sellerIds.length - 1;
    }
    sellerSubtotals[idx] += lineTotals[i];
  });
  const sellerAlloc = allocateProportionally(totalPaise, sellerSubtotals);
  const sellerAmounts = new Map<string, number>();
  sellerIds.forEach((sid, i) => sellerAmounts.set(sid, fromPaise(sellerAlloc[i])));

  return {
    subtotal: fromPaise(subtotalPaise),
    platformFee: fromPaise(platformFeePaise),
    deliveryFee: fromPaise(deliveryFeePaise),
    orderSequence: {
      orderNumber,
      percent: seqPercent,
      discount: fromPaise(seqPaise),
      applied: seqPaise > 0,
      message: seqMessage,
    },
    coupon,
    loyalty: {
      enabled: redeemOn,
      balance,
      balanceValue: coinsToRupees(balance, cfg.coinsPerRupee),
      coinsPerRupee: cfg.coinsPerRupee,
      maxRedeemPercent: cfg.maxRedeemPercent,
      minRedeemCoins: cfg.minRedeemCoins,
      maxUsableCoins: maxRupees * cfg.coinsPerRupee,
      maxUsableDiscount: maxRupees,
      coinsUsed,
      discount: fromPaise(coinPaise),
      applied: applyCoins,
      message: loyaltyMessage,
    },
    totalDiscount: fromPaise(totalDiscountPaise),
    amountBeforeCoins: fromPaise(amountBeforeCoinsPaise),
    total: fromPaise(totalPaise),
    coinsToEarn,
    coinsToEarnValue: coinsToRupees(coinsToEarn, cfg.coinsPerRupee),
    lines,
    sellerAmounts,
  };
};

/** JSON-safe version of the pricing result for API responses. */
export const serializePricing = (p: PricingResult) => {
  const { sellerAmounts, lines, ...rest } = p;
  return rest;
};

/**
 * Give a coupon use back when an order is cancelled. Guarded by a flag on the
 * order so it can only happen once per order.
 */
export const releaseCouponUsage = async (orderId: string, session?: ClientSession | null) => {
  const order: any = await Order.findOneAndUpdate(
    { _id: orderId, coupon: { $ne: null }, couponUsageReleased: { $ne: true } },
    { $set: { couponUsageReleased: true } },
    { new: true, ...(session ? { session } : {}) }
  );
  if (!order?.coupon) return;
  await Coupon.updateOne(
    { _id: order.coupon, usageCount: { $gt: 0 } },
    { $inc: { usageCount: -1 } },
    session ? { session } : {}
  );
};

/** Consume one use of a coupon atomically (respects the global usage limit). */
export const consumeCouponUsage = async (couponId: string, session?: ClientSession | null) => {
  const coupon: any = await Coupon.findById(couponId).session(session || null);
  if (!coupon) throw Object.assign(new Error("Invalid coupon code"), { statusCode: 400 });
  const filter: any = { _id: couponId };
  if (coupon.usageLimit && coupon.usageLimit > 0) filter.usageCount = { $lt: coupon.usageLimit };
  const updated = await Coupon.findOneAndUpdate(filter, { $inc: { usageCount: 1 } }, session ? { session } : {});
  if (!updated) throw Object.assign(new Error("Coupon usage limit reached"), { statusCode: 400 });
};
