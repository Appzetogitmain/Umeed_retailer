import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import OrderItem from "../../../models/OrderItem";
import Seller from "../../../models/Seller";
import Return from "../../../models/Return";
import { generateDeliveryOtp, verifyDeliveryOtp } from "../../../services/deliveryOtpService";
import { processOrderStatusTransition } from "../../../services/orderService";

/**
 * Helper to get clean string ID from ObjectId or populated object
 */
const getIdStr = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'object') {
        if (obj._id) return obj._id.toString();
        if (obj.id) return obj.id.toString();
    }
    return obj.toString();
};

/**
 * Helper to map order items for response
 */
const mapOrderItems = (items: any[]) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map((item: any) => ({
        name: item.productName || "Unknown Item",
        quantity: item.quantity || 0,
        price: item.total || 0, // Using total price for the line item
        image: item.productImage
    }));
};

/**
 * Get All Orders History
 * Returns all past orders with pagination
 */
export const getAllOrdersHistory = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const riderQuery = {
        $or: [
            { deliveryBoy: deliveryId },
            { "sellerAcceptances.deliveryBoy": deliveryId }
        ]
    };

    const orders = await Order.find(riderQuery)
        .populate("items") // Populate OrderItems
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Order.countDocuments(riderQuery);

    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,

        address: `${order.deliveryAddress.address}, ${order.deliveryAddress.city}`,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.total,
        items: mapOrderItems(order.items),
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'
    }));

    res.status(200).json({
        success: true,
        data: formattedOrders,
        pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
        }
    });
});

/**
 * Get Today's Assigned Orders
 */
export const getTodayOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const orders = await Order.find({
        $or: [
            { deliveryBoy: deliveryId },
            { "sellerAcceptances.deliveryBoy": deliveryId }
        ],
        $and: [
            {
                $or: [
                    { createdAt: { $gte: todayStart, $lte: todayEnd } }, // Created today
                    { updatedAt: { $gte: todayStart, $lte: todayEnd } }  // OR Updated today
                ]
            }
        ]
    })
        .populate("items")
        .sort({ updatedAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,

        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        deliveryAddress: order.deliveryAddress,
        items: mapOrderItems(order.items), // Real items
        totalAmount: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        createdAt: order.createdAt,
        // Distance calculation to be implemented. sending null/undefined for now to avoid fake data
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Pending Orders
 */
export const getPendingOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    // Pending statuses: Ready for pickup, Out for delivery, Picked Up, Assigned, In Transit
    const orders = await Order.find({
        $or: [
            { deliveryBoy: deliveryId },
            { "sellerAcceptances.deliveryBoy": deliveryId }
        ],
        status: { $in: ["Ready for pickup", "Out for Delivery", "Picked Up", "Assigned", "In Transit", "Accepted", "Processed"] }
    })
        .populate("items")
        .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        items: mapOrderItems(order.items), // Real items
        totalAmount: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        createdAt: order.createdAt,
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Specific Order Details
 */
export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id).populate({
        path: 'items',
        populate: { path: 'seller' }
    });

    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Filter items and calculation for this rider
    let assignedItems = order.items || [];
    let codTotalAmount = 0;

    if (order.sellerAcceptances && order.sellerAcceptances.length > 0 && deliveryId) {
        const myAcceptances = order.sellerAcceptances.filter((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));
        if (myAcceptances.length > 0) {
            const mySellerIds = new Set(myAcceptances.map((sa: any) => getIdStr(sa.seller)));
            assignedItems = (order.items || []).filter((item: any) => {
                const itemSellerId = getIdStr(item.seller);
                return mySellerIds.has(itemSellerId);
            });
            codTotalAmount = myAcceptances.reduce((sum: number, sa: any) => sum + (sa.codAmountToCollect || 0), 0);
        }
    }

    // Calculate rider earning dynamically
    let riderEarning = 0;
    try {
        if (order.riderEarningBreakdown && order.riderEarningBreakdown.totalEarning > 0) {
            riderEarning = order.riderEarningBreakdown.totalEarning;
        } else {
            const { calculateDynamicRiderEarning } = await import('../../../services/commissionService');
            const dynamicEarning = await calculateDynamicRiderEarning(order);
            riderEarning = dynamicEarning.totalEarning;
        }
    } catch (err) {
        console.error("Error calculating rider earning for order details:", err);
        riderEarning = 40; // absolute fallback
    }

    // Ensure we always have a minimum earning (at least shipping fee or a standard minimum payout like 40)
    const minEarning = order.shipping || 40;
    if (riderEarning < minEarning) {
        riderEarning = minEarning;
    }

    riderEarning = Math.round(riderEarning * 100) / 100;

    // Determine this rider's specific delivery status
    let riderDeliveryStatus = order.status;
    if (order.sellerAcceptances && order.sellerAcceptances.length > 0 && deliveryId) {
        const myAcceptancesForStatus = order.sellerAcceptances.filter((sa: any) =>
            sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId)
        );
        if (myAcceptancesForStatus.length > 0) {
            const allMyItemsDelivered = myAcceptancesForStatus.every((sa: any) =>
                sa.deliveryBoyStatus === 'Delivered' || sa.status === 'Delivered'
            );
            if (allMyItemsDelivered) {
                riderDeliveryStatus = 'Delivered';
            }
        }
    }

    const formattedOrder = {
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        deliveryAddress: order.deliveryAddress,
        status: order.status,
        riderStatus: riderDeliveryStatus, // Per-rider delivery status
        items: mapOrderItems(assignedItems), // Real populated items for this rider
        totalAmount: codTotalAmount > 0 ? codTotalAmount : order.total,
        riderEarning: riderEarning, // Added rider earning
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        distance: null
    };

    return res.status(200).json({
        success: true,
        data: formattedOrder
    });
});

