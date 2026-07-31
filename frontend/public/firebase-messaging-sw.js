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

        // Customize notification here
        const notificationTitle = payload.notification?.title || 'New Message';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/logo192.png',
            badge: '/logo192.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            requireInteraction: true,
            data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const urlToOpen = data.link || data.url || '/delivery/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a window/tab open
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if ('postMessage' in client) {
                        client.postMessage({
                            type: 'FCM_NOTIFICATION_CLICK',
                            data: data
                        });
                    }
                    if ('navigate' in client) {
                        return client.navigate(urlToOpen);
                    }
                    return;
                }
            }
            // If no window/tab is open, open the URL
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
