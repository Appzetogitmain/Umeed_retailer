import { ReactNode, useState, useCallback, useEffect } from 'react';
import SellerHeader from './SellerHeader';
import SellerSidebar from './SellerSidebar';
import { useSellerSocket, SellerNotification } from '../hooks/useSellerSocket';
import SellerNotificationAlert from './SellerNotificationAlert';
import {
  getSellerNotifications,
  markSellerNotificationRead,
  markAllSellerNotificationsRead
} from '../../../services/api/sellerNotificationService';

export interface DBNotification {
  _id: string;
  recipientType: string;
  recipientId?: string;
  title: string;
  message: string;
  type: "Info" | "Success" | "Warning" | "Error" | "Order" | "Payment" | "System";
  link?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface SellerLayoutProps {
  children: ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<SellerNotification | null>(null);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getSellerNotifications();
      if (res.success && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n: DBNotification) => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationReceived = useCallback((notification: SellerNotification) => {
    setActiveNotification(notification);
    // Refresh the notifications list automatically to show the new db-persisted notification in the dropdown
    fetchNotifications();
  }, [fetchNotifications]);

  useSellerSocket(handleNotificationReceived);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeNotification = () => {
    setActiveNotification(null);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markSellerNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllSellerNotificationsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Real-time Notification Alert */}
      <SellerNotificationAlert
        notification={activeNotification}
        onClose={closeNotification}
      />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - Fixed */}
      <div
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out print:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SellerSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 w-full print:ml-0 ${
          isSidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        {/* Header */}
        <div className="print:hidden">
          <SellerHeader
            onMenuClick={toggleSidebar}
            isSidebarOpen={isSidebarOpen}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>

        {/* Page Content */}
        <main id="seller-main-content" className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-neutral-50">{children}</main>
      </div>
    </div>
  );
}

