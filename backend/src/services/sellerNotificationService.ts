import { Server as SocketIOServer } from 'socket.io';
import OrderItem from '../models/OrderItem';
import mongoose from 'mongoose';
import { sendNotification } from './notificationService';
import { sendNotificationToSeller } from '../utils/pushNotificationHelper';

export interface SellerNotificationState {
    orderId: string;
    sellerId: string;
    notification: any;
}

// Pending NEW_ORDER notifications awaiting a seller's Accept/Reject, so a
// reconnecting socket (tab reopened, backgrounded-then-foregrounded, page
// reload) can have the popup replayed instead of the seller losing track of
// an order that's still sitting unresolved. Mirrors orderNotificationService.ts's
// notificationStates for delivery pickups, keyed the same way: `${orderId}-${sellerId}`.
export const sellerNotificationStates = new Map<string, SellerNotificationState>();

const stateKey = (orderId: string, sellerId: string) => `${orderId}-${sellerId}`;

export function getPendingSellerNotifications(sellerId: string): any[] {
    const normalizedSellerId = String(sellerId).trim();
    const result: any[] = [];
    for (const state of sellerNotificationStates.values()) {
        if (state.sellerId === normalizedSellerId) {
            result.push(state.notification);
        }
    }
    return result;
}

export function clearSellerNotificationState(orderId: string, sellerId: string): void {
    sellerNotificationStates.delete(stateKey(orderId, String(sellerId)));
}

/**
 * Build the same seller-scoped notification payload shape emitted as
 * 'seller-notification', from an order document plus that seller's items.
 * Shared by the live emit path and the on-demand snapshot endpoint (used to
 * reconstruct a popup that was lost client-side) so the two never drift apart.
 */
export function buildSellerNotificationData(
    order: any,
    sellerId: string,
    sellerSpecificItems: any[],
    type: 'NEW_ORDER' | 'STATUS_UPDATE' | 'ORDER_CANCELLED' = 'NEW_ORDER'
) {
    return {
        type,
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        customer: {
            name: order.customerName,
            email: order.customerEmail,
            phone: order.customerPhone,
            address: order.deliveryAddress
        },
        items: sellerSpecificItems.map((item: any) => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.unitPrice,
            total: item.total,
            variation: item.variation
        })),
        totalAmount: sellerSpecificItems.reduce((acc: number, item: any) => acc + item.total, 0),
        timestamp: new Date()
    };
}

/**
 * Notify all sellers involved in an order about a new order or status change
 */
export async function notifySellersOfOrderUpdate(
    io: SocketIOServer,
    order: any,
    type: 'NEW_ORDER' | 'STATUS_UPDATE' | 'ORDER_CANCELLED'
): Promise<void> {
    try {
        if (!io) {
            console.error('Socket.io server not provided to notifySellersOfOrderUpdate');
            return;
        }

        // Get all unique seller IDs from order items
        // If items are populated, we can get them directly, otherwise we need to query
        let orderItems = order.items;

        // If items are just IDs, fetch the full OrderItem details to get seller IDs
        if (orderItems.length > 0 && typeof orderItems[0] === 'string' || orderItems[0] instanceof mongoose.Types.ObjectId) {
            orderItems = await OrderItem.find({ order: order._id });
        }

        const sellerIds = [...new Set<string>(orderItems.map((item: any) => item.seller.toString()))];

        console.log(`🔔 Notifying ${sellerIds.length} sellers about ${type} for order ${order.orderNumber}`);

        for (const sellerId of sellerIds) {
            // Get only items belonging to this seller
            const sellerSpecificItems = orderItems.filter((item: any) => item.seller.toString() === sellerId);

            const notificationData = buildSellerNotificationData(order, sellerId, sellerSpecificItems, type);

            // Emit to seller-specific room
            io.to(`seller-${sellerId}`).emit('seller-notification', notificationData);
            console.log(`📤 Emitted notification to seller-${sellerId}`);

            if (type === 'NEW_ORDER') {
                sellerNotificationStates.set(stateKey(order._id.toString(), sellerId), {
                    orderId: order._id.toString(),
                    sellerId,
                    notification: notificationData,
                });
            } else if (type === 'ORDER_CANCELLED') {
                // The order was pulled out from under the seller before they acted on
                // it (e.g. an admin/system cancellation) - don't let a stale "new
                // order" popup get replayed to them on their next reconnect.
                clearSellerNotificationState(order._id.toString(), sellerId);
            }

            // Also save notification in the database for history

            try {
                let title = "New Order Received";
                let message = `You have received a new order #${order.orderNumber} for ₹${notificationData.totalAmount.toFixed(2)}.`;
                let notifType: "Order" | "System" = "Order";

                if (type === 'STATUS_UPDATE') {
                    title = "Order Status Updated";
                    message = `Order #${order.orderNumber} status has been updated to ${order.status}.`;
                } else if (type === 'ORDER_CANCELLED') {
                    title = "Order Cancelled";
                    message = `Order #${order.orderNumber} has been cancelled.`;
                    notifType = "System";
                }

                await sendNotification(
                    "Seller",
                    sellerId,
                    title,
                    message,
                    {
                        type: notifType,
                        link: `/seller/orders/${order._id}`,
                        priority: "High"
                    }
                );
                console.log(`💾 Saved notification for seller-${sellerId} to DB`);

                // Send FCM Push Notification (works outside app / background)
                await sendNotificationToSeller(sellerId, {
                    title,
                    body: message,
                    data: {
                        type: type,
                        orderId: order._id.toString(),
                        orderNumber: order.orderNumber,
                        url: `/seller/orders/${order._id}`
                    }
                }).catch(pushErr => console.error(`❌ FCM Push notification to seller failed:`, pushErr));

            } catch (dbErr) {
                console.error(`❌ Failed to save seller notification to DB:`, dbErr);
            }
        }
    } catch (error) {
        console.error('Error in notifySellersOfOrderUpdate:', error);
    }
}
