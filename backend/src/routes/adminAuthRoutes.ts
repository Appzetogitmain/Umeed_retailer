import { Router } from "express";
import * as adminAuthController from "../modules/admin/controllers/adminAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// Send OTP route
router.post("/send-otp", otpRateLimiter, adminAuthController.sendOTP);

// Verify OTP and login route
router.post("/verify-otp", loginRateLimiter, adminAuthController.verifyOTP);

// Register route - only an already-authenticated admin may create another admin
// (matches the /admin/system-users flow; admins must never be self-service)
router.post("/register", authenticate, requireUserType("Admin"), adminAuthController.register);

export default router;
