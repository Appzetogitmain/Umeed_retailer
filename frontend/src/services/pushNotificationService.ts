import { messaging, getToken, onMessage } from '../firebase';
import api from './api/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "dummy-vapid-key";

// Register service worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Unregister existing workers to ensure fresh update if needed
            // const registrations = await navigator.serviceWorker.getRegistrations();
            // for(let registration of registrations) {
            //     registration.unregister();
            // }

            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
            console.log('✅ Service Worker registered:', registration);
            return registration;
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
            // Don't throw to avoid crashing app on non-supported envs
            return null;
        }
    } else {
        console.warn('Service Workers are not supported');
        return null;
    }
}

// Request notification permission
export async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Notification permission granted');
            return true;
        } else {
            console.log('❌ Notification permission denied');
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                alert('⚠️ Notification permission DENIED. You must enable notifications in your browser settings to receive orders.');
            }
            return false;
        }
    }
    return false;
}

// Get FCM token
export async function getFCMToken() {
    if (!messaging) return null;

    try {
        const registration = await registerServiceWorker();
        if (!registration) {
            console.warn('⚠️ Service Worker registration failed. FCM will not work on this device.');
            return null; // Failed or not supported
        }

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        if (!window.isSecureContext && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            console.warn('⚠️ Not a Secure Context (HTTPS missing). FCM will not work on this mobile browser.');
        }

        console.log('DEBUG: Using VAPID Key:', VAPID_KEY);

        try {
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                // FCM tokens are sensitive — only log them in development.
                if (import.meta.env.DEV) {
                    console.log('✅ FCM Token obtained:', token);
                }
                return token;
            } else {
                console.log('❌ No FCM token available');
                return null;
            }
        } catch (tokenError: any) {
            console.error('❌ Error calling getToken:', tokenError);

            // Handle IndexedDB Version mismatch (e.g. "The requested version (1) is less than the existing version (2)")
            if (tokenError.name === 'VersionError' || tokenError.message?.includes('requested version')) {
                console.warn('⚠️ FCM IndexedDB version conflict detected. Purging corrupt IndexedDB databases and retrying...');
                try {
                    if (window.indexedDB) {
                        window.indexedDB.deleteDatabase('firebase-messaging-database');
                        window.indexedDB.deleteDatabase('fcm_vapid_details_db');
                    }
                    // Retry once after purging database
                    const retryToken = await getToken(messaging, {
                        vapidKey: VAPID_KEY,
                        serviceWorkerRegistration: registration
                    });
                    if (retryToken) {
                        console.log('✅ FCM Token obtained after IndexedDB purge:', retryToken);
                        return retryToken;
                    }
                } catch (retryError) {
                    console.error('❌ Retry after IndexedDB purge failed:', retryError);
                }
            }

            if (tokenError.code === 'messaging/token-subscribe-failed' || tokenError.message?.includes('Missing required authentication credential')) {
                console.error(`👉 POTENTIAL FIX: Check your Google Cloud Console API Key restrictions. ` +
                    `Ensure "${window.location.origin}" (and with trailing slash) is allowed in HTTP Referrers.`);
            }
            return null;
        }

    } catch (error) {
        console.error('❌ Error getting FCM token (outer):', error);
        return null;
    }
}

// Register FCM token with backend
export async function registerFCMToken(forceUpdate = false) {
    if (!messaging) {
        console.warn('⚠️ Cannot register FCM token: Messaging is not supported or initialized.');
        return null;
    }

    try {
        // Check if already registered
        const savedToken = localStorage.getItem('fcm_token_web');
        if (savedToken && !forceUpdate) {
            console.log('FCM token already registered locally');
            return savedToken;
        }

        // Request permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            console.warn('Notification permission not granted, skipping token registration');
            return null;
        }

        // Get token
        const token = await getFCMToken();
        if (!token) {
            console.warn('Failed to get FCM token, skipping backend registration');
            return null;
        }

        // Detect platform
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const platform = isMobile ? 'mobile' : 'web';

        // Save to backend
        try {
            console.log(`Attempting to save FCM token to backend for ${platform}...`);
            const response = await api.post(`/fcm-tokens/save`, {
                token: token,
                platform: platform
            });

            if (response.data.success) {
                localStorage.setItem('fcm_token_web', token);
                console.log(`✅ FCM token registered with backend as ${platform}`);
                return token;
            }
        } catch (apiError: any) {
            console.error('Failed to register token with backend API:', apiError);
        }

        return token;
    } catch (error: any) {
        console.error('❌ Error in registerFCMToken flow:', error);
        return null;
    }
}

// Setup foreground notification handler
export function setupForegroundNotificationHandler(handler?: (payload: any) => void) {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
        console.log('📬 Foreground message received:', payload);

        // Call custom handler if provided
        if (handler) {
            handler(payload);
        }

        // Show a system notification even in foreground
        // This ensures the notification appears in the "notification center" 
        // while the user is actively using the app.
        if (Notification.permission === 'granted' && payload.notification) {
            const { title, body } = payload.notification;
            const notificationTitle = title || 'Speedoo Notification';
            const notificationOptions = {
                body: body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: payload.data?.type || 'Speedoo-general',
                data: payload.data
            };

            // Use the Notification API to show it immediately
            try {
                new Notification(notificationTitle, notificationOptions);
            } catch (err) {
                console.warn('Failed to show foreground notification via new Notification(), trying ServiceWorker:', err);
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(notificationTitle, notificationOptions);
                });
            }
        }
    });
}

// Initialize push notifications
export async function initializePushNotifications() {
    // Basic compatibility check
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
        console.warn('⚠️ Push notifications are not supported in this browser environment.');
        return;
    }

    // Secure context check (required for Service Workers and Notifications)
    if (!window.isSecureContext) {
        console.error('❌ Push notifications require a Secure Context (HTTPS or localhost). ' +
            'If you are testing on a mobile device via IP, please use a secure tunnel (like ngrok) or deploy to a staging server.');
        return;
    }

    try {
        // Just register service worker on init to be ready
        await registerServiceWorker();
    } catch (error) {
        console.error('Error initializing push notifications:', error);
    }
}