/**
 * Update Order Status
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Save previous status before updating
    const previousStatus = order.status;

    // Status transition logic
    if (status) order.status = status;

    if (status === 'Picked up' || status === 'Out for Delivery') {
        order.deliveryBoyStatus = 'Picked Up';
    } else if (status === 'Delivered') {
        order.deliveryBoyStatus = 'Delivered';
        order.deliveredAt = new Date();
        order.paymentStatus = 'Paid'; // Assume paid on delivery (or already paid)

        // Commissions and COD will be handled by processOrderStatusTransition below
        try {
            await processOrderStatusTransition(id, 'Delivered', previousStatus);
        } catch (transitionError: any) {
            console.error('Error processing order status transition:', transitionError);
            // Continue even if transition fails
        }
    }

    await order.save();

    // Emit socket events for status changes
    const io = (req.app as any).get("io");
    if (io) {
        if (status === 'Picked up' && previousStatus !== 'Picked up') {
            // Emit order-taken event
            io.to(`order-${id}`).emit('order-taken', {
                orderId: id,
                message: 'Order has been picked up from seller',
            });
        }

        if (status === 'Delivered' && previousStatus !== 'Delivered') {
            // Emit order-delivered event to all relevant parties
            io.to(`order-${id}`).emit('order-delivered', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Order has been delivered successfully',
            });

            // Also emit to delivery boy room
            io.to(`delivery-${deliveryId}`).emit('order-delivered', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Order delivered successfully',
            });
        }

        // Trigger notification to sellers for payment status change or specific transitions
        if (order.paymentStatus === 'Paid' || status === 'Delivered') {
            notifySellersOfOrderUpdate(io, order, 'STATUS_UPDATE');
        }
    }

    return res.status(200).json({
        success: true,
        message: `Order status updated to ${status}`,
        data: order
    });
});

/**
 * Get Return Orders
 */
