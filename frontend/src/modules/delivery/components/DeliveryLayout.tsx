import { ReactNode, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DeliveryBottomNav from './DeliveryBottomNav';
import { DeliveryStatusProvider, useDeliveryStatus } from '../context/DeliveryStatusContext';
import { DeliveryUserProvider, useDeliveryUser } from '../context/DeliveryUserContext';
import { getDeliveryProfile, getOrderDetails } from '../../../services/api/delivery/deliveryService';
import { useDeliveryOrderNotifications } from '../../../hooks/useDeliveryOrderNotifications';
import { registerFCMToken, setupForegroundNotificationHandler } from '../../../services/pushNotificationService';
import OrderNotificationCard from './OrderNotificationCard';
import { AnimatePresence } from 'framer-motion';

interface DeliveryLayoutContentProps {
  children: ReactNode;
}

/**
 * Retry fetching order details - useful when app just opened and auth may still be hydrating
 */
async function fetchOrderWithRetry(orderId: string, maxRetries = 4, delayMs = 800): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const order = await getOrderDetails(orderId);
      if (order) return order;
    } catch (err: any) {
      const isAuthError = err?.response?.status === 401 || err?.response?.status === 403;
      if (isAuthError && attempt < maxRetries - 1) {
        // Auth token not ready yet — wait and retry
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return null;
}

function DeliveryLayoutContent({ children }: DeliveryLayoutContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline } = useDeliveryStatus();
  const { setUserName } = useDeliveryUser();
  const {
    currentNotification,
    acceptOrder,
    rejectOrder,
    showNotificationData,
  } = useDeliveryOrderNotifications();

  /**
   * Common function: given an orderId, fetch details and show the popup notification card
   */
  const loadAndShowOrder = useCallback(async (orderId: string, source = 'unknown') => {
    console.log(`[DeliveryLayout] Loading order ${orderId} from ${source}...`);
    try {
      const order = await fetchOrderWithRetry(orderId);
      if (order) {
        showNotificationData({
          orderId: order.id || order._id,
          orderNumber: order.orderId || order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddress || { address: order.address, city: '', pincode: '' },
          total: order.totalAmount || order.total,
          subtotal: order.subtotal || order.totalAmount,
          shipping: order.shipping || 0,
          codAmount: order.paymentMethod === 'COD' ? order.totalAmount : undefined,
          createdAt: order.createdAt || new Date().toISOString(),
          riderEarning: order.riderEarning ?? 0,
        });

        // Tell Service Worker we handled this order so it clears cache
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_PENDING_ORDER',
            orderId,
          });
        }
        console.log(`[DeliveryLayout] ✅ Order popup shown for ${orderId}`);
      }
    } catch (err) {
      console.error(`[DeliveryLayout] ❌ Failed to load order from ${source}:`, err);
    }
  }, [showNotificationData]);

  // Register FCM token globally for Delivery Boy & setup foreground handler
  useEffect(() => {
    registerFCMToken().catch(err => console.error('Delivery FCM token error:', err));
    setupForegroundNotificationHandler((payload) => {
      console.log('📬 Delivery App received foreground notification:', payload);
      if (payload.data?.orderId) {
        loadAndShowOrder(payload.data.orderId, 'foreground-FCM');
      }
    });

    // Listen to messages from Service Worker (notification click when app was open)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === 'FCM_NOTIFICATION_CLICK' && event.data.data?.orderId) {
        loadAndShowOrder(event.data.data.orderId, 'SW-notification-click');
      }

      if (event.data.type === 'PENDING_ORDER_DATA' && event.data.data?.orderId) {
        loadAndShowOrder(event.data.data.orderId, 'SW-pending-cache');
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [loadAndShowOrder]);

  // On app startup: ask Service Worker if there is any pending order notification (app was closed when notification came)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const askSWForPendingOrder = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({ type: 'GET_PENDING_ORDER' });
          console.log('[DeliveryLayout] Asked SW for pending order notifications');
        }
      } catch (err) {
        console.warn('[DeliveryLayout] Could not query SW for pending orders:', err);
      }
    };

    // Small delay to let auth hydrate before we try to fetch order details
    const timer = setTimeout(askSWForPendingOrder, 1200);
    return () => clearTimeout(timer);
  }, []); // Only run once on mount

  // Handle URL query param ?openOrder=xyz (when user clicks OS notification tray item → app opens)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const openOrderId = searchParams.get('openOrder');
    if (openOrderId) {
      loadAndShowOrder(openOrderId, 'URL-param-openOrder');
    }
  }, [location.search, loadAndShowOrder]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getDeliveryProfile();
        if (profile?.name) {
          setUserName(profile.name);
        }
      } catch (error) {
        console.error('Failed to fetch profile in layout:', error);
      }
    };

    fetchProfile();
  }, [setUserName]);

  return (
    <div className={`flex flex-col min-h-screen bg-neutral-100 transition-all duration-300 ${!isOnline ? 'grayscale' : ''}`}>
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        {children}
      </main>
      <DeliveryBottomNav />

      {/* Order Notification Card */}
      <AnimatePresence>
        {currentNotification && (
          <OrderNotificationCard
            key={currentNotification.orderId}
            notification={currentNotification}
            onAccept={(orderId) => acceptOrder(orderId, navigate)}
            onReject={rejectOrder}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface DeliveryLayoutProps {
  children: ReactNode;
}

export default function DeliveryLayout({ children }: DeliveryLayoutProps) {
  return (
    <DeliveryStatusProvider>
      <DeliveryUserProvider>
        <DeliveryLayoutContent>{children}</DeliveryLayoutContent>
      </DeliveryUserProvider>
    </DeliveryStatusProvider>
  );
}
