import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import Customer from "../../../models/Customer";
import Payment from "../../../models/Payment";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";
import { resolveItemUnitPrice, calculateItemTax } from "../../../utils/pricing";
import { decrementProductStock } from "../../../utils/stockDecrement";

const WALK_IN_PHONE = "0000000000";

/**
 * Find an existing Customer by phone (reuses a real account if one matches),
 * or create one. If no phone is given, reuse a single shared "Walk-in Customer"
 * placeholder so we don't have to relax Order's required customer/phone fields.
 */
const resolveWalkInCustomer = async (customerName?: string, customerPhone?: string) => {
  const phone = (customerPhone || "").trim();

  if (phone) {
    let customer = await Customer.findOne({ phone });
    if (!customer) {
      customer = await Customer.create({
        name: customerName?.trim() || "Walk-in Customer",
        phone,
      });
    }
    return customer;
  }

  let walkIn = await Customer.findOne({ phone: WALK_IN_PHONE });
  if (!walkIn) {
    try {
      walkIn = await Customer.create({
        name: "Walk-in Customer",
        phone: WALK_IN_PHONE,
      });
    } catch (err) {
      // Handle a race where another concurrent sale created it first
      walkIn = await Customer.findOne({ phone: WALK_IN_PHONE });
    }
  }
  if (!walkIn) {
    throw new Error("Unable to resolve walk-in customer record");
  }
  return walkIn;
};

/**
 * Create a POS (in-store) sale for the authenticated seller.
 * Reuses the same Product pricing/stock/Order/OrderItem/Payment models as
 * online orders, tagged with source: "POS" and created already at a terminal
 * "Delivered" status so it never enters the delivery/rider assignment flow.
 */
export const createPosSale = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { items, paymentMethod, discount, manualTax, customerName, customerEmail, customerPhone, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Sale must have at least one item" });
  }

  const allowedPaymentMethods = ["Cash", "Card", "UPI"];
  if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: `paymentMethod must be one of: ${allowedPaymentMethods.join(", ")}`,
    });
  }

  const seller = await Seller.findById(sellerId);
  if (!seller) {
    return res.status(404).json({ success: false, message: "Seller not found" });
  }

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    session = null;
  }

  try {
    const customer = await resolveWalkInCustomer(customerName, customerPhone);

    const newOrder = new Order({
      source: "POS",
      posSeller: sellerId,
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customerEmail || customer.email || "walkin@example.com",
      customerPhone: customer.phone,
      deliveryAddress: {
        address: seller.address || seller.storeName || "In-Store Purchase",
        city: seller.city || "N/A",
        pincode: "000000",
        landmark: "POS In-Store Sale",
      },
      paymentMethod,
      paymentStatus: "Paid",
      status: "Delivered",
      deliveredAt: new Date(),
      customerNotes: notes || "",
      subtotal: 0,
      tax: 0,
      shipping: 0,
      platformFee: 0,
      discount: 0,
      total: 0,
      items: [],
    });

    let subtotal = 0;
    let taxTotal = 0;
    const orderItemIds: mongoose.Types.ObjectId[] = [];

    for (const rawItem of items) {
      const productId = rawItem.productId || rawItem.product?.id;
      if (!productId) {
        throw new Error("Invalid item: productId is missing");
      }
      const qty = Number(rawItem.quantity) || 0;
      if (qty <= 0) {
        throw new Error("Invalid item quantity");
      }
      const variationValue = rawItem.variationId || rawItem.variation || null;

      // Verify the product belongs to this seller before touching stock.
      const ownedProduct = await Product.findOne({ _id: productId, seller: sellerId }).session(
        session || null
      );
      if (!ownedProduct) {
        throw new Error(`Product not found in your catalog: ${productId}`);
      }

      const product = await decrementProductStock(productId, qty, variationValue, session);
      if (!product) {
        throw new Error(
          `Insufficient stock for ${ownedProduct.productName}${variationValue ? " (" + variationValue + ")" : ""}`
        );
      }

      let selectedVariation;
      if (variationValue && product.variations) {
        selectedVariation = product.variations.find(
          (v: any) =>
            (v._id && v._id.toString() === variationValue) ||
            v.value === variationValue ||
            v.title === variationValue ||
            v.pack === variationValue
        );
      }

      const unitPrice = resolveItemUnitPrice(product, selectedVariation || variationValue);
      const itemTotal = unitPrice * qty;
      const { amount: itemTax } = await calculateItemTax(product, unitPrice, qty);

      subtotal += itemTotal;
      taxTotal += itemTax;

      const newOrderItem = new OrderItem({
        order: newOrder._id,
        product: product._id,
        seller: sellerId,
        productName: product.productName,
        productImage: product.mainImage,
        sku: product.sku,
        unitPrice,
        quantity: qty,
        total: itemTotal,
        variation: variationValue || undefined,
        status: "Delivered",
      });

      if (session) {
        await newOrderItem.save({ session });
      } else {
        await newOrderItem.save();
      }
      orderItemIds.push(newOrderItem._id as mongoose.Types.ObjectId);
    }

    // Manual seller-entered discount (flat amount or percent of subtotal), capped to subtotal.
    let discountAmount = 0;
    if (discount && Number(discount.value) > 0) {
      if (discount.type === "percent") {
        discountAmount = subtotal * (Number(discount.value) / 100);
      } else {
        discountAmount = Number(discount.value);
      }
      discountAmount = Math.min(discountAmount, subtotal);
      discountAmount = Math.round(discountAmount * 100) / 100;
    }

    // Manual seller-entered tax (overrides auto-calculated tax if provided).
    if (manualTax && Number(manualTax.value) > 0) {
      const afterDiscount = Math.max(0, subtotal - discountAmount);
      if (manualTax.type === "percent") {
        taxTotal = afterDiscount * (Number(manualTax.value) / 100);
      } else {
        taxTotal = Number(manualTax.value);
      }
      taxTotal = Math.round(taxTotal * 100) / 100;
    }

    const total = Math.round((subtotal + taxTotal - discountAmount) * 100) / 100;

    newOrder.items = orderItemIds;
    newOrder.subtotal = Math.round(subtotal * 100) / 100;
    newOrder.tax = Math.round(taxTotal * 100) / 100;
    newOrder.discount = discountAmount;
    newOrder.total = total;

    if (session) {
      await newOrder.save({ session });
    } else {
      await newOrder.save();
    }

    const payment = new Payment({
      order: newOrder._id,
      customer: customer._id,
      paymentMethod,
      amount: total,
      currency: "INR",
      status: "Completed",
      paidAt: new Date(),
      notes: "POS in-store payment",
    });

    if (session) {
      await payment.save({ session });
      await session.commitTransaction();
    } else {
      await payment.save();
    }

    // Keep the customer's lifetime stats consistent with how online orders count them.
    customer.totalOrders = (customer.totalOrders || 0) + 1;
    customer.totalSpent = (customer.totalSpent || 0) + total;
    await customer.save();

    return res.status(201).json({
      success: true,
      message: "POS sale completed successfully",
      data: {
        id: newOrder._id,
        orderNumber: newOrder.orderNumber,
        subtotal: newOrder.subtotal,
        tax: newOrder.tax,
        discount: newOrder.discount,
        total: newOrder.total,
        paymentMethod,
        customerName: customer.name,
        customerPhone: customer.phone,
        orderDate: newOrder.orderDate,
      },
    });
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
    }
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to complete POS sale",
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

