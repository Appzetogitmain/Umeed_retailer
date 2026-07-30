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
        // @ts-ignore - Fields will be added to model shortly
        if (user.notificationPreferences?.push !== false && user.fcmTokens && user.fcmTokens.length > 0) {
            // @ts-ignore
            tokens = [...tokens, ...user.fcmTokens];
        }

        // Add Mobile Tokens
        // @ts-ignore
        if (includeMobile && user.notificationPreferences?.push !== false && user.fcmTokenMobile && user.fcmTokenMobile.length > 0) {
            // @ts-ignore
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
