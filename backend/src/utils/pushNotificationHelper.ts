import Customer from '../models/Customer';
import Notification from '../models/Notification';
import { sendPushNotification, PushNotificationPayload } from '../services/firebaseAdmin';

/**
 * Send notification to a specific user
 * @param userId - The ID of the user to send to
 * @param payload - Notification payload
 * @param includeMobile - Whether to include mobile tokens (default true)
 */
export async function sendNotificationToUser(userId: string, payload: PushNotificationPayload, includeMobile: boolean = true) {
    try {
        const user = await Customer.findById(userId);
        if (!user) {
            console.warn(`User not found for notification: ${userId}`);
            return;
        }

        let tokens: string[] = [];

        // Add Web Tokens
        if (user.notificationPreferences?.push !== false && user.fcmTokens && user.fcmTokens.length > 0) {
            tokens = [...tokens, ...user.fcmTokens];
        }

        // Add Mobile Tokens
        if (includeMobile && user.notificationPreferences?.push !== false && user.fcmTokenMobile && user.fcmTokenMobile.length > 0) {
            tokens = [...tokens, ...user.fcmTokenMobile];
        }

        // Remove duplicates
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            return; // No tokens to send to
        }

        console.log(`Sending notification to user ${userId} (${uniqueTokens.length} tokens)`);
        await sendPushNotification(uniqueTokens, payload);
    } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        // Non-blocking error
    }
}

/**
 * Send notification to a specific delivery boy
 * @param deliveryBoyId - The ID of the delivery boy to send to
 * @param payload - Notification payload
 * @param includeMobile - Whether to include mobile tokens (default true)
 */
export async function sendNotificationToDeliveryBoy(deliveryBoyId: string, payload: PushNotificationPayload, includeMobile: boolean = true) {
    try {
        const Delivery = (await import('../models/Delivery')).default;
        const deliveryBoy = await Delivery.findById(deliveryBoyId);
        
        if (!deliveryBoy) {
            console.warn(`Delivery boy not found for notification: ${deliveryBoyId}`);
            return;
        }

        let tokens: string[] = [];

        // Add Web Tokens
        const notificationsEnabled = deliveryBoy.settings?.notifications ?? true;
        if (notificationsEnabled && deliveryBoy.fcmTokens && deliveryBoy.fcmTokens.length > 0) {
            tokens = [...tokens, ...deliveryBoy.fcmTokens];
        }

        // Add Mobile Tokens
        if (includeMobile && notificationsEnabled && deliveryBoy.fcmTokenMobile && deliveryBoy.fcmTokenMobile.length > 0) {
            tokens = [...tokens, ...deliveryBoy.fcmTokenMobile];
        }

        // Remove duplicates
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            return; // No tokens to send to
        }

        console.log(`Sending notification to delivery boy ${deliveryBoyId} (${uniqueTokens.length} tokens)`);
        await sendPushNotification(uniqueTokens, payload);
    } catch (error) {
        console.error(`Error sending notification to delivery boy ${deliveryBoyId}:`, error);
        // Non-blocking error
    }
}

/**
 * Send notification to a specific seller
 * @param sellerId - The ID of the seller to send to
 * @param payload - Notification payload
 * @param includeMobile - Whether to include mobile tokens (default true)
 */
export async function sendNotificationToSeller(sellerId: string, payload: PushNotificationPayload, includeMobile: boolean = true) {
    try {
        const Seller = (await import('../models/Seller')).default;
        const seller = await Seller.findById(sellerId);
        
        if (!seller) {
            console.warn(`Seller not found for notification: ${sellerId}`);
            return;
        }

        let tokens: string[] = [];

        // Add Web Tokens
        if (seller.fcmTokens && seller.fcmTokens.length > 0) {
            tokens = [...tokens, ...seller.fcmTokens];
        }

        // Add Mobile Tokens
        if (includeMobile && seller.fcmTokenMobile && seller.fcmTokenMobile.length > 0) {
            tokens = [...tokens, ...seller.fcmTokenMobile];
        }

        // Remove duplicates
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            return; // No tokens to send to
        }

        console.log(`Sending notification to seller ${sellerId} (${uniqueTokens.length} tokens)`);
        await sendPushNotification(uniqueTokens, payload);
    } catch (error) {
        console.error(`Error sending notification to seller ${sellerId}:`, error);
    }
}

/**
 * Notify customer that their order has been delivered
 * @param order - The order object
 */
