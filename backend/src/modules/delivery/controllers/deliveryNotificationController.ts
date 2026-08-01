import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Notification from "../../../models/Notification";
import mongoose from "mongoose";

/**
 * Get Notifications
 * Fetches notifications for the logged-in delivery partner
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    let deliveryObjectId;
    try {
        deliveryObjectId = new mongoose.Types.ObjectId(deliveryId);
    } catch (e) {}

    const matchConditions: any[] = [
        { recipientId: deliveryId },
        { recipientId: null }
    ];
    if (deliveryObjectId) matchConditions.push({ recipientId: deliveryObjectId });

    const notifications = await Notification.find({
        recipientType: { $in: ["Delivery", "All"] },
        $or: matchConditions
    })
        .sort({ createdAt: -1 })
        .limit(50); // Limit to last 50 notifications

    return res.status(200).json({
        success: true,
        data: notifications
    });
});

/**
 * Mark Notification as Read
 */
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    let deliveryObjectId;
    try {
        deliveryObjectId = new mongoose.Types.ObjectId(deliveryId);
    } catch (e) {}

    const matchConditions: any[] = [
        { recipientId: deliveryId },
        { recipientId: null }
    ];
    if (deliveryObjectId) matchConditions.push({ recipientId: deliveryObjectId });

    const notification = await Notification.findOneAndUpdate(
        { 
            _id: id, 
            recipientType: { $in: ["Delivery", "All"] }, 
            $or: matchConditions 
        },
        { isRead: true, readAt: new Date() },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({
            success: false,
            message: "Notification not found or access denied"
        });
    }

    return res.status(200).json({
        success: true,
        message: "Notification marked as read",
        data: notification
    });
});

/**
 * Mark All Notifications as Read for Delivery Partner
 */
export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    if (!deliveryId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    let deliveryObjectId;
    try {
        deliveryObjectId = new mongoose.Types.ObjectId(deliveryId);
    } catch (e) {}

    const matchConditions: any[] = [
        { recipientId: deliveryId },
        { recipientId: null }
    ];
    if (deliveryObjectId) matchConditions.push({ recipientId: deliveryObjectId });

    await Notification.updateMany(
        {
            recipientType: { $in: ["Delivery", "All"] },
            $or: matchConditions,
            isRead: false
        },
        { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
        success: true,
        message: "All notifications marked as read"
    });
});
