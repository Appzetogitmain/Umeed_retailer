import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let isFirebaseInitialized = false;

try {
    let serviceAccount: any;

    // 1. Try config file from path (Priority)
    const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountPath = envPath
        ? path.resolve(process.cwd(), envPath)
        : path.resolve(__dirname, '../../config/firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
        try {
            serviceAccount = require(serviceAccountPath);
            console.log('Firebase Admin initialized with service account file:', serviceAccountPath);
        } catch (err) {
            console.warn('Failed to parse service account file:', err);
        }
    }

    // 2. Fallback to Environment Variable
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT environment variable');
        } catch (err) {
            console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', err);
        }
    }

    // 3. Initialize if credentials found
    if (serviceAccount) {
        if (admin.apps.length === 0) {
            try {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                isFirebaseInitialized = true;
                console.log('✅ Firebase Admin SDK initialized successfully');
            } catch (initErr) {
                console.error('❌ Failed to initialize admin SDK:', initErr);
            }
        } else {
            isFirebaseInitialized = true;
        }
    } else {
        console.warn('⚠️ Firebase service account not found. Push notifications are disabled.');
    }

} catch (error) {
    console.error('CRITICAL: Error during Firebase initialization logic:', error);
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: { [key: string]: string };
}

/**
 * Send push notification to multiple tokens
 */
export async function sendPushNotification(tokens: string[], payload: PushNotificationPayload) {
    if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

    if (!isFirebaseInitialized) {
        console.warn(`[${new Date().toISOString()}] Firebase not initialized. Cannot send to ${tokens.length} tokens.`);
        return { successCount: 0, failureCount: tokens.length };
    }

    try {
        const isOrder = !!(payload.data?.orderId || payload.data?.type === 'ORDER_NEW' || payload.data?.type === 'ORDER_DELIVERED' || payload.data?.type === 'Order');
        const targetLink = payload.data?.url || payload.data?.link || (isOrder ? '/delivery/dashboard' : '/notifications');

        const message: any = {
            // Deliberately data-only (no top-level/webpush `notification` field).
            // When a `notification` field is present, the browser's own push
            // stack decides whether to auto-display it or hand off to the page/SW,
            // and that decision is inconsistent for a backgrounded-but-not-closed
            // tab (sometimes goes to foreground onMessage, sometimes nowhere).
            // Data-only messages are always routed deterministically: to the page's
            // onMessage() if a tab is visible, otherwise to the service worker's
            // onBackgroundMessage() — covering "backgrounded" and "closed" the same way.
            data: {
                ...(payload.data || {}),
                title: payload.title,
                body: payload.body,
            },
            tokens: tokens,
            webpush: {
                headers: {
                    Urgency: 'high',
                },
                fcmOptions: {
                    link: targetLink,
                },
            },
            // Mobile Specifics (Android)
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'kosil_notifications',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
            // Mobile Specifics (iOS)
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true,
                    },
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[${new Date().toISOString()}] FCM Send to ${tokens.length} tokens: ${response.successCount} success, ${response.failureCount} failure`);

        return response;
    } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
    }
}
