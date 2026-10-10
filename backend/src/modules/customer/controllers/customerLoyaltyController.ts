import { Request, Response } from "express";
import LoyaltyTransaction from "../../../models/LoyaltyTransaction";
import { getCustomerLoyaltySummary, getLoyaltyConfig } from "../../../services/loyaltyService";

/**
 * Coins balance, value, expiring soon and lifetime stats for the logged-in customer
 */
export const getMyLoyaltySummary = async (req: Request, res: Response) => {
  try {
    const summary = await getCustomerLoyaltySummary(req.user!.userId);
    return res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Error fetching loyalty coins",
    });
  }
};

/**
 * Paginated coin history (ledger) for the logged-in customer
 */
export const getMyLoyaltyHistory = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const query: any = { customer: req.user!.userId };
    if (req.query.direction === "CREDIT" || req.query.direction === "DEBIT") query.direction = req.query.direction;

    const [rows, total] = await Promise.all([
      LoyaltyTransaction.find(query)
        .select("type direction coins rupeeValue balanceAfter orderNumber order note expiresAt remainingCoins expired createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LoyaltyTransaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Error fetching coin history", error: error.message });
  }
};

/**
 * Public program info (used to show "Earn X coins" on product pages)
 */
export const getLoyaltyProgramInfo = async (_req: Request, res: Response) => {
  try {
    const cfg = await getLoyaltyConfig();
    return res.status(200).json({
      success: true,
      data: {
        enabled: cfg.enabled,
        earnEnabled: cfg.enabled && cfg.earnEnabled,
        redeemEnabled: cfg.enabled && cfg.redeemEnabled,
        coinsPerRupee: cfg.coinsPerRupee,
        maxRedeemPercent: cfg.maxRedeemPercent,
        minRedeemCoins: cfg.minRedeemCoins,
        expiryEnabled: cfg.expiryEnabled,
        expiryDays: cfg.expiryDays,
        orderDiscounts: cfg.enabled && cfg.orderDiscountsEnabled ? cfg.orderDiscounts : [],
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Error fetching loyalty program", error: error.message });
  }
};
