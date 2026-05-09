import { Server as SocketIOServer } from 'socket.io';
import OrderItem from '../models/OrderItem';
import mongoose from 'mongoose';
import { sendNotification } from './notificationService';

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

            const notificationData = {
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

            // Emit to seller-specific room
            io.to(`seller-${sellerId}`).emit('seller-notification', notificationData);
            console.log(`📤 Emitted notification to seller-${sellerId}`);

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
            } catch (dbErr) {
                console.error(`❌ Failed to save seller notification to DB:`, dbErr);
            }
        }
    } catch (error) {
        console.error('Error in notifySellersOfOrderUpdate:', error);
    }
}
