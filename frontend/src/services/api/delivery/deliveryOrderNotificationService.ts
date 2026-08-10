import { Socket } from 'socket.io-client';
import api from '../config';

export interface OrderNotificationData {
    orderId: string;
    orderNumber: string;
    sellerId?: string;
    sellerInfo?: {
        name: string;
        address: string;
        lat: number;
        lng: number;
    };
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
        address: string;
        city: string;
        state?: string;
        pincode: string;
        landmark?: string;
    };
    total: number;
    subtotal: number;
    shipping: number;
    codAmount?: number;
    createdAt: string;
    riderEarning?: number;
}

export interface AcceptOrderResponse {
    success: boolean;
    message: string;
}

export interface RejectOrderResponse {
    success: boolean;
    message: string;
    allRejected: boolean;
}

/**
 * Check whether a broadcasted pickup is still available to accept.
 * Used to clear stale locally-persisted "new order" popups (e.g. after a page
 * refresh) once another rider has already accepted the same pickup.
 */
export const checkPickupAvailability = async (
    orderId: string,
    sellerId?: string
): Promise<boolean> => {
    try {
        const response = await api.get(`/delivery/orders/${orderId}/pickup-availability`, {
            params: sellerId ? { sellerId } : undefined,
        });
        return !!response.data?.data?.available;
    } catch (error) {
        // If the check itself fails (network blip, order deleted, etc.), don't
        // block the popup on an ambiguous error — let the accept attempt itself
        // be the final authority.
        return true;
    }
};

/**
 * Accept an order via WebSocket
 */
export const acceptOrder = (
    socket: Socket,
    orderId: string,
    deliveryBoyId: string,
    sellerId?: string
): Promise<AcceptOrderResponse> => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve({
                success: false,
                message: 'Request timeout',
            });
        }, 10000); // 10 second timeout

        socket.emit('accept-order', { orderId, deliveryBoyId, sellerId });

        socket.once('accept-order-response', (response: AcceptOrderResponse) => {
            clearTimeout(timeout);
            resolve(response);
        });
    });
};

/**
 * Reject an order via WebSocket
 */
export const rejectOrder = (
    socket: Socket,
    orderId: string,
    deliveryBoyId: string,
    sellerId?: string
): Promise<RejectOrderResponse> => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve({
                success: false,
                message: 'Request timeout',
                allRejected: false,
            });
        }, 10000); // 10 second timeout

        socket.emit('reject-order', { orderId, deliveryBoyId, sellerId });

        socket.once('reject-order-response', (response: RejectOrderResponse) => {
            clearTimeout(timeout);
            resolve(response);
        });
    });
};

