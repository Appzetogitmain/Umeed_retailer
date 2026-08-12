import api from './config';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreatePosSaleItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

export interface CreatePosSaleData {
  items: CreatePosSaleItem[];
  paymentMethod: 'Cash' | 'Card' | 'UPI';
  discount?: {
    type: 'flat' | 'percent';
    value: number;
  };
  manualTax?: {
    type: 'flat' | 'percent';
    value: number;
  };
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
}

export interface PosSaleResult {
  id: string;
  orderNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  orderDate: string;
}

export interface PosOrder {
  id: string;
  orderId: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  discount: number;
  amount: number;
}

export interface PosOrderItem {
  product: string;
  sku: string;
  variation: string;
  unitPrice: number;
  qty: number;
  total: number;
}

export interface PosOrderDetail {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  items: PosOrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  seller: {
    storeName: string;
    address: string;
    city: string;
    mobile: string;
    email: string;
  };
}

export interface PosReportRow {
  orderId: string;
  date: string;
  customerName: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export interface PosReportSummary {
  totalOrders: number;
  totalRevenue: number;
  byPaymentMethod: { paymentMethod: string; orders: number; revenue: number }[];
}

export interface GetPosOrdersParams {
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Complete a new in-store POS sale.
 */
export const createPosSale = async (data: CreatePosSaleData): Promise<ApiResponse<PosSaleResult>> => {
  const response = await api.post<ApiResponse<PosSaleResult>>('/seller/pos/sales', data);
  return response.data;
};

/**
 * Seller's POS order history.
 */
export const getPosOrders = async (params?: GetPosOrdersParams): Promise<ApiResponse<PosOrder[]>> => {
  const response = await api.get<ApiResponse<PosOrder[]>>('/seller/pos/orders', { params });
  return response.data;
};

/**
 * Single POS order detail/receipt.
 */
export const getPosOrderById = async (id: string): Promise<ApiResponse<PosOrderDetail>> => {
  const response = await api.get<ApiResponse<PosOrderDetail>>(`/seller/pos/orders/${id}`);
  return response.data;
};

/**
 * POS sales report with a payment-method summary.
 */
export const getPosSalesReport = async (
  params?: { fromDate?: string; toDate?: string; page?: number; limit?: number }
): Promise<ApiResponse<PosReportRow[]> & { summary: PosReportSummary }> => {
  const response = await api.get<ApiResponse<PosReportRow[]> & { summary: PosReportSummary }>(
    '/seller/pos/reports/sales',
    { params }
  );
  return response.data;
};

export interface PosCustomer {
  _id: string;
  name: string;
  phone: string;
  email: string;
}

export const searchPosCustomers = async (search: string): Promise<ApiResponse<PosCustomer[]>> => {
  const response = await api.get<ApiResponse<PosCustomer[]>>('/seller/pos/customers/search', { params: { search } });
  return response.data;
};
