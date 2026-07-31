// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCGGEeLFXSt0TScXaPnzhOQRE3icZqxf4M",
    authDomain: "kosil-e-com.firebaseapp.com",
    projectId: "kosil-e-com",
    storageBucket: "kosil-e-com.firebasestorage.app",
    messagingSenderId: "277843928493",
    appId: "1:277843928493:web:02b318e1002498016e6d24",
    measurementId: "G-QY6BQ2GDYB"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize messaging
let messaging;
try {
    messaging = firebase.messaging();
} catch (err) {
    console.error('Failed to initialize messaging in SW:', err);
}

if (messaging) {
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        const notificationTitle = payload.notification?.title || 'New Order!';
        const notificationBody = payload.notification?.body || 'A new delivery order is waiting for you.';
        const orderId = payload.data?.orderId;
        const orderNumber = payload.data?.orderNumber;

        const notificationOptions = {
            body: notificationBody,
            icon: '/logo192.png',
            badge: '/logo192.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            requireInteraction: true, // Keep notification visible until user interacts
            tag: orderId ? `order-${orderId}` : 'delivery-notification', // Prevent duplicate notifications for same order
            renotify: false,
            data: {
                ...(payload.data || {}),
                orderId: orderId,
                orderNumber: orderNumber,
                url: `/delivery/dashboard?openOrder=${orderId}`,
                link: `/delivery/dashboard?openOrder=${orderId}`,
            },
            actions: [
                { action: 'accept', title: '✅ View Order' },
                { action: 'dismiss', title: '❌ Dismiss' }
            ]
        };

        // Save pending order notification to cache for when app opens
        if (orderId) {
            self.registration.active?.postMessage?.({
                type: 'SAVE_PENDING_ORDER',
                orderId: orderId,
            });
            // Save in indexedDB-like approach using cache API as backup
            caches.open('delivery-pending-orders').then(cache => {
                cache.put(
                    `/pending-order/${orderId}`,
                    new Response(JSON.stringify({ orderId, orderNumber, timestamp: Date.now() }), {
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }).catch(() => { });
        }

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const orderId = data.orderId;
    const action = event.action;

    // If user clicked dismiss action, do nothing
    if (action === 'dismiss') return;

    // Build the URL to open — always go to dashboard with openOrder param
    const deliveryDashboardUrl = orderId
        ? `/delivery/dashboard?openOrder=${orderId}`
        : '/delivery/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a delivery tab open
            for (const client of clientList) {
                const clientUrl = new URL(client.url);
                const isDeliveryApp = clientUrl.pathname.startsWith('/delivery');

                if (isDeliveryApp && 'focus' in client) {
                    // App is already open — send a message to show the popup
                    client.focus();
                    if ('postMessage' in client && orderId) {
                        client.postMessage({
                            type: 'FCM_NOTIFICATION_CLICK',
                            data: { ...data, orderId },
                        });
                    }
                    // Also navigate to include the orderId in URL as fallback
                    if ('navigate' in client) {
                        return client.navigate(deliveryDashboardUrl);
                    }
                    return;
                }
            }

            // No existing delivery tab — open a new one
            if (clients.openWindow) {
                return clients.openWindow(deliveryDashboardUrl);
            }
        })
    );
});

// Handle messages from the main app thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_PENDING_ORDER') {
        // Main app is asking if there is a pending order notification
        caches.open('delivery-pending-orders').then(async cache => {
            const keys = await cache.keys();
            if (keys.length > 0) {
                const latestKey = keys[keys.length - 1];
                const response = await cache.match(latestKey);
                if (response) {
                    const pendingData = await response.json();
                    // Only send if within last 5 minutes (300000ms)
                    if (Date.now() - pendingData.timestamp < 300000) {
                        event.source?.postMessage({
                            type: 'PENDING_ORDER_DATA',
                            data: pendingData,
                        });
                    } else {
                        // Expired — clean up
                        cache.delete(latestKey);
                    }
                }
            }
        }).catch(() => { });
    }

    if (event.data && event.data.type === 'CLEAR_PENDING_ORDER') {
        // Main app handled the order, clear cache
        const orderId = event.data.orderId;
        if (orderId) {
            caches.open('delivery-pending-orders').then(cache => {
                cache.delete(`/pending-order/${orderId}`);
            }).catch(() => { });
        }
    }
});
