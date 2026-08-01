// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBuiRbdOfnKE6kIsxiYLSLx8G8IAvibuUQ",
    authDomain: "speedoo-2f9df.firebaseapp.com",
    projectId: "speedoo-2f9df",
    storageBucket: "speedoo-2f9df.firebasestorage.app",
    messagingSenderId: "118580376455",
    appId: "1:118580376455:web:40ab746155ee3ec4ee1922",
    measurementId: "G-HWK6NPM1W7"
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

        const orderId = payload.data?.orderId;
        const orderNumber = payload.data?.orderNumber;

        // Save pending order notification to cache for when app opens
        if (orderId) {
            self.registration.active?.postMessage?.({
                type: 'SAVE_PENDING_ORDER',
                orderId: orderId,
            });
            caches.open('delivery-pending-orders').then(cache => {
                cache.put(
                    `/pending-order/${orderId}`,
                    new Response(JSON.stringify({ orderId, orderNumber, timestamp: Date.now() }), {
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }).catch(() => { });
        }

        // Note: If payload has a 'notification' object, Firebase SDK & OS automatically show the push notification.
        // We only call showNotification manually if there is NO notification field in payload (data-only push message)
        if (!payload.notification) {
            const notificationTitle = payload.data?.title || 'Notification';
            const notificationBody = payload.data?.body || '';
            const isOrder = !!(orderId || payload.data?.type === 'ORDER_NEW' || payload.data?.type === 'ORDER_DELIVERED');

            const notificationOptions = {
                body: notificationBody,
                icon: '/logo192.png',
                badge: '/logo192.png',
                vibrate: [200, 100, 200, 100, 200],
                requireInteraction: true,
                tag: orderId ? `order-${orderId}` : `notif-${Date.now()}`,
                renotify: false,
                data: {
                    ...(payload.data || {}),
                    url: payload.data?.url || payload.data?.link || (isOrder ? `/delivery/dashboard?openOrder=${orderId}` : '/notifications'),
                },
                actions: isOrder ? [
                    { action: 'accept', title: '✅ View Order' },
                    { action: 'dismiss', title: '❌ Dismiss' }
                ] : [
                    { action: 'view', title: '✅ Open' },
                    { action: 'dismiss', title: '❌ Dismiss' }
                ]
            };

            self.registration.showNotification(notificationTitle, notificationOptions);
        }
    });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const orderId = data.orderId;
    const type = data.type;
    const action = event.action;

    // If user clicked dismiss action, just close — do nothing else
    if (action === 'dismiss') return;

    if (type === 'ORDER_DELIVERED') {
        const customerNotificationsUrl = '/notifications';

        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // Check if there is already a customer app open
                for (const client of clientList) {
                    const clientUrl = new URL(client.url);
                    const isCustomerApp = !clientUrl.pathname.startsWith('/delivery') && !clientUrl.pathname.startsWith('/seller') && !clientUrl.pathname.startsWith('/admin');

                    if (isCustomerApp && 'focus' in client) {
                        client.focus();
                        client.navigate(customerNotificationsUrl);
                        return;
                    }
                }
                
                if (clients.openWindow) {
                    return clients.openWindow(customerNotificationsUrl);
                }
            })
        );
        return;
    }

    // Handle general or order notification click navigation
    const targetUrl = data.url || data.link || (orderId ? `/delivery/dashboard?openOrder=${orderId}` : '/notifications');

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If window already open, focus and navigate
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client && targetUrl) {
                        client.navigate(targetUrl);
                    }
                    return;
                }
            }

            if (clients.openWindow && targetUrl) {
                return clients.openWindow(targetUrl);
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
