import { Router } from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../modules/seller/controllers/sellerNotificationController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));

// Get all notifications for seller
router.get("/", getNotifications);

// Mark all notifications as read
router.patch("/read-all", markAllNotificationsRead);

// Mark a single notification as read
router.patch("/:id/read", markNotificationRead);

export default router;
