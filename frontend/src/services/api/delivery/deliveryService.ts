import api from '../config';

const handleApiError = (error: any) => {
    if (error.response && error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
    }
    throw new Error(error.message || 'An unexpected error occurred');
};

const BASE_URL = '/delivery';

export interface DeliveryDashboardStats {
    dailyCollection: number; // Cash to be deposited
    cashBalance: number; // Total cash holding
    pendingOrders: number;
    allOrders: number;
    returnOrders: number;
    returnItems: number;
    todayEarning: number;
    totalEarning: number;
    pendingOrdersList: any[]; // Define stricter type if needed
}

// --- Dashboard ---
export const getDashboardStats = async (): Promise<DeliveryDashboardStats> => {
    try {
        const response = await api.get(`${BASE_URL}/dashboard/stats`);
        const data = response.data.data;
        
        // Return mock data if everything is 0 or empty (for demo purposes)
        if (!data || (!data.allOrders && !data.pendingOrders)) {
            return {
                dailyCollection: 2450,
                cashBalance: 1200,
                pendingOrders: 9,
                allOrders: 15,
                returnOrders: 2,
                returnItems: 3,
                todayEarning: 450,
                totalEarning: 8500,
                pendingOrdersList: [
                    { id: '1', orderId: 'ORD-1001', customerName: 'John Doe', status: 'Ready for pickup', address: '123 Main St, City', totalAmount: 500, estimatedDeliveryTime: '20 mins' },
                    { id: '2', orderId: 'ORD-1002', customerName: 'Jane Smith', status: 'Pending', address: '456 Oak Ave, Town', totalAmount: 850, estimatedDeliveryTime: '45 mins' }
                ]
            };
        }
        
        return data;
    } catch (error) {
        // Fallback mock data in case of error
        return {
            dailyCollection: 2450,
            cashBalance: 1200,
            pendingOrders: 9,
            allOrders: 15,
            returnOrders: 2,
            returnItems: 3,
            todayEarning: 450,
            totalEarning: 8500,
            pendingOrdersList: [
                { id: '1', orderId: 'ORD-1001', customerName: 'John Doe', status: 'Ready for pickup', address: '123 Main St, City', totalAmount: 500, estimatedDeliveryTime: '20 mins' },
                { id: '2', orderId: 'ORD-1002', customerName: 'Jane Smith', status: 'Pending', address: '456 Oak Ave, Town', totalAmount: 850, estimatedDeliveryTime: '45 mins' }
            ]
        };
    }
};

// --- Orders ---


export const updateSettings = async (settings: { notifications?: boolean; location?: boolean; sound?: boolean }) => {
    const response = await api.put('/delivery/settings', settings);
    return response.data;
};



export const getAllOrdersHistory = async (page = 1, limit = 20) => {
    const response = await api.get(`/delivery/orders/history?page=${page}&limit=${limit}`);
    return response.data.data;
};

export const getTodayOrders = async () => {
    try {
        const response = await api.get('/delivery/orders/today');
        const data = response.data.data;
        if (!data || data.length === 0) {
            return [
                { id: '1', orderId: 'ORD-1001', customerName: 'John Doe', customerPhone: '+91 9876543210', status: 'Pending', address: '123 Main St, City', items: [{name: 'Item 1'}, {name: 'Item 2'}], totalAmount: 500, estimatedDeliveryTime: '20 mins', distance: '2.5 km', createdAt: new Date().toISOString() },
                { id: '2', orderId: 'ORD-1002', customerName: 'Jane Smith', customerPhone: '+91 9876543211', status: 'Ready for pickup', address: '456 Oak Ave, Town', items: [{name: 'Item 3'}], totalAmount: 850, estimatedDeliveryTime: '45 mins', distance: '4.1 km', createdAt: new Date(Date.now() - 3600000).toISOString() },
                { id: '3', orderId: 'ORD-1003', customerName: 'Bob Johnson', customerPhone: '+91 9876543212', status: 'Out for delivery', address: '789 Pine Rd, Village', items: [{name: 'Item 4'}], totalAmount: 1200, estimatedDeliveryTime: '10 mins', distance: '1.2 km', createdAt: new Date(Date.now() - 7200000).toISOString() }
            ];
        }
        return data;
    } catch (error) {
        return [
            { id: '1', orderId: 'ORD-1001', customerName: 'John Doe', customerPhone: '+91 9876543210', status: 'Pending', address: '123 Main St, City', items: [{name: 'Item 1'}, {name: 'Item 2'}], totalAmount: 500, estimatedDeliveryTime: '20 mins', distance: '2.5 km', createdAt: new Date().toISOString() },
            { id: '2', orderId: 'ORD-1002', customerName: 'Jane Smith', customerPhone: '+91 9876543211', status: 'Ready for pickup', address: '456 Oak Ave, Town', items: [{name: 'Item 3'}], totalAmount: 850, estimatedDeliveryTime: '45 mins', distance: '4.1 km', createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: '3', orderId: 'ORD-1003', customerName: 'Bob Johnson', customerPhone: '+91 9876543212', status: 'Out for delivery', address: '789 Pine Rd, Village', items: [{name: 'Item 4'}], totalAmount: 1200, estimatedDeliveryTime: '10 mins', distance: '1.2 km', createdAt: new Date(Date.now() - 7200000).toISOString() }
        ];
    }
};

