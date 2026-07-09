
import mongoose, { Document, Schema } from "mongoose";

export interface IReturn extends Document {
  order: mongoose.Types.ObjectId;
  orderItem: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;

  // Return Info
  reason: string;
  description?: string;
  status: "Pending" | "Approved" | "Rejected" | "Processing" | "Completed" | "Refunded";

  // Approval trackers
  sellerApprovalStatus: "Pending" | "Approved" | "Rejected";
  adminApprovalStatus: "Pending" | "Approved" | "Rejected" | "Overridden";

  // Refund details
  refundMethod: "Bank" | "UPI";
  bankAccountInfo?: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName: string;
  };
  upiId?: string;
  transactionId?: string;
  refundedAt?: Date;

  // Items
  quantity: number;
  images?: string[]; // Images of returned items

  // Processing
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  rejectionReason?: string;

  // Pickup
  pickupScheduled?: Date;
  pickupCompleted?: Date;
  pickupAddress?: {
    address: string;
    city: string;
    pincode: string;
  };

  // Delivery Rider for Return Pickup
  deliveryBoy?: mongoose.Types.ObjectId;
  deliveryBoyStatus?: "Pending" | "Accepted" | "Picked Up" | "Completed" | "Failed";
  pickupOtp?: string;
  pickupOtpExpiresAt?: Date;

  // Refund Legacy
  refundAmount?: number;
  refundId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const ReturnSchema = new Schema<IReturn>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    orderItem: {
      type: Schema.Types.ObjectId,
      ref: "OrderItem",
      required: [true, "Order item is required"],
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    // Return Info
    reason: {
      type: String,
      required: [true, "Return reason is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Processing", "Completed", "Refunded"],
      default: "Pending",
    },

    // Approval trackers
    sellerApprovalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    adminApprovalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Overridden"],
      default: "Pending",
    },

    // Refund details
    refundMethod: {
      type: String,
      enum: ["Bank", "UPI"],
      required: [true, "Refund method is required"],
    },
    bankAccountInfo: {
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
    },
    upiId: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    refundedAt: {
      type: Date,
    },

    // Items
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    images: {
      type: [String],
      default: [],
    },

    // Processing
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    processedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },

    // Pickup
    pickupScheduled: {
      type: Date,
    },
    pickupCompleted: {
      type: Date,
    },
    pickupAddress: {
      address: String,
      city: String,
      pincode: String,
    },

    // Delivery Rider for Return Pickup
    deliveryBoy: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
    },
    deliveryBoyStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Picked Up", "Completed", "Failed"],
      default: "Pending",
    },
    pickupOtp: {
      type: String,
      trim: true,
    },
    pickupOtpExpiresAt: {
      type: Date,
    },

    // Refund Legacy
    refundAmount: {
      type: Number,
      min: [0, "Refund amount cannot be negative"],
    },
    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReturnSchema.index({ order: 1 });
ReturnSchema.index({ customer: 1 });
ReturnSchema.index({ status: 1 });
ReturnSchema.index({ deliveryBoy: 1 });

const Return = mongoose.models.Return || mongoose.model<IReturn>("Return", ReturnSchema);

export default Return;
