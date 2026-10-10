import { CartItem } from './cart';

export type OrderStatus =
  | "Received"
  | "Pending"
  | "Accepted"
  | "Processed"
  | "Shipped"
  | "Out for Delivery"
  | "On the way"
  | "Delivered"
  | "Cancelled"
  | "Rejected"
  | "Returned"
  | "Placed";

export interface OrderAddress {
  name: string;
  phone: string;
  flat: string;
  street: string;
  address?: string; // Add address field for backend compat
  city: string;
  state?: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  id?: string;
  _id?: string;
}

export interface OrderFees {
  platformFee?: number;
  deliveryFee?: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  fees: OrderFees;
  totalAmount: number;
  address: OrderAddress;
  status: OrderStatus;
  paymentMethod?: string;
  createdAt: string;
  tipAmount?: number;
  donationAmount?: number;
  gstin?: string;
  couponCode?: string;
  useCoins?: boolean;
  // Discount breakdown returned by the server (all funded by Speedoo)
  discount?: number;
  orderSequenceNumber?: number;
  orderSequencePercent?: number;
  orderSequenceDiscount?: number;
  couponDiscount?: number;
  loyaltyCoinsRedeemed?: number;
  loyaltyDiscount?: number;
  loyaltyCoinsToEarn?: number;
  loyaltyCoinsEarned?: number;
  loyaltyEarnStatus?: 'None' | 'Pending' | 'Credited' | 'Forfeited';
  loyaltyRedeemStatus?: 'None' | 'Redeemed' | 'Released' | 'Forfeited';
  giftPackaging?: boolean;
  deliveryInstructions?: string;
  specialRequests?: string;
}


