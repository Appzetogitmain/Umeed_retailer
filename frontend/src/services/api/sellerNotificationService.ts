import api from './config';

/**
 * Get seller notifications
 */
export const getSellerNotifications = async () => {
    try {
        const response = await api.get('/seller/notifications');
        return response.data;
    } catch (error: any) {
        console.error('Error getting seller notifications:', error);
        throw error;
    }
};

/**
 * Mark a single notification as read
 */
export const markSellerNotificationRead = async (id: string) => {
    try {
        const response = await api.patch(`/seller/notifications/${id}/read`);
        return response.data;
    } catch (error: any) {
        console.error(`Error marking notification ${id} as read:`, error);
        throw error;
    }
};

/**
 * Mark all notifications as read
 */
export const markAllSellerNotificationsRead = async () => {
    try {
        const response = await api.patch('/seller/notifications/read-all');
        return response.data;
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};
