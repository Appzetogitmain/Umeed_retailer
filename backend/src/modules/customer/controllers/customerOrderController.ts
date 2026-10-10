import { Request, Response } from "express";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import OrderItem from "../../../models/OrderItem";
import Customer from "../../../models/Customer";
import Seller from "../../../models/Seller";
import mongoose from "mongoose";
import { calculateDistance } from "../../../utils/locationHelper";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import { generateDeliveryOtp } from "../../../services/deliveryOtpService";
import { Server as SocketIOServer } from "socket.io";
import { calculateDeliveryStuff } from "./customerCartController";
import { resolveItemUnitPrice } from "../../../utils/pricing";
import { decrementProductStock } from "../../../utils/stockDecrement";
import {
    computeCheckoutPricing,
    consumeCouponUsage,
    serializePricing,
    PricingLineInput,
} from "../../../services/checkoutPricingService";
import { expireDueLots, redeemCoinsForOrder } from "../../../services/loyaltyService";
import { abortUnpaidOnlineOrder, isUnpaidOnlineOrder } from "../../../services/unpaidOrderService";

// Resolve which variation an order line refers to (same matching for quote and order)
const pickVariation = (product: any, variationValue: any) => {
    let selectedVariation;
    if (variationValue && product.variations) {
        selectedVariation = product.variations.find((v: any) =>
            (v._id && v._id.toString() === variationValue) ||
            v.value === variationValue ||
            v.title === variationValue ||
            v.pack === variationValue
        );
    }
    if (!selectedVariation && product.variations && product.variations.length > 0) {
        // Fallback to first if no variation spec or not found (consistent with stock fallback)
        selectedVariation = product.variations[0];
    }
    return selectedVariation;
};

const parseCoordinate = (value: any): number | null => {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(n) ? null : n;
};

/**
 * Checkout quote: the exact bill the customer will be charged, computed by the
 * same pricing service createOrder uses (items, first/second-order discount,
 * coupon, loyalty coins, fees and coins to be earned).
 */
