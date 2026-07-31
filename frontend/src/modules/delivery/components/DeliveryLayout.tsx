import { ReactNode, useEffect } from 'react';
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

  // Register FCM token globally for Delivery Boy & setup foreground handler
  useEffect(() => {
    registerFCMToken().catch(err => console.error('Delivery FCM token error:', err));
    setupForegroundNotificationHandler((payload) => {
      console.log('📬 Delivery App received foreground notification:', payload);
      if (payload.data?.orderId) {
        // Automatically fetch and show the order modal card
        getOrderDetails(payload.data.orderId).then(order => {
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
          }
        }).catch(err => console.error('Failed to load notification order:', err));
      }
    });

    // Listen to messages from Service Worker (when notification click happens)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FCM_NOTIFICATION_CLICK' && event.data.data?.orderId) {
        const orderId = event.data.data.orderId;
        getOrderDetails(orderId).then(order => {
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
          }
        }).catch(err => console.error('Failed to load order on notification click:', err));
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
  }, [showNotificationData]);

  // Handle URL query param ?openOrder=xyz (when user clicks OS notification tray item)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const openOrderId = searchParams.get('openOrder');
    if (openOrderId) {
      getOrderDetails(openOrderId).then(order => {
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
        }
      }).catch(err => console.error('Failed to load order from openOrder URL param:', err));
    }
  }, [location.search, showNotificationData]);

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




