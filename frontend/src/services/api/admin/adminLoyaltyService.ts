import api from "../config";

export type LoyaltyTxnType =
  | "EARN"
  | "REDEEM"
  | "EXPIRE"
  | "ADMIN_CREDIT"
  | "ADMIN_DEBIT"
  | "EARN_REVERSAL"
  | "REDEEM_RELEASE";

export const TXN_LABELS: Record<LoyaltyTxnType, string> = {
  EARN: "Earned (delivered order)",
  REDEEM: "Redeemed at checkout",
  EXPIRE: "Expired",
  ADMIN_CREDIT: "Admin credit",
  ADMIN_DEBIT: "Admin debit",
  EARN_REVERSAL: "Reversed (return)",
  REDEEM_RELEASE: "Released (unpaid order)",
};

export interface OrderDiscountTier {
  orderNumber: number;
  percent: number;
  maxDiscount: number;
  minOrderValue: number;
}

export interface LoyaltySettings {
  enabled: boolean;
  earnEnabled: boolean;
  redeemEnabled: boolean;
  coinsPerRupee: number;
  maxRedeemPercent: number;
  minRedeemCoins: number;
  expiryEnabled: boolean;
  expiryDays: number;
  orderDiscountsEnabled: boolean;
  orderDiscounts: OrderDiscountTier[];
}

export interface LoyaltyOverview {
  config: LoyaltySettings;
  ledger: Partial<Record<LoyaltyTxnType, { count: number; coins: number; value: number }>>;
  outstandingCoins: number;
  outstandingValue: number;
  customersWithCoins: number;
  pendingEarnCoins: number;
  pendingEarnOrders: number;
  expiringIn30Days: number;
  productsWithCoins: number;
  discounts: {
    orderSequence: number;
    coupon: number;
    loyalty: number;
    total: number;
    firstOrderCount: number;
    secondOrderCount: number;
    couponOrders: number;
    coinOrders: number;
  };
}

export interface LoyaltyTransactionRow {
  _id: string;
  customer?: { _id: string; name: string; phone: string; email?: string } | null;
  type: LoyaltyTxnType;
  direction: "CREDIT" | "DEBIT";
  coins: number;
  coinsPerRupee: number;
  rupeeValue: number;
  balanceBefore: number;
  balanceAfter: number;
  order?: string;
  orderNumber?: string;
  items?: { productName: string; quantity: number; coins: number }[];
  remainingCoins?: number;
  expiresAt?: string | null;
  expired?: boolean;
  note?: string;
  actorType: "SYSTEM" | "ADMIN" | "CUSTOMER";
  createdAt: string;
}

export interface LoyaltyCustomerRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyCoins: number;
  coinValue: number;
  totalOrders?: number;
  loyaltyStats?: Record<string, number>;
}

export interface LoyaltyProductRow {
  _id: string;
  productName: string;
  mainImage?: string;
  sku?: string;
  status?: string;
  seller?: { _id: string; storeName?: string; sellerName?: string } | null;
  category?: { _id: string; name: string } | null;
  unitPrice: number;
  loyaltyCoinType: "none" | "fixed" | "percent";
  loyaltyCoinValue: number;
  coinsPerUnit: number;
  coinsValuePerUnit: number;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const getLoyaltySettings = async () =>
  (await api.get<{ success: boolean; data: LoyaltySettings }>("/admin/loyalty/settings")).data;

export const updateLoyaltySettings = async (data: Partial<LoyaltySettings>) =>
  (await api.put<{ success: boolean; message: string; data: LoyaltySettings }>("/admin/loyalty/settings", data)).data;

export const getLoyaltyOverview = async () =>
  (await api.get<{ success: boolean; data: LoyaltyOverview }>("/admin/loyalty/overview")).data;

export const getLoyaltyTransactions = async (params: Record<string, any>) =>
  (await api.get<Paginated<LoyaltyTransactionRow> & { totals: { creditCoins: number; debitCoins: number; creditValue: number; debitValue: number } }>(
    "/admin/loyalty/transactions",
    { params }
  )).data;

export const getLoyaltyCustomers = async (params: Record<string, any>) =>
  (await api.get<Paginated<LoyaltyCustomerRow>>("/admin/loyalty/customers", { params })).data;

export const adjustCustomerCoins = async (
  customerId: string,
  data: { direction: "CREDIT" | "DEBIT"; coins: number; note: string; requestId: string }
) => (await api.post<{ success: boolean; message: string }>(`/admin/loyalty/customers/${customerId}/adjust`, data)).data;

export const getLoyaltyProducts = async (params: Record<string, any>) =>
  (await api.get<Paginated<LoyaltyProductRow>>("/admin/loyalty/products", { params })).data;

export const updateProductCoins = async (productId: string, data: { loyaltyCoinType: string; loyaltyCoinValue: number }) =>
  (await api.put<{ success: boolean; message: string }>(`/admin/loyalty/products/${productId}`, data)).data;

export const bulkUpdateProductCoins = async (data: {
  productIds?: string[];
  category?: string;
  seller?: string;
  applyToAll?: boolean;
  onlyUnconfigured?: boolean;
  loyaltyCoinType: string;
  loyaltyCoinValue: number;
}) => (await api.put<{ success: boolean; message: string; data: { matched: number; modified: number } }>("/admin/loyalty/products/bulk", data)).data;

export const runLoyaltyExpiry = async () =>
  (await api.post<{ success: boolean; message: string }>("/admin/loyalty/expire-now")).data;

export const reconcileLoyalty = async (fix: boolean) =>
  (await api.post<{ success: boolean; message: string; data: { checked: number; mismatches: any[] } }>(
    "/admin/loyalty/reconcile",
    { fix }
  )).data;