export const getCheckoutQuote = async (req: Request, res: Response) => {
    try {
        const { items, address, couponCode, useCoins } = req.body;
        const userId = req.user!.userId;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        await expireDueLots(userId);

        const ids = items
            .map((i: any) => i?.product?.id)
            .filter((id: any) => id && mongoose.isValidObjectId(id));
        const products = await Product.find({ _id: { $in: ids } });
        const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

        const lines: PricingLineInput[] = [];
        const itemsOut: any[] = [];
        const unavailable: any[] = [];

        for (const item of items) {
            const product: any = productMap.get(String(item?.product?.id));
            const qty = Number(item?.quantity) || 0;
            if (!product || qty <= 0) {
                unavailable.push({ productId: item?.product?.id, reason: "Product not found" });
                continue;
            }
            const variationValue = item.variant || item.variation;
            const selectedVariation = pickVariation(product, variationValue);
            const unitPrice = resolveItemUnitPrice(product, selectedVariation || variationValue);
            lines.push({ product, unitPrice, quantity: qty });
            itemsOut.push({
                productId: product._id,
                variation: variationValue,
                name: product.productName,
                unitPrice,
                quantity: qty,
            });
        }

        if (lines.length === 0) {
            return res.status(400).json({ success: false, message: "No valid items in cart", data: { unavailable } });
        }

        const lat = parseCoordinate(address?.latitude);
        const lng = parseCoordinate(address?.longitude);
        const sellerIds = Array.from(new Set(lines.map((l) => l.product.seller.toString())));
        const subtotal = lines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100;
        const fees = await calculateDeliveryStuff(subtotal, sellerIds.map((id) => ({ product: { seller: id } })), lat, lng);

        const pricing = await computeCheckoutPricing({
            customerId: userId,
            lines,
            platformFee: Number(fees.platformFee) || 0,
            deliveryFee: Number(fees.estimatedDeliveryFee) || 0,
            couponCode,
            useCoins: !!useCoins,
        });

        return res.status(200).json({
            success: true,
            data: {
                ...serializePricing(pricing),
                freeDeliveryThreshold: fees.freeDeliveryThreshold,
                estimatedDeliveryTime: fees.estimatedDeliveryTime,
                items: itemsOut.map((it, i) => ({ ...it, ...pricing.lines[i] })),
                unavailable,
            },
        });
    } catch (error: any) {
        console.error("Error computing checkout quote:", error);
        return res.status(500).json({ success: false, message: "Error computing checkout total", error: error.message });
    }
};

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
    let session: mongoose.ClientSession | null = null;
    try {
        // Expire any due coins first so the balance used below is accurate
        await expireDueLots(req.user!.userId);

        // Only start session if we are on a replica set (required for transactions)
        // For simplicity in local dev, we check and fallback if it fails
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionError) {
            console.warn("MongoDB Transactions not supported or failed to start. Proceeding without transaction.");
            session = null;
        }

        // Note: `fees` is intentionally not read from req.body — platformFee/deliveryFee
        // are always recomputed server-side below (see computedFees) to prevent tampering.
        const { items, address, paymentMethod, deliveryInstructions, couponCode, useCoins, expectedTotal } = req.body;
        const userId = req.user!.userId;

        // Log incoming request for debugging
        console.log("DEBUG: Order creation request:", {
            userId,
            itemsCount: items?.length,
            hasAddress: !!address,
            addressLat: address?.latitude,
            addressLng: address?.longitude,
            paymentMethod,
        });

        if (!items || items.length === 0) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Order must have at least one item",
            });
        }

        if (!address) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Delivery address is required",
            });
        }

        // Validate required address fields
        if (!address.city || (typeof address.city === 'string' && address.city.trim() === '')) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "City is required in delivery address",
                details: {
                    receivedCity: address.city,
                    addressObject: address
                }
            });
        }

        if (!address.pincode || (typeof address.pincode === 'string' && address.pincode.trim() === '')) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Pincode is required in delivery address",
                details: {
                    receivedPincode: address.pincode,
                    addressObject: address
                }
            });
        }

        // Fetch customer details
        const customer = await Customer.findById(userId);
        if (!customer) {
            if (session) await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Validate delivery address location
        // Handle both string and number types, and check for null/undefined (not truthy, since 0 is valid)
        const deliveryLat = address.latitude != null
            ? (typeof address.latitude === 'number' ? address.latitude : parseFloat(address.latitude))
            : null;
        const deliveryLng = address.longitude != null
            ? (typeof address.longitude === 'number' ? address.longitude : parseFloat(address.longitude))
            : null;

        if (deliveryLat == null || deliveryLng == null || isNaN(deliveryLat) || isNaN(deliveryLng)) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Delivery address location (latitude/longitude) is required",
                details: {
                    receivedLatitude: address.latitude,
                    receivedLongitude: address.longitude,
                    parsedLatitude: deliveryLat,
                    parsedLongitude: deliveryLng,
                }
            });
        }

        // Validate coordinates
        if (deliveryLat < -90 || deliveryLat > 90 || deliveryLng < -180 || deliveryLng > 180) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Invalid delivery address coordinates",
            });
        }

        // Initialize Order first to get an ID
        const newOrder = new Order({
            customer: new mongoose.Types.ObjectId(userId),
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            deliveryAddress: {
                address: address.address || address.street || 'N/A',
                city: address.city || 'N/A',
                state: address.state || '',
                pincode: address.pincode || '000000',
                landmark: address.landmark || '',
                latitude: deliveryLat,
                longitude: deliveryLng,
            },
            paymentMethod: paymentMethod || 'Online',
            paymentStatus: 'Pending', // Always Pending initially: Online goes Paid after gateway, COD stays Pending until delivery
            // Online-payment orders start as 'Pending' (hidden from sellers) until payment is verified
            status: (paymentMethod === 'Online') ? 'Pending' : 'Received',
            deliveryInstructions: deliveryInstructions || '',
            subtotal: 0,
            tax: 0,
            // shipping/platformFee are recomputed server-side below from AppSettings,
            // never trusted from the client (fees in req.body is display-only).
            shipping: 0,
            platformFee: 0,
            discount: 0,
            total: 0,
            items: []
        });

        const orderItemIds: mongoose.Types.ObjectId[] = [];
        const sellerIds = new Set<string>(); // Track unique sellers
        const pricingLines: PricingLineInput[] = [];
        const lineVariations: any[] = [];

        for (const item of items) {
            if (!item.product || !item.product.id) {
                throw new Error("Invalid item structure: product.id is missing");
            }

            const qty = Number(item.quantity) || 0;
            if (qty <= 0) {
                throw new Error("Invalid item quantity");
            }

            // Atomically check stock and decrement to prevent race conditions.
            // The frontend sends variation info as 'variant' or 'variation'
            // In the product model, it's stored in 'variations' array
            const variationValue = item.variant || item.variation;

            const product = await decrementProductStock(item.product.id, qty, variationValue, session);

            if (!product) {
                throw new Error(`Insufficient stock or product not found: ${item.product.name || 'ID: ' + item.product.id}${variationValue ? ' (' + variationValue + ')' : ''}`);
            }

            // Track seller IDs to validate location
            if (product.seller) {
                sellerIds.add(product.seller.toString());
            }

            // Determine the price based on variation and discounts
            const selectedVariation = pickVariation(product, variationValue);
            const itemPrice = resolveItemUnitPrice(product, selectedVariation || variationValue);

            pricingLines.push({ product, unitPrice: itemPrice, quantity: qty });
            lineVariations.push(variationValue);
        }

        // Validate all sellers can deliver to user's location
        if (sellerIds.size > 0) {
            const uniqueSellerIds = Array.from(sellerIds).map(id => new mongoose.Types.ObjectId(id));

            // Find sellers and check if user is within their service radius
            const sellers = await Seller.find({
                _id: { $in: uniqueSellerIds },
                status: "Approved",
                location: { $exists: true, $ne: null },
            });

            // Check each seller can deliver to user's location
            for (const seller of sellers) {
                if (!seller.location || !seller.location.coordinates) {
                    if (session) await session.abortTransaction();
                    return res.status(403).json({
                        success: false,
                        message: `Seller ${seller.storeName} does not have a valid location. Order cannot be placed.`,
                    });
                }

                const sellerLng = seller.location.coordinates[0];
                const sellerLat = seller.location.coordinates[1];
                const distance = calculateDistance(deliveryLat, deliveryLng, sellerLat, sellerLng);
                const serviceRadius = seller.serviceRadiusKm || 10;

                if (distance > serviceRadius) {
                    if (session) await session.abortTransaction();
                    return res.status(403).json({
                        success: false,
                        message: `Your delivery address is ${distance.toFixed(2)} km away from ${seller.storeName}. They only deliver within ${serviceRadius} km. Please select products from sellers in your area.`,
                    });
                }
            }
        }

        // Recompute fees server-side from AppSettings/seller distance (same logic the
        // cart summary uses) instead of trusting the client-supplied `fees` object,
        // which could otherwise be tampered with to reduce or zero out what's charged.
        const calculatedSubtotal = pricingLines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100;
        const sellerIdsForFees = Array.from(sellerIds).map((id) => ({ product: { seller: id } }));
        const computedFees = await calculateDeliveryStuff(calculatedSubtotal, sellerIdsForFees, deliveryLat, deliveryLng);
        const platformFee = Number(computedFees.platformFee) || 0;
        const deliveryFee = Number(computedFees.estimatedDeliveryFee) || 0;

        // Same pricing service as the checkout quote -> what the customer saw is what is charged
        const pricing = await computeCheckoutPricing({
            customerId: userId,
            lines: pricingLines,
            platformFee,
            deliveryFee,
            couponCode,
            useCoins: !!useCoins,
            session,
        });

        if (couponCode && !pricing.coupon.applied) {
            throw Object.assign(new Error(pricing.coupon.error || "Coupon could not be applied"), { statusCode: 400 });
        }
        if (expectedTotal != null && expectedTotal !== '' && Math.abs(Number(expectedTotal) - pricing.total) > 0.009) {
            throw Object.assign(
                new Error(`Your order total changed from ₹${Number(expectedTotal)} to ₹${pricing.total}. Please review and try again.`),
                { statusCode: 409, code: 'PRICE_CHANGED', quote: serializePricing(pricing) }
            );
        }

        // Create order items with their share of the platform-funded discount and coins to earn
        for (let i = 0; i < pricingLines.length; i++) {
            const { product, unitPrice, quantity } = pricingLines[i];
            const priced = pricing.lines[i];
            const newOrderItem = new OrderItem({
                order: newOrder._id,
                product: product._id,
                seller: product.seller,
                productName: product.productName,
                productImage: product.mainImage,
                sku: product.sku,
                unitPrice,
                quantity,
                total: priced.lineTotal,
                discountShare: priced.discountShare,
                loyaltyCoins: priced.loyaltyCoins,
                variation: lineVariations[i],
                status: 'Pending'
            });
            if (session) {
                await newOrderItem.save({ session });
            } else {
                await newOrderItem.save();
            }
            orderItemIds.push(newOrderItem._id as mongoose.Types.ObjectId);
        }

        // Update Order with calculated values and items
        newOrder.subtotal = pricing.subtotal;
        newOrder.shipping = pricing.deliveryFee;
        newOrder.platformFee = pricing.platformFee;
        newOrder.discount = pricing.totalDiscount;
        newOrder.total = pricing.total;
        newOrder.items = orderItemIds;

        newOrder.orderSequenceNumber = pricing.orderSequence.orderNumber;
        newOrder.orderSequencePercent = pricing.orderSequence.percent;
        newOrder.orderSequenceDiscount = pricing.orderSequence.discount;
        if (pricing.coupon.applied && pricing.coupon.couponId) {
            newOrder.coupon = new mongoose.Types.ObjectId(pricing.coupon.couponId);
            newOrder.couponCode = pricing.coupon.code;
            newOrder.couponDiscount = pricing.coupon.discount;
        }
        newOrder.loyaltyCoinsPerRupee = pricing.loyalty.coinsPerRupee;
        newOrder.loyaltyCoinsRedeemed = pricing.loyalty.coinsUsed;
        newOrder.loyaltyDiscount = pricing.loyalty.discount;
        newOrder.loyaltyRedeemStatus = pricing.loyalty.coinsUsed > 0 ? "Redeemed" : "None";
        newOrder.loyaltyCoinsToEarn = pricing.coinsToEarn;
        newOrder.loyaltyEarnStatus = pricing.coinsToEarn > 0 ? "Pending" : "None";

        // Initialize sellerAcceptances for per-seller tracking.
        // COD amounts are split in paise so they always add up to the order total exactly.
        const uniqueSellers = Array.from(sellerIds);
        newOrder.sellerAcceptances = uniqueSellers.map(sellerId => ({
            seller: new mongoose.Types.ObjectId(sellerId),
            status: "Pending",
            codAmountToCollect: paymentMethod === 'COD' ? (pricing.sellerAmounts.get(sellerId) || 0) : 0
        }));

        // Generates orderNumber (pre-validate hook) so the ledger can reference it
        await newOrder.validate();

        if (pricing.coupon.applied && pricing.coupon.couponId) {
            await consumeCouponUsage(pricing.coupon.couponId, session);
        }
        if (pricing.loyalty.coinsUsed > 0) {
            await redeemCoinsForOrder({
                customerId: userId,
                coins: pricing.loyalty.coinsUsed,
                coinsPerRupee: pricing.loyalty.coinsPerRupee,
                orderId: newOrder._id,
                orderNumber: newOrder.orderNumber,
                session,
            });
        }

        if (session) {
            await newOrder.save({ session });
            await session.commitTransaction();
        } else {
            // Validate before saving to catch errors with details
            const validationError = newOrder.validateSync();
            if (validationError) {
                console.error("DEBUG: Order Validation Error:", validationError.errors);
                throw validationError;
            }
            await newOrder.save();
        }


        // Emit notification to sellers — only for COD orders.
        // Online-payment orders start as 'Pending' and sellers are notified
        // only after successful payment verification (in paymentRoutes.ts).
        if (newOrder.paymentMethod !== 'Online') {
            try {
                const io: SocketIOServer = (req.app.get("io") as SocketIOServer);
                if (io) {
                    // Reload order to ensure orderNumber is set (generated by pre-validate hook)
                    const savedOrder = await Order.findById(newOrder._id).lean();
                    if (savedOrder) {
                        await notifySellersOfOrderUpdate(io, savedOrder, 'NEW_ORDER');
                    }
                }
            } catch (notificationError) {
                // Log error but don't fail the order creation
                console.error("Error notifying sellers:", notificationError);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: newOrder,
            pricing: serializePricing(pricing),
        });

    } catch (error: any) {
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error("Error aborting transaction:", abortError);
            }
        }

        console.error("DEBUG: Order Creation Error Detail:", {
            message: error.message,
            name: error.name,
            errors: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message,
                value: error.errors[key].value
            })) : undefined,
            stack: error.stack,
            body: req.body
        });

        // Return a more informative error message if it's a validation error
        let errorMessage = "Error creating order. " + error.message;
        let statusCode = 500;

        if (error.statusCode) {
            statusCode = error.statusCode;
            errorMessage = error.message;
        } else if (error.name === 'ValidationError') {
            statusCode = 400;
            const fields = Object.keys(error.errors).join(', ');
            errorMessage = `Validation failed for fields: ${fields}. ${error.message}`;
        } else if (error.message.includes('Insufficient stock') || error.message.includes('Invalid item')) {
            statusCode = 400;
        }

        return res.status(statusCode).json({
            success: false,
            message: errorMessage,
            code: error.code,
            quote: error.quote,
            error: error.message,
            details: error.errors,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (session) session.endSession();
    }
};