export const getReturnOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const orders = await Order.find({
        $or: [
            { deliveryBoy: deliveryId },
            { "sellerAcceptances.deliveryBoy": deliveryId }
        ],
        status: { $in: ["Returned", "Cancelled", "Rejected"] }
    })
        .populate("items")
        .sort({ updatedAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        items: mapOrderItems(order.items),
        totalAmount: order.total,
        createdAt: order.createdAt,
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Seller Locations for Order
 * Returns all unique seller shop locations for items in this order
 */
export const getSellerLocationsForOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    // Verify order exists
    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Get seller IDs assigned specifically to THIS delivery boy
    let sellerIds: string[] = [];
    if (order.sellerAcceptances && order.sellerAcceptances.length > 0 && deliveryId) {
        const myAcceptances = order.sellerAcceptances.filter((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));
        if (myAcceptances.length > 0) {
            sellerIds = myAcceptances.map((sa: any) => getIdStr(sa.seller));
        }
    }

    if (sellerIds.length === 0) {
        const orderItems = await OrderItem.find({ order: id });
        sellerIds = [...new Set(orderItems.map(item => item.seller.toString()))];
    }

    // Get seller details including locations
    const sellers = await Seller.find({ _id: { $in: sellerIds } })
        .select('storeName address city latitude longitude');

    // Format seller locations
    const sellerLocations = sellers
        .filter(seller => seller.latitude && seller.longitude) // Only include sellers with location data
        .map(seller => ({
            sellerId: seller._id.toString(),
            storeName: seller.storeName,
            address: seller.address,
            city: seller.city,
            latitude: parseFloat(seller.latitude || '0'),
            longitude: parseFloat(seller.longitude || '0'),
        }));

    return res.status(200).json({
        success: true,
        data: sellerLocations
    });
});

/**
 * Send Delivery OTP
 * Generates and sends OTP to customer
 */
export const sendDeliveryOtp = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    console.log(`[sendOTP] orderId=${id}, deliveryId=${deliveryId}, isAssigned=${isAssigned}, order.status=${order.status}`);
    console.log(`[sendOTP] sellerAcceptances=`, JSON.stringify(order.sellerAcceptances?.map((sa: any) => ({
        deliveryBoy: sa.deliveryBoy?.toString(),
        status: sa.status,
        deliveryBoyStatus: sa.deliveryBoyStatus,
    }))));

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    const isAlreadyDelivered = order.status === 'Delivered' ||
        (order.sellerAcceptances && order.sellerAcceptances.length > 0 &&
         order.sellerAcceptances.every((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId) ? (sa.deliveryBoyStatus === 'Delivered' || sa.status === 'Delivered') : true) &&
         order.sellerAcceptances.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId)));

    if (isAlreadyDelivered) {
        return res.status(400).json({ success: false, message: "Order is already delivered" });
    }

    const isReadyForOtp = order.status === 'Picked up' || order.status === 'Out for Delivery' ||
        order.sellerAcceptances?.some((sa: any) =>
            sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId) &&
            ['Picked Up', 'In Transit', 'Out for Delivery', 'Assigned'].includes(sa.deliveryBoyStatus)
        );

    console.log(`[sendOTP] isReadyForOtp=${isReadyForOtp}`);

    if (!isReadyForOtp) {
        return res.status(400).json({ success: false, message: "Order must be picked up before sending delivery OTP" });
    }

    try {
        const result = await generateDeliveryOtp(id);

        // Emit otp-sent event to delivery boy
        const io = (req.app as any).get("io");
        if (io) {
            io.to(`delivery-${deliveryId}`).emit('otp-sent', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Delivery OTP sent to customer',
            });
            // Also emit to customer tracking page
            io.to(`order-${id}`).emit('otp-sent', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Delivery partner has requested OTP',
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to send delivery OTP"
        });
    }
});

/**
 * Verify Delivery OTP and mark order as delivered
 */