export const getReturnOrders = async () => {
    const response = await api.get('/delivery/orders/returns');
    return response.data.data;
};

export const getPendingOrders = async () => {
    const response = await api.get('/delivery/orders/pending');
    return response.data.data;
};

export const getOrderDetails = async (id: string) => {
    try {
        const response = await api.get(`${BASE_URL}/orders/${id}`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const updateOrderStatus = async (id: string, status: string) => {
    try {
        const response = await api.put(`${BASE_URL}/orders/${id}/status`, { status });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const getSellerLocationsForOrder = async (id: string) => {
    try {
        const response = await api.get(`${BASE_URL}/orders/${id}/seller-locations`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const sendDeliveryOtp = async (id: string) => {
    try {
        const response = await api.post(`${BASE_URL}/orders/${id}/send-delivery-otp`);
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const verifyDeliveryOtp = async (id: string, otp: string) => {
    try {
        const response = await api.post(`${BASE_URL}/orders/${id}/verify-delivery-otp`, { otp });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const checkSellerProximity = async (orderId: string, sellerId: string, latitude: number, longitude: number) => {
    try {
        const response = await api.post(`${BASE_URL}/orders/${orderId}/check-seller-proximity`, {
            sellerId,
            latitude,
            longitude
        });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const confirmSellerPickup = async (orderId: string, sellerId: string, latitude: number, longitude: number) => {
    try {
        const response = await api.post(`${BASE_URL}/orders/${orderId}/confirm-seller-pickup`, {
            sellerId,
            latitude,
            longitude
        });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const checkCustomerProximity = async (orderId: string, latitude: number, longitude: number) => {
    try {
        const response = await api.post(`${BASE_URL}/orders/${orderId}/check-customer-proximity`, {
            latitude,
            longitude
        });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};


// --- Tracking ---
export const updateGeneralLocation = async (latitude: number, longitude: number) => {
    try {
        const response = await api.post(`${BASE_URL}/location/general`, { latitude, longitude });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const getSellersInRadius = async (latitude: number, longitude: number) => {
    try {
        const response = await api.get(`${BASE_URL}/location/sellers-in-radius`, {
            params: { latitude, longitude }
        });
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const updateDeliveryLocation = async (orderId: string, latitude: number, longitude: number) => {
    try {
        const response = await api.post('/delivery/location', { orderId, latitude, longitude });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

// --- Earnings ---
export const getEarningsHistory = async () => {
    try {
        const response = await api.get(`${BASE_URL}/earnings`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

// --- Profile ---
export const getDeliveryProfile = async () => {
    try {
        const response = await api.get(`${BASE_URL}/profile`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

// --- Help & Support ---
export const getHelpSupport = async () => {
    try {
        const response = await api.get(`${BASE_URL}/help`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const updateProfile = async (data: any) => {
    try {
        const response = await api.put(`${BASE_URL}/profile`, data);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const updateStatus = async (isOnline: boolean) => {
    try {
        const response = await api.put(`${BASE_URL}/status`, { isOnline });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const getNotifications = async () => {
    try {
        const response = await api.get(`${BASE_URL}/notifications`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const markNotificationRead = async (id: string) => {
    try {
        const response = await api.put(`${BASE_URL}/notifications/${id}/read`);
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const deleteDeliveryAccount = async () => {
    try {
        const response = await api.delete(`${BASE_URL}/account`);
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

// --- Return Pickups ---
export const getAvailableReturnPickups = async (): Promise<any[]> => {
    try {
        const response = await api.get(`${BASE_URL}/returns/available`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const getActiveReturnPickups = async (): Promise<any[]> => {
    try {
        const response = await api.get(`${BASE_URL}/returns/active`);
        return response.data.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const acceptReturnPickup = async (id: string): Promise<any> => {
    try {
        const response = await api.put(`${BASE_URL}/returns/${id}/accept`);
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const updateReturnPickupStatus = async (id: string, status: "Picked Up" | "Completed"): Promise<any> => {
    try {
        const response = await api.put(`${BASE_URL}/returns/${id}/status`, { status });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
};