// Get authenticated customer's orders
export const getMyOrders = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { status, page = 1, limit = 10 } = req.query;

        const query: any = { customer: userId };

        if (status) {
            query.status = status; // Note: Model field is 'status', not 'orderStatus'
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(query)
            .populate({
                path: 'items',
                populate: [
                    { path: 'product', select: 'productName mainImage price' },
                    { path: 'seller', select: 'storeName city' }
                ]
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Order.countDocuments(query);

        // Transform orders to match frontend Order type
        const transformedOrders = orders.map(order => {
            const orderObj = order.toObject();
            return {
                ...orderObj,
                id: orderObj._id.toString(),
                totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
                totalAmount: orderObj.total,
                fees: {
                    platformFee: orderObj.platformFee || 0,
                    deliveryFee: orderObj.shipping || 0
                },
                // Keep original fields for backward compatibility
                subtotal: orderObj.subtotal,
                address: orderObj.deliveryAddress
            };
        });

        return res.status(200).json({
            success: true,
            data: transformedOrders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching orders",
            error: error.message,
        });
    }
};

// Get single order details
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        // Find order and ensure it belongs to the user
        const order = await Order.findOne({ _id: id, customer: userId })
            .populate({
                path: 'items',
                populate: [
                    { path: 'product', select: 'productName mainImage pack manufacturer price isReturnable maxReturnDays' },
                    { path: 'seller', select: 'storeName city phone fssaiLicNo' }
                ]
            })
            .populate('deliveryBoy', 'name phone profileImage vehicleNumber');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Get customer's permanent delivery OTP
        const customer = await Customer.findById(userId).select('deliveryOtp');
        const deliveryOtp = customer?.deliveryOtp;

        // Transform order to match frontend Order type
        const orderObj = order.toObject();
        const transformedOrder = {
            ...orderObj,
            id: orderObj._id.toString(),
            totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
            totalAmount: orderObj.total,
            fees: {
                platformFee: orderObj.platformFee || 0,
                deliveryFee: orderObj.shipping || 0
            },
            // Keep original fields for backward compatibility
            subtotal: orderObj.subtotal,
            address: orderObj.deliveryAddress,
            // Include invoice enabled flag
            invoiceEnabled: orderObj.invoiceEnabled || false,
            // Include customer's permanent delivery OTP
            deliveryOtp,
            // Map deliveryBoy to deliveryPartner for frontend
            deliveryPartner: orderObj.deliveryBoy
        };

        return res.status(200).json({
            success: true,
            data: transformedOrder,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching order detail",
            error: error.message,
        });
    }
};

