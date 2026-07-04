import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import Policy from "../models/Policy";
import AppSettings from "../models/AppSettings";

const router = Router();

/**
 * GET /api/v1/policies/settings
 * Fetch public app settings (support email, support phone, contact email, contact phone)
 */
router.get("/settings", asyncHandler(async (req, res) => {
    const settings = await AppSettings.findOne().select("appName contactEmail contactPhone supportEmail supportPhone");
    return res.status(200).json({
        success: true,
        data: settings || {
            appName: "Speedoo",
            contactEmail: "contact@speedoo.com",
            contactPhone: "1234567890",
            supportEmail: "support@speedoo.com",
            supportPhone: "1234567890",
        },
    });
}));

/**
 * GET /api/v1/policies
 * Fetch all active policies
 */
router.get("/", asyncHandler(async (req, res) => {
    const policies = await Policy.find({ isActive: true });
    return res.status(200).json({
        success: true,
        data: policies,
    });
}));

/**
 * GET /api/v1/policies/:type
 * Fetch active policy by type
 */
router.get("/:type", asyncHandler(async (req, res) => {
    const { type } = req.params;
    const policy = await Policy.findOne({ type, isActive: true });

    if (!policy) {
        return res.status(404).json({
            success: false,
            message: "Policy not found",
        });
    }

    return res.status(200).json({
        success: true,
        data: policy,
    });
}));

export default router;
