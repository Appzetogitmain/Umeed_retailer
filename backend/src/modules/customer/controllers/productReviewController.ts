
import { Request, Response } from 'express';
import Review from '../../../models/Review';
import Order from '../../../models/Order';
import mongoose from 'mongoose';

// Get reviews for a product (Public)
export const getProductReviews = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (page - 1) * limit;

        const reviews = await Review.find({ product: productId, status: 'Approved' })
            .populate('customer', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Review.countDocuments({ product: productId, status: 'Approved' });

        // We can optionally fetch the Product's overall rating if needed, but usually frontend has it.
        // For backwards compatibility with the route's response format:
        const product = await mongoose.model('Product').findById(productId).select('rating reviewsCount');

        return res.status(200).json({
            success: true,
            data: {
                reviews,
                stats: {
                    avgRating: product?.rating || 0,
                    totalReviews: product?.reviewsCount || 0
                },
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};

// Add a review (Protected, must have purchased)
export const addReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId, orderId, rating, comment, title, images } = req.body;

        // Verify purchase
        const order = await Order.findOne({
            _id: orderId,
            customer: userId,
            status: 'Delivered'
        }).populate('items');

        if (!order) {
            return res.status(400).json({
                success: false,
                message: 'You can only review products from delivered orders.'
            });
        }

        const hasProduct = order.items.some((item: any) => 
            item.product && item.product.toString() === productId
        );

        if (!hasProduct) {
            return res.status(400).json({
                success: false,
                message: 'Product not found in this order.'
            });
        }

        // Check if already reviewed
        const existingReview = await Review.findOne({
            customer: userId,
            product: productId,
            order: orderId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this product for this order.'
            });
        }

        // Auto approve if no comment/title, else pending moderation
        const initialStatus = (!comment && !title) ? 'Approved' : 'Pending';

        const review = await Review.create({
            customer: userId,
            product: productId,
            order: orderId,
            rating,
            comment,
            title,
            images,
            status: initialStatus,
            isVerifiedPurchase: true
        });

        return res.status(201).json({
            success: true,
            message: initialStatus === 'Approved' ? 'Review submitted successfully' : 'Review submitted successfully, available after moderation',
            data: review
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding review',
            error: error.message
        });
    }
};