export const verifyDeliveryOtpController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;
    const deliveryId = req.user?.userId;

    console.log(`[verifyOTP] orderId=${id}, deliveryId=${deliveryId}, otp=${otp}`);

    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
    }

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log(`[verifyOTP] order.deliveryBoy=${order.deliveryBoy}, order.status=${order.status}`);
    console.log(`[verifyOTP] sellerAcceptances=`, JSON.stringify(order.sellerAcceptances?.map((sa: any) => ({
        seller: sa.seller?.toString(),
        deliveryBoy: sa.deliveryBoy?.toString(),
        status: sa.status,
        deliveryBoyStatus: sa.deliveryBoyStatus,
    }))));

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    console.log(`[verifyOTP] isAssigned=${isAssigned}`);

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    try {
        const previousStatus = order.status;
        const result = await verifyDeliveryOtp(id, otp, deliveryId);
        // Note: verifyDeliveryOtp is from service, not this controller

        // Reload order to get updated status
        const updatedOrder = await Order.findById(id);

        // Process order status transition for financial transactions
        if (updatedOrder && updatedOrder.status === 'Delivered' && previousStatus !== 'Delivered') {
            try {
                await processOrderStatusTransition(id, 'Delivered', previousStatus);
            } catch (transitionError: any) {
                console.error('Error processing order status transition:', transitionError);
                // Continue even if transition fails - order is already marked as delivered
            }
        }

        // Update delivery boy balance and cash collected (if COD)
        if (updatedOrder && updatedOrder.status === 'Delivered') {
            // Commissions and COD are handled by processOrderStatusTransition called above



            // Emit socket events for real-time status update
            const io = (req.app as any).get("io");
            if (io && previousStatus !== 'Delivered') {
                // Emit order-delivered event to customer
                io.to(`order-${id}`).emit('order-delivered', {
                    orderId: id,
                    orderNumber: updatedOrder.orderNumber,
                    message: 'Order has been delivered successfully',
                });

                // Also emit to delivery boy room
                io.to(`delivery-${deliveryId}`).emit('order-delivered', {
                    orderId: id,
                    orderNumber: updatedOrder.orderNumber,
                    message: 'Order delivered successfully',
                });

                // Notify sellers of status update
                notifySellersOfOrderUpdate(io, updatedOrder, 'STATUS_UPDATE');
            }
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: updatedOrder
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to verify delivery OTP"
        });
    }
});

/**
 * Check Proximity to Seller
 * Checks if delivery boy is within 500m of a specific seller
 */
export const checkSellerProximity = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sellerId, latitude, longitude } = req.body;
    const deliveryId = req.user?.userId;

    if (!sellerId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Seller ID, latitude, and longitude are required" });
    }

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Get seller location
    const seller = await Seller.findById(sellerId).select('latitude longitude storeName');
    if (!seller || !seller.latitude || !seller.longitude) {
        return res.status(404).json({ success: false, message: "Seller location not found" });
    }

    // Calculate distance using locationHelper
    const { calculateDistance } = await import('../../../utils/locationHelper');
    const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(seller.latitude),
        parseFloat(seller.longitude)
    );

    const withinRange = distance <= 0.5; // 500m = 0.5km

    return res.status(200).json({
        success: true,
        data: {
            withinRange,
            distance: distance.toFixed(3), // in km
            distanceMeters: Math.round(distance * 1000), // in meters
            sellerName: seller.storeName
        }
    });
});

/**
 * Confirm Seller Pickup
 * Confirms pickup from a specific seller and updates order status
 */
