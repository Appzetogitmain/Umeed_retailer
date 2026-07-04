import { Request, Response } from "express";
import Customer from "../../../models/Customer";
import Order from "../../../models/Order";
import Address from "../../../models/Address";
import Cart from "../../../models/Cart";
import CartItem from "../../../models/CartItem";
import Wishlist from "../../../models/Wishlist";
import Review from "../../../models/Review";
import Notification from "../../../models/Notification";
import { verifySmsOtp } from "../../../services/otpService";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Get customer profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId || (req as any).user?.userType !== "Customer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized or not a customer",
    });
  }

  const customer = await Customer.findById(userId);

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: {
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      dateOfBirth: customer.dateOfBirth,
      registrationDate: customer.registrationDate,
      status: customer.status,
      refCode: customer.refCode,
      walletAmount: customer.walletAmount,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      latitude: customer.latitude,
      longitude: customer.longitude,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      locationUpdatedAt: customer.locationUpdatedAt,
    },
  });
});

/**
 * Update customer profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { name, email, dateOfBirth, notificationPreferences, accountPrivacy } = req.body;


    if (!userId || (req as any).user?.userType !== "Customer") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or not a customer",
      });
    }

    const customer = await Customer.findById(userId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Update fields if provided
    if (name) customer.name = name;
    if (email) {
      // Check if email is already taken by another customer
      const existingCustomer = await Customer.findOne({
        email,
        _id: { $ne: userId },
      });

      if (existingCustomer) {
        return res.status(409).json({
          success: false,
          message: "Email already in use by another customer",
        });
      }

      customer.email = email;
    }
    if (dateOfBirth) {
      const dobDate = new Date(dateOfBirth);
      if (dobDate > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Date of birth cannot be in the future",
        });
      }
      customer.dateOfBirth = dobDate;
    }
    if (notificationPreferences) customer.notificationPreferences = { ...customer.notificationPreferences, ...notificationPreferences };
    if (accountPrivacy) customer.accountPrivacy = { ...customer.accountPrivacy, ...accountPrivacy };


    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        dateOfBirth: customer.dateOfBirth,
        registrationDate: customer.registrationDate,
        status: customer.status,
        refCode: customer.refCode,
        walletAmount: customer.walletAmount,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        latitude: customer.latitude,
        longitude: customer.longitude,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        notificationPreferences: customer.notificationPreferences,
        accountPrivacy: customer.accountPrivacy,
        donationStats: customer.donationStats,
      },

    });
  }
);

/**
 * Update customer location
 */
export const updateLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { latitude, longitude, address, city, state, pincode } = req.body;

    if (!userId || (req as any).user?.userType !== "Customer") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or not a customer",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const customer = await Customer.findById(userId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Update location fields
    customer.latitude = latitude;
    customer.longitude = longitude;
    customer.address = address;
    customer.city = city;
    customer.state = state;
    customer.pincode = pincode;
    customer.locationUpdatedAt = new Date();

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: {
        latitude: customer.latitude,
        longitude: customer.longitude,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        locationUpdatedAt: customer.locationUpdatedAt,
      },
    });
  }
);

/**
 * Get customer location
 */
export const getLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId || (req as any).user?.userType !== "Customer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized or not a customer",
    });
  }

  const customer = await Customer.findById(userId).select(
    "latitude longitude address city state pincode locationUpdatedAt"
  );

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Location retrieved successfully",
    data: {
      latitude: customer.latitude,
      longitude: customer.longitude,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      locationUpdatedAt: customer.locationUpdatedAt,
    },
  });
});

/**
 * Delete customer account
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { otp, sessionId, phone } = req.body;

  if (!userId || (req as any).user?.userType !== "Customer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized or not a customer",
    });
  }

  if (!otp || !sessionId || !phone) {
    return res.status(400).json({
      success: false,
      message: "OTP, Session ID, and Phone number are required for verification",
    });
  }

  // 1. Verify Identity via OTP
  const isValid = await verifySmsOtp(sessionId, otp, phone, "Customer");
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  const customer = await Customer.findById(userId);
  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found",
    });
  }

  // 2. Anonymize Orders
  await Order.updateMany(
    { customer: userId },
    {
      $set: {
        customerName: "Deleted User",
        customerEmail: "deleted@example.com",
        customerPhone: "0000000000",
        customerNotes: "[Anonymized]",
      }
    }
  );

  // 3. Anonymize Reviews
  await Review.updateMany(
    { customer: userId },
    {
      $set: {
        comment: "[Review deleted by user]",
        title: "[Deleted]",
      }
    }
  );

  // 4. Delete related data
  // Delete Addresses
  await Address.deleteMany({ customer: userId });

  // Delete Cart & Items
  const cart = await Cart.findOne({ customer: userId });
  if (cart) {
    await CartItem.deleteMany({ cart: cart._id });
    await Cart.deleteOne({ _id: cart._id });
  }

  // Delete Wishlist
  await Wishlist.deleteOne({ customer: userId });

  // Delete Notifications
  await Notification.deleteMany({ recipientId: userId, recipientType: "Customer" });

  // 5. Finally, Hard Delete Customer
  await Customer.deleteOne({ _id: userId });

  return res.status(200).json({
    success: true,
    message: "Your account and all related personal data have been permanently deleted.",
  });
});

/**
 * Delete customer account directly without OTP verification (authenticated only)
 */
export const deleteAccountDirect = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId || (req as any).user?.userType !== "Customer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized or not a customer",
    });
  }

  const customer = await Customer.findById(userId);
  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "Customer not found",
    });
  }

  // 1. Anonymize Orders
  await Order.updateMany(
    { customer: userId },
    {
      $set: {
        customerName: "Deleted User",
        customerEmail: "deleted@example.com",
        customerPhone: "0000000000",
        customerNotes: "[Anonymized]",
      }
    }
  );

  // 2. Anonymize Reviews
  await Review.updateMany(
    { customer: userId },
    {
      $set: {
        comment: "[Review deleted by user]",
        title: "[Deleted]",
      }
    }
  );

  // 3. Delete related data
  // Delete Addresses
  await Address.deleteMany({ customer: userId });

  // Delete Cart & Items
  const cart = await Cart.findOne({ customer: userId });
  if (cart) {
    await CartItem.deleteMany({ cart: cart._id });
    await Cart.deleteOne({ _id: cart._id });
  }

  // Delete Wishlist
  await Wishlist.deleteOne({ customer: userId });

  // Delete Notifications
  await Notification.deleteMany({ recipientId: userId, recipientType: "Customer" });

  // 4. Finally, Soft Delete Customer (preserving record for history while releasing unique keys)
  const timestamp = Date.now();
  await Customer.updateOne(
    { _id: userId },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        status: "Inactive",
        name: "Deleted User",
        phone: `deleted_${customer.phone}_${timestamp}`,
        email: customer.email ? `deleted_${customer.email}_${timestamp}` : undefined,
        fcmTokens: [],
        fcmTokenMobile: [],
      }
    }
  );

  return res.status(200).json({
    success: true,
    message: "Your account and all related personal data have been permanently deleted.",
  });
});

