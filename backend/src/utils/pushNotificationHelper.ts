import Customer from '../models/Customer';
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
        if (deliveryBoy.settings?.notifications !== false && deliveryBoy.fcmTokens && deliveryBoy.fcmTokens.length > 0) {
            tokens = [...tokens, ...deliveryBoy.fcmTokens];
        }

        // Add Mobile Tokens
        if (includeMobile && deliveryBoy.settings?.notifications !== false && deliveryBoy.fcmTokenMobile && deliveryBoy.fcmTokenMobile.length > 0) {
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
