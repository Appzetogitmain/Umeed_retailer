import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  registrationDate: Date;
  status: 'Active' | 'Inactive';
  refCode: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  deliveryOtp: string; // Permanent 4-digit OTP for delivery verification
  totalOrders: number;
  totalSpent: number;
  // Loyalty coins wallet (separate from any refund/payment balance).
  // Always mutated through loyaltyService so it stays equal to the ledger.
  loyaltyCoins: number;
  loyaltyStats?: {
    totalEarned: number;
    totalRedeemed: number;
    totalExpired: number;
    totalAdminCredited: number;
    totalAdminDebited: number;
    totalReversed: number; // earned coins taken back on returns
    totalReleased: number; // redeemed coins given back for unpaid/aborted orders
  };
  // Location fields
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  locationUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  fcmTokens?: string[];
  fcmTokenMobile?: string[];
  donationStats?: {
    totalDonated: number;
    lastDonationDate?: Date;
    impactDescription?: string;
  };
  accountPrivacy?: {
    hideSensitiveItems: boolean;
  };
}


const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          // Allow empty or valid email format
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Phone number must be 10 digits',
      },
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (v: Date) {
          return !v || v <= new Date();
        },
        message: 'Date of birth cannot be in the future',
      },
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    refCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    deliveryOtp: {
      type: String,
      trim: true,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: [0, 'Total orders cannot be negative'],
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, 'Total spent cannot be negative'],
    },
    loyaltyCoins: {
      type: Number,
      default: 0,
      min: [0, 'Loyalty coins cannot be negative'],
    },
    loyaltyStats: {
      totalEarned: { type: Number, default: 0 },
      totalRedeemed: { type: Number, default: 0 },
      totalExpired: { type: Number, default: 0 },
      totalAdminCredited: { type: Number, default: 0 },
      totalAdminDebited: { type: Number, default: 0 },
      totalReversed: { type: Number, default: 0 },
      totalReleased: { type: Number, default: 0 },
    },
    // Location fields
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    locationUpdatedAt: {
      type: Date,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    fcmTokenMobile: {
      type: [String],
      default: [],
    },
    donationStats: {
      totalDonated: { type: Number, default: 0 },
      lastDonationDate: Date,
      impactDescription: String,
    },
    accountPrivacy: {
      hideSensitiveItems: { type: Boolean, default: false },
    },
  },

  {
    timestamps: true,
  }
);

// Generate refCode and deliveryOtp before saving if not provided
CustomerSchema.pre('save', async function (next) {
  if (!this.refCode) {
    // Generate a unique refCode (e.g., first 4 letters of name + random 4 chars)
    const namePart = this.name
      .replace(/\s+/g, '')
      .substring(0, 4)
      .toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.refCode = `${namePart}${randomPart}`;
  }
  if (!this.deliveryOtp) {
    // Generate permanent 4-digit delivery OTP
    this.deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
  }
  next();
});

const Customer = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;

