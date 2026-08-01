import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCustomerNotifications, markCustomerNotificationAsRead, markAllCustomerNotificationsAsRead } from "../../services/api/customerNotificationService";
import PageLoader from "../../components/PageLoader";

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await getCustomerNotifications();
      if (response.success && response.data) {
        setNotifications(response.data);
      } else {
        setError("Failed to load notifications.");
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Network error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    try {
      await markCustomerNotificationAsRead(id);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllCustomerNotificationsAsRead();
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      try {
        await markCustomerNotificationAsRead(notification._id);
        setNotifications(notifications.map(n => n._id === notification._id ? { ...n, isRead: true } : n));
      } catch (err) {
        console.error("Error marking notification as read on click:", err);
      }
    }
    
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading && notifications.length === 0) {
    return <PageLoader />;
  }

  return (
    <div className="bg-neutral-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:text-neutral-900 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-lg font-bold text-neutral-900 ml-2">Notifications</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-end mb-6">
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
            {error}
            <button onClick={fetchNotifications} className="block mx-auto mt-2 text-red-700 font-semibold underline hover:no-underline">Try Again</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-neutral-100">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">No notifications</h3>
            <p className="text-neutral-500">You don't have any notifications right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div 
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`relative bg-white p-3 rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md ${
                  notification.isRead 
                    ? 'border-neutral-100' 
                    : 'border-blue-100 bg-blue-50/30'
                }`}
              >
                {!notification.isRead && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
                
                <div className="flex gap-3">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                    notification.type === 'Order' ? 'bg-orange-100 text-orange-600' :
                    notification.type === 'Success' ? 'bg-green-100 text-green-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {notification.type === 'Order' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    )}
                  </div>
                  
                  <div className="flex-1 pr-5">
                    <h4 className={`text-sm font-bold mb-0.5 ${notification.isRead ? 'text-neutral-800' : 'text-neutral-900'}`}>
                      {notification.title}
                    </h4>
                    <p className={`text-[13px] leading-snug mb-2 ${notification.isRead ? 'text-neutral-500' : 'text-neutral-700'}`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">
                        {formatDate(notification.createdAt)}
                      </span>
                      
                      {!notification.isRead && (
                        <button 
                          onClick={(e) => handleMarkAsRead(notification._id, e)}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
