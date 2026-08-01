import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../modules/customer/controllers/customerNotificationController";

const router = Router();

// All notification routes are protected (customer only)
router.use(authenticate, requireUserType("Customer"));

// Get all notifications for customer
router.get("/", getNotifications);

// Mark all notifications as read
router.patch("/read-all", markAllNotificationsRead);

// Mark a single notification as read
router.patch("/:id/read", markNotificationRead);

export default router;
