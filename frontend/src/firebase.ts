import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

try {
    getAnalytics(app);
} catch (error: any) {
    console.warn('Firebase Analytics not available in this environment.', error);
}

let messaging: Messaging | null = null;

try {
    messaging = getMessaging(app);
} catch (error: any) {
    console.warn('Firebase Messaging not supported in this environment.', error);
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        // Only alert on mobile to avoid annoying desktop devs
        alert(`⚠️ Firebase Messaging Init Failed: ${error.message || 'Unknown error'}`);
    }
}

export { messaging, getToken, onMessage };
export default app;
