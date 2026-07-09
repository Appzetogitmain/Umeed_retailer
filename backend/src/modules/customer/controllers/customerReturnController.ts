import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import Return from "../../../models/Return";

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Create a new return request for an order item
 */
export const createReturnRequest = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user!.userId;
  const {
    orderId,
    orderItemId,
    reason,
    description,
    refundMethod,
    bankAccountInfo,
    upiId,
    images,
  } = req.body;

  // Basic Validations
  if (!orderId || !orderItemId || !reason || !refundMethod) {
    return res.status(400).json({
      success: false,
      message: "Order ID, Order Item ID, reason, and refund method are required",
    });
  }

  // Minimum 1 image required
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one image of the received product is required",
    });
  }

  // Refund method validation
  if (refundMethod === "UPI") {
    if (!upiId) {
      return res.status(400).json({
        success: false,
        message: "UPI ID is required when selecting UPI refund method",
      });
    }
    if (!UPI_REGEX.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid UPI ID (e.g. name@bank)",
      });
    }
  } else if (refundMethod === "Bank") {
    if (!bankAccountInfo) {
      return res.status(400).json({
        success: false,
        message: "Bank account details are required when selecting Bank refund method",
      });
    }
    const { accountNumber, ifscCode, accountHolderName, bankName } = bankAccountInfo;
    if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
      return res.status(400).json({
        success: false,
        message: "Account number, IFSC code, account holder name, and bank name are all required",
      });
    }
    if (!IFSC_REGEX.test(ifscCode.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 11-digit IFSC code (e.g. SBIN0001234)",
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid refund method. Must be Bank or UPI",
    });
  }

  // Fetch order and verify ownership
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  if (order.customer.toString() !== customerId) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to return items from this order",
    });
  }

  // Verify order is delivered
  if (order.status !== "Delivered") {
    return res.status(400).json({
      success: false,
      message: "You can only return items from delivered orders",
    });
  }

  // Fetch order item
  const orderItem = await OrderItem.findById(orderItemId);
  if (!orderItem) {
    return res.status(404).json({
      success: false,
      message: "Order item not found",
    });
  }

  if (orderItem.order.toString() !== orderId) {
    return res.status(400).json({
      success: false,
      message: "Order item does not belong to the specified order",
    });
  }

  if (orderItem.status === "Returned") {
    return res.status(400).json({
      success: false,
      message: "This item has already been returned",
    });
  }

  // Fetch product to check return policy
  const product = await Product.findById(orderItem.product);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product details not found",
    });
  }

  if (!product.isReturnable) {
    return res.status(400).json({
      success: false,
      message: "This product is not returnable",
    });
  }

  // Check return days window
  const deliveredAt = order.deliveredAt || order.updatedAt; // fallback to updatedAt if deliveredAt not explicitly set
  const returnWindowDays = product.maxReturnDays || 0;
  const timeDifference = Date.now() - new Date(deliveredAt).getTime();
  const daysSinceDelivery = timeDifference / (1000 * 3600 * 24);

  if (daysSinceDelivery > returnWindowDays) {
    return res.status(400).json({
      success: false,
      message: `The return window for this item (${returnWindowDays} days) has expired`,
    });
  }

  // Check if a return request already exists for this item
  const existingReturn = await Return.findOne({ orderItem: orderItemId });
  if (existingReturn) {
    return res.status(400).json({
      success: false,
      message: "A return request has already been submitted for this item",
    });
  }

  // Create Return request
  const newReturn = await Return.create({
    order: orderId,
    orderItem: orderItemId,
    customer: customerId,
    reason,
    description,
    status: "Pending",
    sellerApprovalStatus: "Pending",
    adminApprovalStatus: "Pending",
    refundMethod,
    bankAccountInfo: refundMethod === "Bank" ? {
      accountNumber: bankAccountInfo.accountNumber,
      ifscCode: bankAccountInfo.ifscCode.toUpperCase(),
      accountHolderName: bankAccountInfo.accountHolderName,
      bankName: bankAccountInfo.bankName,
    } : undefined,
    upiId: refundMethod === "UPI" ? upiId : undefined,
    quantity: orderItem.quantity,
    images,
    pickupAddress: {
      address: order.deliveryAddress.address,
      city: order.deliveryAddress.city,
      pincode: order.deliveryAddress.pincode,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Return request submitted successfully",
    data: newReturn,
  });
});

/**
 * Get return requests submitted by customer
 */
export const getMyReturnRequests = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user!.userId;
  const { page = 1, limit = 10 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [returns, total] = await Promise.all([
    Return.find({ customer: customerId })
      .populate({
        path: "orderItem",
        select: "productName productImage quantity unitPrice total variation",
      })
      .populate("order", "orderNumber orderDate")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Return.countDocuments({ customer: customerId }),
  ]);

  return res.status(200).json({
    success: true,
    data: returns,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * Get customer return request details by ID
 */
export const getReturnRequestById = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.user!.userId;
  const { id } = req.params;

  const returnRequest = await Return.findOne({ _id: id, customer: customerId })
    .populate({
      path: "orderItem",
      select: "productName productImage quantity unitPrice total variation",
    })
    .populate("order", "orderNumber orderDate deliveryAddress paymentMethod status");

  if (!returnRequest) {
    return res.status(404).json({
      success: false,
      message: "Return request not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: returnRequest,
  });
});