export const confirmSellerPickup = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sellerId, latitude, longitude } = req.body;
    const deliveryId = req.user?.userId;

    if (!sellerId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Seller ID, latitude, and longitude are required" });
    }

    const order = await Order.findById(id).populate('items');
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Verify proximity to seller
    const seller = await Seller.findById(sellerId).select('latitude longitude storeName');
    if (!seller || !seller.latitude || !seller.longitude) {
        return res.status(404).json({ success: false, message: "Seller location not found" });
    }

    const { calculateDistance } = await import('../../../utils/locationHelper');
    const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(seller.latitude),
        parseFloat(seller.longitude)
    );

    if (distance > 0.5) { // 500m = 0.5km
        return res.status(400).json({
            success: false,
            message: `You must be within 500 meters of the seller to confirm pickup. Current distance: ${Math.round(distance * 1000)}m`
        });
    }

    // Check if this seller is already picked up
    const existingPickup = order.sellerPickups?.find(
        (pickup: any) => getIdStr(pickup.seller) === getIdStr(sellerId)
    );

    if (existingPickup && existingPickup.pickedUpAt) {
        return res.status(400).json({
            success: false,
            message: "This seller has already been picked up"
        });
    }

    // Get seller IDs assigned specifically to THIS rider
    let assignedSellerIds: string[] = [];
    if (order.sellerAcceptances && order.sellerAcceptances.length > 0 && deliveryId) {
        assignedSellerIds = order.sellerAcceptances
            .filter((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId))
            .map((sa: any) => getIdStr(sa.seller));
    }

    if (assignedSellerIds.length === 0) {
        const orderItems = await OrderItem.find({ order: id });
        assignedSellerIds = [...new Set(orderItems.map(item => getIdStr(item.seller)))];
    }

    // Initialize sellerPickups array if it doesn't exist
    if (!order.sellerPickups) {
        order.sellerPickups = [];
    }

    // Add or update pickup confirmation for this seller
    const pickupIndex = order.sellerPickups.findIndex(
        (pickup: any) => getIdStr(pickup.seller) === getIdStr(sellerId)
    );

    const pickupData = {
        seller: sellerId,
        pickedUpAt: new Date(),
        pickedUpBy: deliveryId,
        latitude,
        longitude
    };

    if (pickupIndex >= 0) {
        order.sellerPickups[pickupIndex] = pickupData as any;
    } else {
        order.sellerPickups.push(pickupData as any);
    }

    // Update sellerAcceptances status if present
    if (order.sellerAcceptances) {
        const saIdx = order.sellerAcceptances.findIndex((sa: any) => 
            getIdStr(sa.seller) === getIdStr(sellerId)
        );
        if (saIdx !== -1) {
            order.sellerAcceptances[saIdx].deliveryBoyStatus = 'Picked Up';
            order.sellerAcceptances[saIdx].pickedUpAt = new Date();
        }
    }

    // Check if all assigned sellers for this rider have been picked up
    const pickedUpSellerIds = order.sellerPickups
        .filter((pickup: any) => pickup.pickedUpAt)
        .map((pickup: any) => getIdStr(pickup.seller));

    const allPickedUp = assignedSellerIds.every(sId => pickedUpSellerIds.includes(sId));

    // Automatically transition to "Out for Delivery" if all assigned sellers for this rider are picked up
    if (allPickedUp && order.status !== 'Delivered') {
        order.status = 'Out for Delivery';
        order.deliveryBoyStatus = 'In Transit';
    }

    await order.save();

    // Emit socket event
    const io = (req.app as any).get("io");
    if (io) {
        io.to(`order-${id}`).emit('seller-pickup-confirmed', {
            orderId: id,
            orderNumber: order.orderNumber,
            sellerId,
            sellerName: seller.storeName,
            allPickedUp,
            newStatus: order.status
        });

        if (allPickedUp) {
            io.to(`delivery-${deliveryId}`).emit('all-sellers-picked-up', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'All items picked up. Order is now Out for Delivery.'
            });
        }
    }

    return res.status(200).json({
        success: true,
        message: allPickedUp
            ? "All sellers picked up! Order status changed to Out for Delivery."
            : `Pickup confirmed from ${seller.storeName}`,
        data: {
            order,
            allPickedUp,
            pickedUpSellers: pickedUpSellerIds.length,
            totalSellers: assignedSellerIds.length
        }
    });
});

/**
 * Check Proximity to Customer
 * Checks if delivery boy is within 500m of customer delivery address
 */
export const checkCustomerProximity = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const deliveryId = req.user?.userId;

    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
    }

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isAssigned = getIdStr(order.deliveryBoy) === getIdStr(deliveryId) ||
        order.sellerAcceptances?.some((sa: any) => sa.deliveryBoy && getIdStr(sa.deliveryBoy) === getIdStr(deliveryId));

    if (!isAssigned) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Get customer location from delivery address
    const customerLat = order.deliveryAddress?.latitude;
    const customerLng = order.deliveryAddress?.longitude;

    if (!customerLat || !customerLng) {
        return res.status(400).json({
            success: false,
            message: "Customer delivery address coordinates not available"
        });
    }

    // Calculate distance
    const { calculateDistance } = await import('../../../utils/locationHelper');
    const distance = calculateDistance(
        latitude,
        longitude,
        customerLat,
        customerLng
    );

    const withinRange = distance <= 0.5; // 500m = 0.5km

    return res.status(200).json({
        success: true,
        data: {
            withinRange,
            distance: distance.toFixed(3), // in km
            distanceMeters: Math.round(distance * 1000), // in meters
            customerName: order.customerName
        }
    });
});

/**
 * Get Available Return Pickups (Broadcasted return requests with no rider assigned)
 */