/**
 * Seller's own POS order history (list), same shape/pagination convention as
 * the online orderController.getOrders.
 */
export const getPosOrders = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const {
    dateFrom,
    dateTo,
    paymentMethod,
    search,
    page = "1",
    limit = "10",
  } = req.query;

  const query: any = { source: "POS", posSeller: sellerId };

  if (dateFrom || dateTo) {
    query.orderDate = {};
    if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
    if (dateTo) {
      const endDay = new Date(dateTo as string);
      endDay.setHours(23, 59, 59, 999);
      query.orderDate.$lte = endDay;
    }
  }

  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { customerName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
    ];
  }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(query).sort({ orderDate: -1 }).skip(skip).limit(limitNum),
    Order.countDocuments(query),
  ]);

  const formattedOrders = orders.map((order) => ({
    id: order._id,
    orderId: order.orderNumber,
    orderDate: order.orderDate,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    amount: order.total,
  }));

  return res.status(200).json({
    success: true,
    message: "POS orders fetched successfully",
    data: formattedOrders,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Single POS order + items, for the receipt/detail view.
 */
export const getPosOrderById = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { id } = req.params;

  const order = await Order.findOne({ _id: id, source: "POS", posSeller: sellerId }).populate("items");
  if (!order) {
    return res.status(404).json({ success: false, message: "POS order not found" });
  }

  const seller = await Seller.findById(sellerId).select("storeName address city mobile email");

  const items = (order.items as any[]).map((item) => ({
    product: item.productName,
    sku: item.sku || "",
    variation: item.variation || "",
    unitPrice: item.unitPrice,
    qty: item.quantity,
    total: item.total,
  }));

  return res.status(200).json({
    success: true,
    message: "POS order details fetched successfully",
    data: {
      id: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items,
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount,
      grandTotal: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      seller: {
        storeName: seller?.storeName || "",
        address: seller?.address || "",
        city: seller?.city || "",
        mobile: seller?.mobile || "",
        email: seller?.email || "",
      },
    },
  });
});

/**
 * Seller POS sales report: date-range/pagination pattern mirrors
 * reportController.getSalesReport, scoped to this seller's POS orders.
 */
export const getPosSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { fromDate, toDate, page = "1", limit = "10" } = req.query;

  const query: any = { source: "POS", posSeller: new mongoose.Types.ObjectId(sellerId as string) };
  if (fromDate || toDate) {
    query.orderDate = {};
    if (fromDate) query.orderDate.$gte = new Date(fromDate as string);
    if (toDate) {
      const endDay = new Date(toDate as string);
      endDay.setHours(23, 59, 59, 999);
      query.orderDate.$lte = endDay;
    }
  }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const [orders, total, summaryAgg] = await Promise.all([
    Order.find(query).sort({ orderDate: -1 }).skip(skip).limit(limitNum),
    Order.countDocuments(query),
    Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
    ]),
  ]);

  const reports = orders.map((order) => ({
    orderId: order.orderNumber,
    date: order.orderDate,
    customerName: order.customerName,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
  }));

  const summary = {
    totalOrders: summaryAgg.reduce((sum, s) => sum + s.orders, 0),
    totalRevenue: Math.round(summaryAgg.reduce((sum, s) => sum + s.revenue, 0) * 100) / 100,
    byPaymentMethod: summaryAgg.map((s) => ({
      paymentMethod: s._id,
      orders: s.orders,
      revenue: Math.round(s.revenue * 100) / 100,
    })),
  };

  return res.status(200).json({
    success: true,
    message: "POS sales report fetched successfully",
    data: reports,
    summary,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Search customers for POS billing
 */
export const searchPosCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;
  const query: any = {};
  
  if (search && typeof search === 'string' && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [
      { name: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }
  
  const customers = await Customer.find(query)
    .select("name phone email")
    .limit(10)
    .sort({ createdAt: -1 });
    
  return res.status(200).json({
    success: true,
    message: "Customers fetched successfully",
    data: customers,
  });
});
