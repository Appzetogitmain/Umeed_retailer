import { Router } from "express";
import adminAuthRoutes from "./adminAuthRoutes";
import sellerAuthRoutes from "./sellerAuthRoutes";
import dashboardRoutes from "./dashboardRoutes";
import customerAuthRoutes from "./customerAuthRoutes";
import deliveryRoutes from "./deliveryRoutes";
import deliveryAuthRoutes from "./deliveryAuthRoutes";

// ... (other imports)
import { authenticate, requireUserType } from "../middleware/auth";
import customerRoutes from "./customerRoutes";
import sellerRoutes from "./sellerRoutes";
import uploadRoutes from "./uploadRoutes";
import productRoutes from "./productRoutes";
import headerCategoryRoutes from "./headerCategoryRoutes";
import categoryRoutes from "./categoryRoutes";
import orderRoutes from "./orderRoutes";
import fcmTokenRoutes from "./fcmTokenRoutes";
import returnRoutes from "./returnRoutes";
import reportRoutes from "./reportRoutes";
import adminWithdrawalRoutes from "./adminWithdrawalRoutes";
import deliveryWalletRoutes from "./deliveryWalletRoutes";
import sellerWalletRoutes from "./sellerWalletRoutes";
import taxRoutes from "./taxRoutes";
import posRoutes from "./posRoutes";
import sellerNotificationRoutes from "./sellerNotificationRoutes";
import customerProductRoutes from "./customerProductRoutes";
import customerCategoryRoutes from "./customerCategoryRoutes";
import customerCouponRoutes from "./customerCouponRoutes";
import customerAddressRoutes from "./customerAddressRoutes";
import customerHomeRoutes from "./customerHomeRoutes";
import customerCartRoutes from "./customerCartRoutes";
import customerNotificationRoutes from "./customerNotificationRoutes";
import wishlistRoutes from "./wishlistRoutes";
import productReviewRoutes from "./productReviewRoutes";
import policyRoutes from "./policyRoutes";
import adminRoutes from "./adminRoutes";
import customerTrackingRoutes from "../modules/customer/routes/trackingRoutes";
import deliveryTrackingRoutes from "../modules/delivery/routes/trackingRoutes";
import customerBannerRoutes from "./customerBannerRoutes";
import paymentRoutes from "./paymentRoutes";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderNotes,
} from "../modules/customer/controllers/customerOrderController";
import {
  createReturnRequest as customerCreateReturnRequest,
  getMyReturnRequests as customerGetMyReturnRequests,
  getReturnRequestById as customerGetReturnRequestById,
} from "../modules/customer/controllers/customerReturnController";

const router = Router();

// Health check route
router.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
router.use("/auth/admin", adminAuthRoutes);
router.use("/auth/seller", sellerAuthRoutes);
router.use("/auth/customer", customerAuthRoutes);
router.use("/auth/delivery", deliveryAuthRoutes);

// FCM Token Routes
router.use("/fcm-tokens", fcmTokenRoutes);

// Delivery routes (protected)
router.use(
  "/delivery",
  authenticate,
  requireUserType("Delivery"),
  deliveryRoutes
);
router.use(
  "/delivery",
  authenticate,
  requireUserType("Delivery"),
  deliveryTrackingRoutes
);
router.use(
  "/delivery/wallet",
  deliveryWalletRoutes
);

// Customer routes - Specific routes MUST be registered before general /customer route
// to prevent Express from matching the broader route first
router.use("/customer/products", customerProductRoutes);
router.use("/customer/categories", customerCategoryRoutes);

// Tracking routes (must be before general /customer/orders/:id route)
router.use("/customer", customerTrackingRoutes);

// Customer orders route - direct registration to avoid module loading issue
console.log("🔥 REGISTERING CUSTOMER ORDER ROUTES");
router.post(
  "/customer/orders",
  (_req, _res, next) => {
    console.log("✅ POST /customer/orders ROUTE MATCHED!");
    next();
  },
  authenticate,
  requireUserType("Customer"),
  createOrder
);
router.get("/customer/orders", authenticate, requireUserType("Customer"), getMyOrders);
router.get("/customer/orders/:id", authenticate, requireUserType("Customer"), getOrderById);
router.post("/customer/orders/:id/cancel", authenticate, requireUserType("Customer"), cancelOrder);
router.patch("/customer/orders/:id/notes", authenticate, requireUserType("Customer"), updateOrderNotes);

// Customer Return routes (Added dummy comment to force fresh commit)
router.post("/customer/returns", authenticate, requireUserType("Customer"), customerCreateReturnRequest);
router.get("/customer/returns", authenticate, requireUserType("Customer"), customerGetMyReturnRequests);
router.get("/customer/returns/:id", authenticate, requireUserType("Customer"), customerGetReturnRequestById);

router.use("/customer/coupons", customerCouponRoutes);
router.use("/customer/addresses", customerAddressRoutes);
router.use("/customer/home", customerHomeRoutes);
router.use("/customer/cart", customerCartRoutes);
router.use("/customer/notifications", customerNotificationRoutes);
router.use("/customer/wishlist", wishlistRoutes);
router.use("/customer/reviews", productReviewRoutes);
// General customer route (must be last to avoid intercepting specific routes)
router.use("/customer", customerRoutes);

// Payment routes
router.use("/payment", paymentRoutes);

// Seller dashboard routes
router.use("/seller/dashboard", dashboardRoutes);

// Seller management routes (protected, admin only)
router.use("/sellers", sellerRoutes);

// Public banner routes (no authentication required)
router.use("/banners", customerBannerRoutes);

// Admin routes (protected, admin only)
router.use("/admin", adminRoutes);
router.use("/admin", adminWithdrawalRoutes);

// Upload routes (protected)
router.use("/upload", uploadRoutes);

// Product routes (protected, seller only)
router.use("/products", productRoutes);

// Category routes (protected, seller/admin)
router.use("/categories", categoryRoutes);

// Header Category Routes
router.use("/header-categories", headerCategoryRoutes);

// Order routes (protected, seller only)
router.use("/orders", orderRoutes);

// Return routes (protected, seller only)
router.use("/returns", returnRoutes);

// Report routes (protected, seller only)
router.use("/seller/reports", reportRoutes);

// Wallet routes (protected, seller only)
router.use("/seller/wallet", sellerWalletRoutes);

// Notification routes (protected, seller only)
router.use("/seller/notifications", sellerNotificationRoutes);

// Tax routes (protected, seller/admin)
router.use("/seller/taxes", taxRoutes);

// POS routes (protected, seller only)
router.use("/seller/pos", posRoutes);

// Add more routes here
// router.use('/users', userRoutes);

// Public policy routes
router.use("/policies", policyRoutes);

export default router;
