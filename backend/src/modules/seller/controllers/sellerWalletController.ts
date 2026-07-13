import { Request, Response } from 'express';
import {
    getWalletBalance,
    getWalletTransactions,
    createWithdrawalRequest,
    getWithdrawalRequests,
} from '../../../services/walletManagementService';
import { getCommissionSummary } from '../../../services/commissionService';
import Seller from '../../../models/Seller';
import bcrypt from 'bcrypt';

/**
 * Get seller wallet balance
 */
export const getBalance = async (req: Request, res: Response) => {
    try {
        const sellerId = req.user!.userId;
        const balance = await getWalletBalance(sellerId, 'SELLER');

        return res.status(200).json({
            success: true,
            data: { balance },
        });
    } catch (error: any) {
        console.error('Error getting wallet balance:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get wallet balance',
        });
    }
};

/**
 * Get seller wallet transactions
 */
export const getTransactions = async (req: Request, res: Response) => {
    try {
        const sellerId = req.user!.userId;
        const { page = 1, limit = 20 } = req.query;

        const result = await getWalletTransactions(
            sellerId,
            'SELLER',
            Number(page),
            Number(limit)
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting wallet transactions:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get wallet transactions',
        });
    }
};

/**
 * Get seller payment details
 */
export const getPaymentDetails = async (req: Request, res: Response) => {
    try {
        const sellerId = req.user!.userId;
        const seller = await Seller.findById(sellerId).select('accountName bankName branch accountNumberMasked ifsc upiIdMasked');

        if (!seller) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                bankDetails: seller.accountNumberMasked ? {
                    accountName: seller.accountName,
                    bankName: seller.bankName,
                    branch: seller.branch,
                    accountNumber: seller.accountNumberMasked,
                    ifsc: seller.ifsc,
                } : null,
                upiDetails: seller.upiIdMasked ? {
                    upiId: seller.upiIdMasked
                } : null
            }
        });
    } catch (error: any) {
        console.error('Error getting payment details:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get payment details',
        });
    }
};

/**
 * Request withdrawal
 */
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const sellerId = req.user!.userId;
        const { amount, paymentMethod, bankDetails, upiDetails } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal amount',
            });
        }

        if (!paymentMethod || !['Bank Transfer', 'UPI'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method',
            });
        }

        const seller = await Seller.findById(sellerId);
        if (!seller) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        let accountDetailsString = '';

        if (paymentMethod === 'Bank Transfer') {
            if (bankDetails) {
                // Server-side validation
                if (!bankDetails.accountName || !bankDetails.bankName || !bankDetails.branch || !bankDetails.accountNumber || !bankDetails.ifsc) {
                    return res.status(400).json({ success: false, message: 'All bank details are required' });
                }
                if (!/^\d{9,18}$/.test(bankDetails.accountNumber)) {
                    return res.status(400).json({ success: false, message: 'Invalid account number format' });
                }
                if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifsc)) {
                    return res.status(400).json({ success: false, message: 'Invalid IFSC format' });
                }

                // Hash and mask
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(bankDetails.accountNumber, salt);
                const masked = `****${bankDetails.accountNumber.slice(-4)}`;

                seller.accountName = bankDetails.accountName;
                seller.bankName = bankDetails.bankName;
                seller.branch = bankDetails.branch;
                seller.accountNumberHash = hash;
                seller.accountNumberMasked = masked;
                
                // Clear plain text old field if it exists
                seller.accountNumber = undefined;
                seller.ifsc = bankDetails.ifsc;

                await seller.save();
                accountDetailsString = `${bankDetails.bankName} - ${masked} (${bankDetails.ifsc})`;
            } else if (seller.accountNumberMasked) {
                accountDetailsString = `${seller.bankName} - ${seller.accountNumberMasked} (${seller.ifsc})`;
            } else {
                return res.status(400).json({ success: false, message: 'Bank details required' });
            }
        } else if (paymentMethod === 'UPI') {
            if (upiDetails) {
                // Server-side validation
                if (!upiDetails.upiId) {
                    return res.status(400).json({ success: false, message: 'UPI ID is required' });
                }
                if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiDetails.upiId)) {
                    return res.status(400).json({ success: false, message: 'Invalid UPI ID format' });
                }

                // Masking: show first 3 chars + *** + @bank
                const parts = upiDetails.upiId.split('@');
                const masked = `${parts[0].slice(0, 3)}***@${parts[1]}`;

                seller.upiId = undefined; // Do not store plaintext
                seller.upiIdMasked = masked;
                
                await seller.save();
                accountDetailsString = `UPI: ${masked}`;
            } else if (seller.upiIdMasked) {
                accountDetailsString = `UPI: ${seller.upiIdMasked}`;
            } else {
                return res.status(400).json({ success: false, message: 'UPI details required' });
            }
        }

        const result = await createWithdrawalRequest(
            sellerId,
            'SELLER',
            amount,
            paymentMethod,
            accountDetailsString
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to request withdrawal',
        });
    }
};

/**
 * Get seller withdrawal requests
 */
export const getWithdrawals = async (req: Request, res: Response) => {
    try {
        const sellerId = req.user!.userId;
        const { status } = req.query;

        const result = await getWithdrawalRequests(
            sellerId,
            'SELLER',
            status as string
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting withdrawal requests:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get withdrawal requests',
        });
    }
};

/**
 * Get seller commission earnings
 */
export const getCommissions = async (req: Request, res: Response) => {
    try {
        const sellerId = req.user!.userId;

        const result = await getCommissionSummary(sellerId, 'SELLER');

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting commission earnings:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get commission earnings',
        });
    }
};
