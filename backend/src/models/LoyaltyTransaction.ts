import mongoose, { Document, Schema } from "mongoose";

/**
 * Loyalty coin ledger. Append-only: every change to Customer.loyaltyCoins has
 * exactly one row here, so the balance can always be rebuilt and audited.
 *
 * CREDIT rows are also "lots": `remainingCoins` tracks how much of that credit
 * is still unspent, which is what makes FIFO redemption and expiry exact.
 * DEBIT rows record which lots they consumed in `lotsConsumed`.
 */
export type LoyaltyTxnType =
  | "EARN" // coins credited when an order is delivered
  | "REDEEM" // coins spent as a discount at checkout
  | "EXPIRE" // unspent coins from a lot that passed its expiry date
  | "ADMIN_CREDIT" // manual credit by admin
  | "ADMIN_DEBIT" // manual debit by admin
  | "EARN_REVERSAL" // earned coins taken back when an item is returned/refunded
  | "REDEEM_RELEASE"; // redeemed coins given back because the order was never paid

export const CREDIT_TYPES: LoyaltyTxnType[] = ["EARN", "ADMIN_CREDIT", "REDEEM_RELEASE"];
export const DEBIT_TYPES: LoyaltyTxnType[] = ["REDEEM", "EXPIRE", "ADMIN_DEBIT", "EARN_REVERSAL"];

export interface ILoyaltyTransaction extends Document {
  customer: mongoose.Types.ObjectId;
  type: LoyaltyTxnType;
  direction: "CREDIT" | "DEBIT";
  coins: number; // always a positive integer
  coinsPerRupee: number; // conversion rate in force when the row was written
  rupeeValue: number; // coins / coinsPerRupee
  balanceBefore: number;
  balanceAfter: number;

  order?: mongoose.Types.ObjectId;
  orderNumber?: string;
  orderItem?: mongoose.Types.ObjectId;
  items?: Array<{
    product: mongoose.Types.ObjectId;
    productName: string;
    seller: mongoose.Types.ObjectId;
    quantity: number;
    coins: number;
  }>;

  // Lot fields (CREDIT rows only)
  remainingCoins?: number;
  expiresAt?: Date | null;
  lotSortKey?: Date; // expiresAt, or far future when the lot never expires
  expired?: boolean;

  // DEBIT rows: which lots were consumed and how much from each
  lotsConsumed?: Array<{ lot: mongoose.Types.ObjectId; coins: number }>;

  idempotencyKey?: string;
  note?: string;
  actorType: "SYSTEM" | "ADMIN" | "CUSTOMER";
  actorId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    type: {
      type: String,
      enum: ["EARN", "REDEEM", "EXPIRE", "ADMIN_CREDIT", "ADMIN_DEBIT", "EARN_REVERSAL", "REDEEM_RELEASE"],
      required: true,
    },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    coins: {
      type: Number,
      required: true,
      min: [1, "Coins must be at least 1"],
      validate: { validator: Number.isInteger, message: "Coins must be a whole number" },
    },
    coinsPerRupee: { type: Number, required: true, min: 1 },
    rupeeValue: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },

    order: { type: Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String, trim: true },
    orderItem: { type: Schema.Types.ObjectId, ref: "OrderItem" },
    items: [
      {
        _id: false,
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        productName: { type: String },
        seller: { type: Schema.Types.ObjectId, ref: "Seller" },
        quantity: { type: Number },
        coins: { type: Number },
      },
    ],

    remainingCoins: { type: Number, min: 0 },
    expiresAt: { type: Date, default: null },
    lotSortKey: { type: Date },
    expired: { type: Boolean, default: false },

    lotsConsumed: [
      {
        _id: false,
        lot: { type: Schema.Types.ObjectId, ref: "LoyaltyTransaction" },
        coins: { type: Number },
      },
    ],

    idempotencyKey: { type: String },
    note: { type: String, trim: true },
    actorType: { type: String, enum: ["SYSTEM", "ADMIN", "CUSTOMER"], default: "SYSTEM" },
    actorId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

// Guarantees an action (e.g. "earn for order X") can only ever be applied once
LoyaltyTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
LoyaltyTransactionSchema.index({ customer: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ customer: 1, direction: 1, remainingCoins: 1, lotSortKey: 1 });
LoyaltyTransactionSchema.index({ direction: 1, remainingCoins: 1, expiresAt: 1 });
LoyaltyTransactionSchema.index({ order: 1 });
LoyaltyTransactionSchema.index({ type: 1, createdAt: -1 });

const LoyaltyTransaction =
  mongoose.models.LoyaltyTransaction ||
  mongoose.model<ILoyaltyTransaction>("LoyaltyTransaction", LoyaltyTransactionSchema);

export default LoyaltyTransaction;
