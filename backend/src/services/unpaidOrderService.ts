import mongoose, { ClientSession } from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import { releaseRedeemedCoinsForOrder } from "./loyaltyService";
import { releaseCouponUsage } from "./checkoutPricingService";

/**
 * Online orders are created before payment (status "Pending", hidden from
 * sellers). Until payment is verified the order is NOT placed, so if the
 * payment fails or is abandoned we undo everything reserved for it:
 * stock, loyalty coins (REDEEM_RELEASE in the ledger) and the coupon use.
 *
 * Placed orders (COD, or online once paid) are never handled here: customers
 * cannot cancel them and coins redeemed on them are non-refundable.
 */

export const UNPAID_ONLINE_FILTER = {
  paymentMethod: "Online",
  status: "Pending",
  paymentStatus: { $ne: "Paid" },
};

export const isUnpaidOnlineOrder = (order: any) =>
  !!order && order.paymentMethod === "Online" && order.status === "Pending" && order.paymentStatus !== "Paid";

const restoreStock = async (orderItem: any, session: ClientSession | null) => {
  const product: any = await Product.findById(orderItem.product).session(session);
  if (!product) return;
  if (orderItem.variation && product.variations?.length) {
    const idx = product.variations.findIndex(
      (v: any) =>
        (v._id && v._id.toString() === orderItem.variation) ||
        v.value === orderItem.variation ||
        v.title === orderItem.variation ||
        v.pack === orderItem.variation
    );
    product.variations[idx >= 0 ? idx : 0].stock += orderItem.quantity;
  }
  product.stock += orderItem.quantity;
  await product.save(session ? { session } : {});
};

/**
 * Abort an online order whose payment never completed. Atomic claim on the
 * order (status Pending + not Paid) so it can't race with payment capture,
 * and safe to call more than once. Returns the cancelled order or null.
 */
export const abortUnpaidOnlineOrder = async (orderId: string, reason: string, cancelledBy?: string) => {
  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    session = null;
  }

  try {
    const order: any = await Order.findOneAndUpdate(
      { _id: orderId, ...UNPAID_ONLINE_FILTER },
      {
        $set: {
          status: "Cancelled",
          paymentStatus: "Failed",
          cancellationReason: reason,
          cancelledAt: new Date(),
          ...(cancelledBy ? { cancelledBy: new mongoose.Types.ObjectId(cancelledBy) } : {}),
        },
      },
      { new: true, ...(session ? { session } : {}) }
    );
    if (!order) {
      if (session) await session.abortTransaction();
      return null; // already paid, already aborted, or not an online order
    }

    const items: any[] = await OrderItem.find({ order: order._id }).session(session);
    for (const item of items) {
      if (item.status === "Cancelled") continue;
      await restoreStock(item, session);
      item.status = "Cancelled";
      await item.save(session ? { session } : {});
    }

    if (order.loyaltyEarnStatus === "Pending") {
      order.loyaltyEarnStatus = "Forfeited";
      await order.save(session ? { session } : {});
    }

    // Coins were reserved for an order that was never placed -> give them back
    await releaseRedeemedCoinsForOrder(order._id.toString(), `Payment not completed for order ${order.orderNumber}`, session);
    await releaseCouponUsage(order._id.toString(), session);

    if (session) await session.commitTransaction();
    console.log(`[UnpaidOrder] Aborted ${order.orderNumber}: ${reason}`);
    return order;
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

/**
 * Abort online orders that have been waiting for payment longer than
 * `maxAgeMinutes` (customer closed the app, payment never finished, etc.).
 */
export const abortStaleUnpaidOrders = async (maxAgeMinutes = 30) => {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await Order.find({ ...UNPAID_ONLINE_FILTER, createdAt: { $lte: cutoff } }, "_id").limit(200);
  let aborted = 0;
  for (const o of stale) {
    try {
      if (await abortUnpaidOnlineOrder(o._id.toString(), "Payment not completed in time")) aborted++;
    } catch (err) {
      console.error(`[UnpaidOrder] Failed to abort stale order ${o._id}:`, err);
    }
  }
  return aborted;
};

let sweepTimer: NodeJS.Timeout | null = null;
export const startUnpaidOrderSweeper = (intervalMs = 10 * 60 * 1000) => {
  if (sweepTimer) return;
  const tick = () => abortStaleUnpaidOrders().catch((e) => console.error("[UnpaidOrder] Sweep failed:", e));
  setTimeout(tick, 60 * 1000);
  sweepTimer = setInterval(tick, intervalMs);
};
