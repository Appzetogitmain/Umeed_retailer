import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../../../models/Review";
import Product from "../../../models/Product";

// Get all reviews with optional status filter
export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query: any = {};

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const reviews = await Review.find(query)
      .populate("customer", "name phone email")
      .populate({
        path: "product",
        select: "productName mainImage seller",
        populate: {
          path: "seller",
          select: "sellerName storeName",
        },
      })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching admin reviews:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reviews",
    });
  }
};

// Update review status
export const updateReviewStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.status = status;
    await review.save();

    // Recalculate average rating if status changed to or from Approved
    await (Review as any).calcAverageRatings(review.product);

    res.status(200).json({
      success: true,
      message: `Review ${status.toLowerCase()} successfully`,
      data: review,
    });
  } catch (error: any) {
    console.error("Error updating review status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update review status",
    });
  }
};

// Delete review
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }
    
    const productId = review.product;
    await review.deleteOne();
    
    // Recalculate rating
    await (Review as any).calcAverageRatings(productId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete review",
    });
  }
};
