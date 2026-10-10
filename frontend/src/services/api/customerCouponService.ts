import api from './config';

// Mirrors the backend Coupon model (backend/src/models/Coupon.ts)
export interface Coupon {
    _id: string;
    code: string;
    title?: string;
    description?: string;
    discountType: 'Percentage' | 'Fixed';
    discountValue: number;
    minimumPurchase?: number;
    maximumDiscount?: number;
    startDate: string;
    endDate: string;
    usageLimit?: number;
    usageCount: number;
    usageLimitPerUser?: number;
    applicableTo?: 'All' | 'Category' | 'Product' | 'Seller';
    isActive: boolean;
}

export interface ValidateCouponResponse {
    success: boolean;
    data?: {
        isValid: boolean;
        coupon: Coupon;
        discountAmount: number;
        finalTotal: number;
    };
    message?: string;
}

export interface GetCouponsResponse {
    success: boolean;
    data: Coupon[];
}

/**
 * Get all available coupons
 */
export const getCoupons = async (): Promise<GetCouponsResponse> => {
    const response = await api.get<GetCouponsResponse>('/customer/coupons');
    return response.data;
};

/**
 * Validate a coupon code
 */
export const validateCoupon = async (code: string, orderTotal: number): Promise<ValidateCouponResponse> => {
    const response = await api.post<ValidateCouponResponse>('/customer/coupons/validate', {
        code,
        orderTotal
    });
    return response.data;
};