/**
 * Refresh Delivery OTP
 */
export const refreshDeliveryOtp = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: "Order is already delivered" });
        }

        // Generate and send new OTP
        const result = await generateDeliveryOtp(id);

        // Emit socket event if needed (customer room)
        const io = (req.app as any).get("io");
        if (io) {
            io.to(`order-${id}`).emit('delivery-otp-refreshed', {
                orderId: id,
                deliveryOtp: order.deliveryOtp, // The service saves it to the order
                expiresAt: order.deliveryOtpExpiresAt
            });
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error refreshing delivery OTP:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to refresh delivery OTP",
            error: error.message
        });
    }
};

// Cancel Order
export const cancelOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Policy: once an order is placed (COD, or online after successful payment)
        // the customer cannot cancel it or any product in it.
        if (!isUnpaidOnlineOrder(order)) {
            return res.status(400).json({
                success: false,
                message: "Orders cannot be cancelled once placed. Please contact support for help.",
            });
        }

        // Online payment did not complete: the order was never placed, so abort it
        // and restore any reserved stock, coins and coupon use.
        const aborted = await abortUnpaidOnlineOrder(
            order._id.toString(),
            (reason && String(reason).trim()) || "Online payment not completed",
            userId
        );
        if (!aborted) {
            return res.status(409).json({
                success: false,
                message: "This order's payment has already been completed, so it can no longer be cancelled.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order cancelled. Any coins used have been returned to your wallet.",
            data: {
                id: aborted._id,
                status: aborted.status,
                cancelledAt: aborted.cancelledAt
            }
        });
    } catch (error: any) {
        console.error("Error cancelling order:", error);
        return res.status(500).json({
            success: false,
            message: "Error cancelling order",
            error: error.message,
        });
    }
};


// Update Order Notes (Instructions/Special Requests)
export const updateOrderNotes = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { deliveryInstructions, specialRequests } = req.body;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (['Delivered', 'Cancelled', 'Returned'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot update notes for ${order.status} order`
            });
        }

        if (deliveryInstructions !== undefined) order.deliveryInstructions = deliveryInstructions;
        if (specialRequests !== undefined) order.specialRequests = specialRequests;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order notes updated",
            data: {
                deliveryInstructions: order.deliveryInstructions,
                specialRequests: order.specialRequests
            }
        });
    } catch (error: any) {
        console.error('Error updating order notes:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update order notes",
            error: error.message
        });
    }
};
