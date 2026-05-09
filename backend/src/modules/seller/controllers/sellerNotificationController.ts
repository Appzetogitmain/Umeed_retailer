import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";

/**
 * Get Seller Notifications
 * Fetches notifications for the logged-in seller
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?.userId;

  if (!sellerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const notifications = await Notification.find({
    recipientType: "Seller",
    $or: [
      { recipientId: sellerId },
      { recipientId: null }, // Broadcasts to all sellers
    ],
  })
    .sort({ createdAt: -1 })
    .limit(100); // Limit to last 100 notifications

  return res.status(200).json({
    success: true,
    data: notifications,
  });
});

/**
 * Mark a Notification as Read
 */
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const sellerId = req.user?.userId;

  if (!sellerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  let sellerObjectId;
  try {
    sellerObjectId = new mongoose.Types.ObjectId(sellerId);
  } catch (err) {
    // Ignore invalid ObjectId formats
  }

  const matchConditions: any[] = [
    { recipientId: sellerId },
    { recipientId: null }
  ];

  if (sellerObjectId) {
    matchConditions.push({ recipientId: sellerObjectId });
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipientType: "Seller",
      $or: matchConditions
    },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found or access denied",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

/**
 * Mark All Seller Notifications as Read
 */
export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?.userId;

  if (!sellerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  let sellerObjectId;
  try {
    sellerObjectId = new mongoose.Types.ObjectId(sellerId);
  } catch (err) {
    // Ignore invalid ObjectId formats
  }

  const matchConditions: any[] = [
    { recipientId: sellerId },
    { recipientId: null }
  ];

  if (sellerObjectId) {
    matchConditions.push({ recipientId: sellerObjectId });
  }

  await Notification.updateMany(
    {
      recipientType: "Seller",
      isRead: false,
      $or: matchConditions
    },
    { isRead: true, readAt: new Date() }
  );

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});
