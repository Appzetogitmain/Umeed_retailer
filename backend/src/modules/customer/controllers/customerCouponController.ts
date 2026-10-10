import { Request, Response } from "express";
import Coupon from "../../../models/Coupon";
import { evaluateCoupon } from "../../../services/checkoutPricingService";
import { fromPaise, toPaise } from "../../../services/loyaltyService";

// Get available coupons
export const getCoupons = async (_req: Request, res: Response) => {
    try {
        const currentDate = new Date();

        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: currentDate },
            // Expiry date is inclusive (valid through the whole day), same as checkout validation
            endDate: { $gte: new Date(new Date(currentDate).setUTCHours(0, 0, 0, 0)) },
        }).sort({ endDate: 1 });

        return res.status(200).json({
            success: true,
            data: coupons,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching coupons",
            error: error.message,
        });
    }
};

// Validate a coupon code.
// Uses the same evaluation as checkout pricing so the result always matches
// what createOrder will apply. The checkout screen uses POST /customer/orders/quote.
export const validateCoupon = async (req: Request, res: Response) => {
    try {
        const { code, orderTotal } = req.body;
        const userId = req.user?.userId;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required",
            });
        }

        const amount = Number(orderTotal) || 0;
        const result = await evaluateCoupon({
            code,
            customerId: userId,
            lines: [{ lineTotalPaise: toPaise(amount), productId: "", sellerId: "", categoryIds: [] }],
        });

        if (!result.ok) {
            return res.status(400).json({
                success: false,
                message: result.error,
            });
        }

        const discountAmount = fromPaise(result.discountPaise);
        return res.status(200).json({
            success: true,
            data: {
                isValid: true,
                coupon: result.coupon,
                discountAmount,
                finalTotal: Math.max(0, fromPaise(toPaise(amount) - result.discountPaise)),
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error validating coupon",
            error: error.message,
        });
    }
};
