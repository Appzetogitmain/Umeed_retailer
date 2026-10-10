import api from './config';

export type LoyaltyTxnType =
    | 'EARN'
    | 'REDEEM'
    | 'EXPIRE'
    | 'ADMIN_CREDIT'
    | 'ADMIN_DEBIT'
    | 'EARN_REVERSAL'
    | 'REDEEM_RELEASE';

export interface LoyaltySummary {
    balance: number;
    balanceValue: number;
    coinsPerRupee: number;
    maxRedeemPercent: number;
    minRedeemCoins: number;
    enabled: boolean;
    redeemEnabled: boolean;
    earnEnabled: boolean;
    expiryEnabled: boolean;
    expiryDays: number;
    expiringSoon: { coins: number; nextExpiry: string | null };
    stats: {
        totalEarned?: number;
        totalRedeemed?: number;
        totalExpired?: number;
        totalAdminCredited?: number;
        totalAdminDebited?: number;
        totalReversed?: number;
        totalReleased?: number;
    };
}

export interface LoyaltyHistoryRow {
    _id: string;
    type: LoyaltyTxnType;
    direction: 'CREDIT' | 'DEBIT';
    coins: number;
    rupeeValue: number;
    balanceAfter: number;
    orderNumber?: string;
    order?: string;
    note?: string;
    expiresAt?: string | null;
    remainingCoins?: number;
    expired?: boolean;
    createdAt: string;
}

export interface LoyaltyProgram {
    enabled: boolean;
    earnEnabled: boolean;
    redeemEnabled: boolean;
    coinsPerRupee: number;
    maxRedeemPercent: number;
    minRedeemCoins: number;
    expiryEnabled: boolean;
    expiryDays: number;
    orderDiscounts: { orderNumber: number; percent: number; maxDiscount: number; minOrderValue: number }[];
}

export const LOYALTY_TYPE_LABELS: Record<LoyaltyTxnType, string> = {
    EARN: 'Earned on order',
    REDEEM: 'Used on order',
    EXPIRE: 'Expired',
    ADMIN_CREDIT: 'Added by Speedoo',
    ADMIN_DEBIT: 'Deducted by Speedoo',
    EARN_REVERSAL: 'Reversed (item returned)',
    REDEEM_RELEASE: 'Returned (payment not completed)',
};

export const getLoyaltySummary = async (): Promise<{ success: boolean; data: LoyaltySummary }> => {
    const response = await api.get('/customer/loyalty');
    return response.data;
};

export const getLoyaltyHistory = async (params?: { page?: number; limit?: number; direction?: 'CREDIT' | 'DEBIT' }) => {
    const response = await api.get('/customer/loyalty/history', { params });
    return response.data as {
        success: boolean;
        data: LoyaltyHistoryRow[];
        pagination: { page: number; limit: number; total: number; pages: number };
    };
};

let programCache: { at: number; data: LoyaltyProgram } | null = null;
export const getLoyaltyProgram = async (): Promise<LoyaltyProgram | null> => {
    if (programCache && Date.now() - programCache.at < 5 * 60 * 1000) return programCache.data;
    try {
        const response = await api.get('/customer/loyalty/program');
        if (response.data?.success) {
            programCache = { at: Date.now(), data: response.data.data };
            return response.data.data;
        }
    } catch {
        /* program info is optional for display */
    }
    return null;
};

/**
 * Coins a product earns per unit, using the same rule as the server
 * (fixed: coins per unit, percent: % of price converted at coinsPerRupee).
 */
export const coinsForProduct = (
    product: { loyaltyCoinType?: string; loyaltyCoinValue?: number } | null | undefined,
    unitPrice: number,
    program: LoyaltyProgram | null
): number => {
    if (!product || !program || !program.earnEnabled) return 0;
    const value = Number(product.loyaltyCoinValue) || 0;
    if (value <= 0) return 0;
    if (product.loyaltyCoinType === 'fixed') return Math.floor(value + 1e-9);
    if (product.loyaltyCoinType === 'percent') {
        const paise = Math.round(unitPrice * 100);
        return Math.floor((paise * value * program.coinsPerRupee) / 10000 + 1e-9);
    }
    return 0;
};
