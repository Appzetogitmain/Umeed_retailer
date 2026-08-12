import { Router } from "express";
import {
  createPosSale,
  getPosOrders,
  getPosOrderById,
  getPosSalesReport,
  searchPosCustomers,
} from "../modules/seller/controllers/posController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));

// Create a new in-store POS sale
router.post("/sales", createPosSale);

// POS order history for this seller
router.get("/orders", getPosOrders);
router.get("/orders/:id", getPosOrderById);

// POS sales report
router.get("/reports/sales", getPosSalesReport);

// Search customers for POS
router.get("/customers/search", searchPosCustomers);

export default router;
