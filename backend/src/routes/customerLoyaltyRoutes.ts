import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  getLoyaltyProgramInfo,
  getMyLoyaltyHistory,
  getMyLoyaltySummary,
} from "../modules/customer/controllers/customerLoyaltyController";

const router = Router();

router.get("/program", getLoyaltyProgramInfo);
router.get("/", authenticate, requireUserType("Customer"), getMyLoyaltySummary);
router.get("/history", authenticate, requireUserType("Customer"), getMyLoyaltyHistory);

export default router;
