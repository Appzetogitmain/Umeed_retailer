import api from './config';

export interface OrderItem {
    product: {
        id: string;
        name: string;
        image: string;
        price: number;
    };
    quantity: number;
    total: number;
}

export interface CreateOrderData {
    items: {
        product: {
            id: string;
            name?: string;
        };
        quantity: number;
        variant?: string;
    }[];
    address: {
        addressLine?: string;
        city: string;
        state?: string;
        pincode: string;
        latitude: number;
        longitude: number;
        [key: string]: any;
    };
    paymentMethod: string;
    fees?: {
        deliveryFee: number;
        platformFee: number;
    };
    couponCode?: string;
    useCoins?: boolean;
    // Total the customer was shown; the server rejects the order (409) if its own total differs
    expectedTotal?: number;
}

export interface CheckoutQuoteRequest {
    items: { product: { id: string }; quantity: number; variant?: string }[];
    address?: { latitude?: number; longitude?: number };
    couponCode?: string;
    useCoins?: boolean;
}

export interface CheckoutQuote {
    subtotal: number;
    platformFee: number;
    deliveryFee: number;
    orderSequence: { orderNumber: number; percent: number; discount: number; applied: boolean; message?: string };
    coupon: { code?: string; couponId?: string; discount: number; applied: boolean; error?: string; description?: string };
    loyalty: {
        enabled: boolean;
        balance: number;
        balanceValue: number;
        coinsPerRupee: number;
        maxRedeemPercent: number;
        minRedeemCoins: number;
        maxUsableCoins: number;
        maxUsableDiscount: number;
        coinsUsed: number;
        discount: number;
        applied: boolean;
        message?: string;
    };
    totalDiscount: number;
    amountBeforeCoins: number;
    total: number;
    coinsToEarn: number;
    coinsToEarnValue: number;
    freeDeliveryThreshold?: number;
    estimatedDeliveryTime?: string;
    items: { productId: string; name: string; unitPrice: number; quantity: number; lineTotal: number; discountShare: number; loyaltyCoins: number }[];
    unavailable: { productId: string; reason: string }[];
}

/**
 * Server-computed checkout bill (same calculation used when the order is placed)
 */
export const getCheckoutQuote = async (data: CheckoutQuoteRequest): Promise<{ success: boolean; data: CheckoutQuote; message?: string }> => {
    const response = await api.post('/customer/orders/quote', data);
    return response.data;
};

export interface OrderResponse {
    success: boolean;
    message?: string;
    data: any;
}

export interface MyOrdersParams {
    page?: number;
    limit?: number;
    status?: string;
}

/**
 * Create a new order
 */
export const createOrder = async (data: CreateOrderData): Promise<OrderResponse> => {
    const response = await api.post<OrderResponse>('/customer/orders', data);
    return response.data;
};

/**
 * Get my orders
 */
export const getMyOrders = async (params?: MyOrdersParams): Promise<any> => {
    const response = await api.get('/customer/orders', { params });
    return response.data;
};

/**
 * Get order by ID
 */
export const getOrderById = async (id: string): Promise<any> => {
    const response = await api.get(`/customer/orders/${id}`);
    return response.data;
};

/**
 * Get seller locations for an order
 */
export const getSellerLocationsForOrder = async (id: string): Promise<any> => {
    const response = await api.get(`/customer/orders/${id}/seller-locations`);
    return response.data;
};

/**
 * Refresh delivery OTP for an order
 */
export const refreshDeliveryOtp = async (id: string): Promise<OrderResponse> => {
    const response = await api.post<OrderResponse>(`/customer/orders/${id}/refresh-otp`);
    return response.data;
};

/**
 * Cancel an order
 */
export const cancelOrder = async (id: string, reason: string): Promise<OrderResponse> => {
    const response = await api.post<OrderResponse>(`/customer/orders/${id}/cancel`, { reason });
    return response.data;
};

/**
 * Update order notes (instructions/special requests)
 */
export const updateOrderNotes = async (id: string, data: { deliveryInstructions?: string; specialRequests?: string }): Promise<OrderResponse> => {
    const response = await api.patch<OrderResponse>(`/customer/orders/${id}/notes`, data);
    return response.data;
};

/**
 * Create customer return request
 */
export const createReturnRequest = async (data: {
    orderId: string;
    orderItemId: string;
    reason: string;
    description?: string;
    refundMethod: "Bank" | "UPI";
    bankAccountInfo?: {
        accountNumber: string;
        ifscCode: string;
        accountHolderName: string;
        bankName: string;
    };
    upiId?: string;
    images: string[];
}): Promise<OrderResponse> => {
    const response = await api.post<OrderResponse>('/customer/returns', data);
    return response.data;
};

/**
 * Get customer's return requests
 */
export const getMyReturnRequests = async (params?: { page?: number; limit?: number }): Promise<any> => {
    const response = await api.get('/customer/returns', { params });
    return response.data;
};

/**
 * Get details of a customer return request
 */
export const getReturnRequestById = async (id: string): Promise<any> => {
    const response = await api.get(`/customer/returns/${id}`);
    return response.data;
};
