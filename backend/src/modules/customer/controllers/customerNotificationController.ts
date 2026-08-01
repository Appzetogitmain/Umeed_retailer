import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";
import Customer from "../../../models/Customer";

/**
 * Get Customer Notifications
 * Fetches notifications for the logged-in customer
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user?.userId;

  if (!customerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const customer = await Customer.findById(customerId).select('createdAt');
  const customerCreatedAt = customer?.createdAt || new Date();

  const notifications = await Notification.find({
    recipientType: { $in: ["Customer", "All"] },
    $or: [
      { recipientId: customerId },
      { 
        recipientId: null,
        createdAt: { $gte: customerCreatedAt } 
      }, // Broadcasts to all customers AFTER their account creation
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
  const customerId = req.user?.userId;

  if (!customerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  let customerObjectId;
  try {
    customerObjectId = new mongoose.Types.ObjectId(customerId);
  } catch (err) {
    // Ignore invalid ObjectId formats
  }

  const matchConditions: any[] = [
    { recipientId: customerId },
    { recipientId: null }
  ];

  if (customerObjectId) {
    matchConditions.push({ recipientId: customerObjectId });
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipientType: { $in: ["Customer", "All"] },
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
 * Mark All Customer Notifications as Read
 */
export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user?.userId;

  if (!customerId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  let customerObjectId;
  try {
    customerObjectId = new mongoose.Types.ObjectId(customerId);
  } catch (err) {
    // Ignore invalid ObjectId formats
  }

  const matchConditions: any[] = [
    { recipientId: customerId },
    { recipientId: null }
  ];

  if (customerObjectId) {
    matchConditions.push({ recipientId: customerObjectId });
  }

  await Notification.updateMany(
    {
      recipientType: { $in: ["Customer", "All"] },
      $or: matchConditions,
      isRead: false
    },
    { 
      isRead: true, 
      readAt: new Date() 
    }
  );

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});