export const getAvailableReturnPickups = asyncHandler(async (req: Request, res: Response) => {
    // Available return requests are approved but don't have a delivery boy assigned yet
    const returns = await Return.find({
        status: "Approved",
        deliveryBoy: null,
        deliveryBoyStatus: "Pending"
    })
        .populate({
            path: "orderItem",
            select: "productName productImage quantity unitPrice total variation"
        })
        .populate("order", "orderNumber customerName customerPhone deliveryAddress paymentMethod")
        .sort({ updatedAt: -1 });

    const formattedReturns = returns.map((ret: any) => ({
        id: ret._id,
        orderId: ret.order?.orderNumber,
        customerName: ret.order?.customerName,
        customerPhone: ret.order?.customerPhone,
        pickupAddress: ret.pickupAddress || (ret.order?.deliveryAddress ? `${ret.order.deliveryAddress.address}, ${ret.order.deliveryAddress.city}` : "N/A"),
        productName: ret.orderItem?.productName || "Unknown Item",
        quantity: ret.quantity,
        totalAmount: ret.orderItem?.total || 0,
        status: ret.status,
        deliveryBoyStatus: ret.deliveryBoyStatus,
        reason: ret.reason,
        description: ret.description,
        images: ret.images || [],
        createdAt: ret.createdAt
    }));

    return res.status(200).json({
        success: true,
        data: formattedReturns
    });
});

/**
 * Get Active Return Pickups for current delivery partner
 */
export const getActiveReturnPickups = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const returns = await Return.find({
        deliveryBoy: deliveryId,
        deliveryBoyStatus: { $in: ["Accepted", "Picked Up"] }
    })
        .populate({
            path: "orderItem",
            select: "productName productImage quantity unitPrice total variation"
        })
        .populate("order", "orderNumber customerName customerPhone deliveryAddress paymentMethod")
        .sort({ updatedAt: -1 });

    const formattedReturns = returns.map((ret: any) => ({
        id: ret._id,
        orderId: ret.order?.orderNumber,
        customerName: ret.order?.customerName,
        customerPhone: ret.order?.customerPhone,
        pickupAddress: ret.pickupAddress || (ret.order?.deliveryAddress ? `${ret.order.deliveryAddress.address}, ${ret.order.deliveryAddress.city}` : "N/A"),
        productName: ret.orderItem?.productName || "Unknown Item",
        quantity: ret.quantity,
        totalAmount: ret.orderItem?.total || 0,
        status: ret.status,
        deliveryBoyStatus: ret.deliveryBoyStatus,
        reason: ret.reason,
        description: ret.description,
        images: ret.images || [],
        createdAt: ret.createdAt
    }));

    return res.status(200).json({
        success: true,
        data: formattedReturns
    });
});

/**
 * Accept Return Pickup (Rider self-assignment)
 */
export const acceptReturnPickup = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // Return Request ID
    const deliveryId = req.user?.userId;

    const returnRequest = await Return.findById(id);
    if (!returnRequest) {
        return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (returnRequest.deliveryBoy) {
        return res.status(400).json({ success: false, message: "This pickup is already assigned to another rider" });
    }

    if (returnRequest.status !== "Approved") {
        return res.status(400).json({ success: false, message: "This return request is not approved yet" });
    }

    returnRequest.deliveryBoy = deliveryId as any;
    returnRequest.deliveryBoyStatus = "Accepted";
    returnRequest.pickupScheduled = new Date();
    await returnRequest.save();

    return res.status(200).json({
        success: true,
        message: "You have accepted this return pickup request",
        data: returnRequest
    });
});

/**
 * Update Return Pickup Status by Rider
 */
export const updateReturnPickupStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // Return Request ID
    const { status } = req.body; // "Picked Up" or "Completed" (Rider delivered back to seller)
    const deliveryId = req.user?.userId;

    if (!["Picked Up", "Completed"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status. Must be Picked Up or Completed" });
    }

    const returnRequest = await Return.findById(id);
    if (!returnRequest) {
        return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (returnRequest.deliveryBoy?.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "You are not assigned to this pickup request" });
    }

    returnRequest.deliveryBoyStatus = status as any;

    if (status === "Completed") {
        // When rider confirms they delivered it back to the seller:
        returnRequest.status = "Completed"; // Mark return request status as Completed (Admin can now refund)
        returnRequest.pickupCompleted = new Date();
    }

    await returnRequest.save();

    return res.status(200).json({
        success: true,
        message: `Pickup status updated to ${status} successfully`,
        data: returnRequest
    });
});