export async function notifyCustomerOfDelivery(order: any) {
    try {
        const customerId = order.customer.toString();
        
        // Create in-app notification
        await Notification.create({
            recipientType: 'Customer',
            recipientId: customerId,
            title: 'Order Delivered',
            message: 'Enjoy your order!',
            type: 'Order',
            link: '/notifications'
        });

        // Send push notification
        const payload: PushNotificationPayload = {
            title: 'Order Delivered',
            body: 'Enjoy your order!',
            data: {
                type: 'ORDER_DELIVERED',
                orderId: order._id.toString()
            }
        };

        await sendNotificationToUser(customerId, payload);
    } catch (error) {
        console.error('Error notifying customer of delivery:', error);
    }
}

/**
 * Send a bulk notification based on the notification object's recipientType.
 * Supports chunking for large numbers of tokens.
 */
export async function sendBulkNotificationToRole(notification: any) {
    try {
        let tokens: string[] = [];
        const { recipientType, recipientId } = notification;

        // If recipientType is Admin or specific recipientId is provided, fallback to individual helper or skip
        if (recipientId) {
            if (recipientType === 'Customer') await sendNotificationToUser(recipientId.toString(), { title: notification.title, body: notification.message });
            else if (recipientType === 'Delivery') await sendNotificationToDeliveryBoy(recipientId.toString(), { title: notification.title, body: notification.message });
            else if (recipientType === 'Seller') await sendNotificationToSeller(recipientId.toString(), { title: notification.title, body: notification.message });
            return { successCount: 1, failureCount: 0 };
        }

        // Fetch tokens based on type
        if (recipientType === 'Customer' || recipientType === 'All') {
            const customers = await Customer.find({ 
                $or: [
                    { fcmTokens: { $exists: true, $not: { $size: 0 } } }, 
                    { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }
                ]
            }).select('fcmTokens fcmTokenMobile notificationPreferences');

            customers.forEach(user => {
                if (user.notificationPreferences?.push !== false) {
                    if (Array.isArray(user.fcmTokens)) tokens.push(...user.fcmTokens);
                    if (Array.isArray(user.fcmTokenMobile)) tokens.push(...user.fcmTokenMobile);
                }
            });
        }

        if (recipientType === 'Seller' || recipientType === 'All') {
            const Seller = (await import('../models/Seller')).default;
            const sellers = await Seller.find({ 
                $or: [
                    { fcmTokens: { $exists: true, $not: { $size: 0 } } }, 
                    { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }
                ]
            }).select('fcmTokens fcmTokenMobile');

            sellers.forEach(user => {
                if (Array.isArray(user.fcmTokens)) tokens.push(...user.fcmTokens);
                if (Array.isArray(user.fcmTokenMobile)) tokens.push(...user.fcmTokenMobile);
            });
        }

        if (recipientType === 'Delivery' || recipientType === 'All') {
            const Delivery = (await import('../models/Delivery')).default;
            const deliveryBoys = await Delivery.find({ 
                $or: [
                    { fcmTokens: { $exists: true, $not: { $size: 0 } } }, 
                    { fcmTokenMobile: { $exists: true, $not: { $size: 0 } } }
                ]
            }).select('fcmTokens fcmTokenMobile settings');

            deliveryBoys.forEach(user => {
                if ((user as any).settings?.notifications !== false) {
                    if (Array.isArray(user.fcmTokens)) tokens.push(...user.fcmTokens);
                    if (Array.isArray(user.fcmTokenMobile)) tokens.push(...user.fcmTokenMobile);
                }
            });
        }

        // Deduplicate tokens
        tokens = [...new Set(tokens)];

        if (tokens.length === 0) {
            return { successCount: 0, failureCount: 0 };
        }

        const payload: PushNotificationPayload = {
            title: notification.title,
            body: notification.message,
            data: {
                type: notification.type || 'Info',
                url: notification.link || ''
            }
        };

        // Chunk tokens in batches of 500
        const CHUNK_SIZE = 500;
        let totalSuccess = 0;
        let totalFailure = 0;

        for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
            const chunk = tokens.slice(i, i + CHUNK_SIZE);
            const response = await sendPushNotification(chunk, payload);
            totalSuccess += response?.successCount || 0;
            totalFailure += response?.failureCount || 0;
        }

        return { successCount: totalSuccess, failureCount: totalFailure };
    } catch (error) {
        console.error('Error sending bulk notification:', error);
        throw error;
    }
}
