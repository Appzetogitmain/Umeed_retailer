import { Router } from "express";
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderNotificationSnapshot,
} from "../modules/seller/controllers/orderController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));

// Get seller's orders with filters
router.get("/", getOrders);

// Get order by ID
router.get("/:id", getOrderById);

// Reconstruct the pending "new order" notification popup for this order
router.get("/:id/notification-snapshot", getOrderNotificationSnapshot);

// Update order status
router.patch("/:id/status", updateOrderStatus);

export default router;
