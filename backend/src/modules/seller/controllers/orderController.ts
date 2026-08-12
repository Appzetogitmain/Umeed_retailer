import { Request, Response } from "express";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import AppSettings from "../../../models/AppSettings";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import WalletTransaction from "../../../models/WalletTransaction";
import { notifyDeliveryBoysOfNewOrder } from "../../../services/orderNotificationService";
import { Server as SocketIOServer } from "socket.io";

/**
 * Get seller's orders with filters, sorting, and pagination
 */
export const getOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      status,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    // Find all order IDs that contain items from this seller
    const orderItems = await OrderItem.find({ seller: sellerId }).distinct("order");

    // Build query - filter by orders containing this seller's items
    // POS (in-store) sales are excluded from this online-order view; they have
    // their own dedicated history at /seller/pos/orders.
    const query: any = { _id: { $in: orderItems }, source: { $ne: "POS" } };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Status filter
    if (status && status !== 'All Status') {
      // Map frontend status to backend status
      const statusMapping: Record<string, string> = {
        'Pending': 'Pending',
        'Accepted': 'Accepted',
        'On the way': 'On the way',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled',
        'Rejected': 'Rejected',
      };
      query.status = statusMapping[status as string] || status;
    } else {
      // Always exclude 'Pending' orders (= online-payment orders not yet paid)
      // from the seller's default view. They will move to 'Received' after payment.
      query.status = { $ne: 'Pending' };
    }


    // Search filter
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
        { 'deliveryAddress.name': { $regex: search, $options: "i" } },
        { 'deliveryAddress.phone': { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Get orders with populated customer and delivery info
    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Format response for frontend
    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderId: order.orderNumber,
      deliveryDate: order.estimatedDeliveryDate
        ? order.estimatedDeliveryDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : order.orderDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      orderDate: order.orderDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      status: (() => {
        const sellerAcceptance = order.sellerAcceptances?.find((sa: any) => sa.seller.toString() === sellerId.toString());
        let stat = sellerAcceptance ? sellerAcceptance.status : order.status;
        return (stat === 'Out for Delivery' || stat === 'Out For Delivery') ? 'On the way' : stat;
      })(),
      amount: order.total,
      customerName: (order.customer as any)?.name || order.customerName || '',
      customerPhone: (order.customer as any)?.phone || order.customerPhone || '',
      deliveryBoyName: (order.deliveryBoy as any)?.name || '',
    }));

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: formattedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get order by ID with populated order items, customer, and delivery info
 */
export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    // First check if this seller has items in this order
    // First check if this seller has items in this order
    const sellerItems = await OrderItem.find({ order: id, seller: sellerId })
      .populate("seller", "storeName")
      .populate("product");

    if (!sellerItems || sellerItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get order with populated data
    const order = await Order.findById(id)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile email");

    const settings = await AppSettings.findOne().select("contactEmail contactPhone supportEmail supportPhone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get only this seller's order items
    const orderItems = sellerItems;

    // Format order items for frontend
    // Format order items for frontend
    const formattedItems = orderItems.map(item => {
      let unit = item.variation || 'N/A';
      let variationMatched = false;

      // Try to resolve variation value from product if it exists
      // item.product is populated now
      const product = item.product as any;
      if (product && product.variations && Array.isArray(product.variations)) {
        // 1. Try to match by ID or Value if validation is present
        if (item.variation) {
            const variationById = product.variations.find((v: any) => v._id.toString() === item.variation);
            if (variationById) {
              unit = variationById.value;
              variationMatched = true;
            } else {
                const variationByValue = product.variations.find((v: any) => v.value === item.variation);
                if (variationByValue) {
                    unit = variationByValue.value;
                    variationMatched = true;
                }
            }
        }

        // 2. Fallback: If not matched yet (even if we have a value like '250'), try to recover
        if (!variationMatched) {
             const variationByPrice = product.variations.find((v: any) => v.price === item.unitPrice || v.discPrice === item.unitPrice);
             if (variationByPrice) {
                 unit = variationByPrice.value;
                 variationMatched = true;
             } else if (product.variations.length === 1) {
                 // 3. Last Resort: If there is only one variation, assume it's that one
                 unit = product.variations[0].value;
             }
        }
      }

      return {
        srNo: item._id.toString().slice(-4), // Use last 4 chars of ID as srNo
        product: item.productName || 'Unknown Product',
        soldBy: (item.seller as any)?.storeName || 'N/A',
        unit: unit,
        price: item.unitPrice || 0,
        tax: 0,
        taxPercent: 0,
        qty: item.quantity || 0,
        subtotal: item.total || 0,
      };
    });

    // Format order data for frontend
    const orderDetail = {
      id: order._id,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber || order.orderNumber || 'N/A',
      orderDate: order.orderDate ? order.orderDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      deliveryDate: order.estimatedDeliveryDate ? order.estimatedDeliveryDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      timeSlot: order.timeSlot || 'N/A',
      status: (() => {
        const sellerAcceptance = order.sellerAcceptances?.find((sa: any) => sa.seller.toString() === sellerId.toString());
        let stat = sellerAcceptance ? sellerAcceptance.status : order.status;
        return (stat === 'Out for Delivery' || stat === 'Out For Delivery') ? 'On the way' : stat;
      })(),
      customerName: (order.customer as any)?.name || order.customerName || '',
      customerEmail: (order.customer as any)?.email || order.customerEmail || '',
      customerPhone: (order.customer as any)?.phone || order.customerPhone || '',
      deliveryBoyName: (order.deliveryBoy as any)?.name || '',
      deliveryBoyPhone: (order.deliveryBoy as any)?.mobile || '',
      items: formattedItems,
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      grandTotal: order.total || 0,
      paymentMethod: order.paymentMethod || 'N/A',
      paymentStatus: order.paymentStatus || 'Pending',
      deliveryAddress: order.deliveryAddress || {},
      appInfo: {
        email: settings?.contactEmail || settings?.supportEmail || 'info@Speedoo.com',
        phone: settings?.contactPhone || settings?.supportPhone || '8956656429',
      }
    };

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: orderDetail,
    });
  }
);

/**
 * Update order status (seller can update: Accepted, On the way, Delivered, Cancelled)
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { status } = req.body;

    // Validate allowed status updates for seller
    const allowedStatuses = ['Accepted', 'On the way', 'Delivered', 'Cancelled', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Seller can only update to: ${allowedStatuses.join(', ')}`,
      });
    }

    // Check if this seller has items in this order
    const sellerItems = await OrderItem.findOne({ order: id, seller: sellerId });

    if (!sellerItems) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you are not authorized to manage this order",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Map status from frontend ('On the way') to backend schema enum ('Out for Delivery')
    let mappedStatus = status;
    if (status === 'On the way') {
        mappedStatus = 'Out for Delivery';
    }

    const previousStatus = order.status;

    // Handle per-seller status updates
    let isSellerStatusUpdate = false;
    let allAccepted = false;
    let sellerAcceptanceIndex = -1;

    if (order.sellerAcceptances && Array.isArray(order.sellerAcceptances)) {
        sellerAcceptanceIndex = order.sellerAcceptances.findIndex((sa: any) => sa.seller.toString() === sellerId.toString());
        if (sellerAcceptanceIndex !== -1) {
            const currentSellerStatus = order.sellerAcceptances[sellerAcceptanceIndex].status;
            
            // Check if status is already the same for this seller
            if (currentSellerStatus === mappedStatus) {
                return res.status(400).json({
                    success: false,
                    message: `Order is already ${status} for your store`,
                });
            }

            if (mappedStatus === 'Accepted' || mappedStatus === 'Rejected') {
                order.sellerAcceptances[sellerAcceptanceIndex].status = mappedStatus;
                if (mappedStatus === 'Accepted') {
                    order.sellerAcceptances[sellerAcceptanceIndex].acceptedAt = new Date();
                }
                isSellerStatusUpdate = true;

                // Check if all sellers have accepted
                allAccepted = order.sellerAcceptances.every((sa: any) => sa.status === 'Accepted');
                
                // If all accepted, update the main order status
                if (allAccepted) {
                    order.status = 'Accepted';
                }
            } else if (mappedStatus === 'Out for Delivery' || mappedStatus === 'Delivered' || mappedStatus === 'Cancelled') {
                 // For now, if a seller forces a status like Delivered, we'll just update the main order status 
                 // (typically this should be done by the delivery boy, but sellers have the option)
                 order.status = mappedStatus;
            }
        }
    } else {
        // Fallback for older orders without sellerAcceptances array
        if (order.status === mappedStatus) {
            return res.status(400).json({
                success: false,
                message: `Order is already ${status}`,
            });
        }
        order.status = mappedStatus;
        if (mappedStatus === 'Accepted') {
            allAccepted = true; // Act as if all accepted for legacy orders
        }
    }

    await order.save();

    // Trigger delivery notification if THIS seller accepts the order
    if (mappedStatus === 'Accepted' && isSellerStatusUpdate) {
        try {
            const io: SocketIOServer = (req.app.get("io") as SocketIOServer);
            if (io) {
                // Need to fetch full order with details for the notification service
                const fullOrder = await Order.findById(order._id)
                    .populate({
                        path: 'items',
                        populate: { path: 'seller' }
                    })
                    .lean();

                if (fullOrder) {
                    // Need to dynamically import to avoid circular dependencies if any, though regular import is fine
                    const { notifyDeliveryBoysForSellerPickup } = await import("../../../services/orderNotificationService");
                    
                    if (typeof notifyDeliveryBoysForSellerPickup === 'function') {
                        await notifyDeliveryBoysForSellerPickup(io, fullOrder, sellerId);
                        console.log(`Per-seller delivery notification triggered for Accepted order ${order.orderNumber}, seller ${sellerId}`);
                    } else {
                        // Fallback to old behavior if not implemented yet
                        const { notifyDeliveryBoysOfNewOrder } = await import("../../../services/orderNotificationService");
                        await notifyDeliveryBoysOfNewOrder(io, fullOrder);
                    }
                }
            }
        } catch (notifyError) {
            console.error('Error notifying delivery boys on seller acceptance:', notifyError);
            // Don't fail the request, just log
        }
    } else if (mappedStatus === 'Accepted' && !isSellerStatusUpdate && previousStatus !== 'Accepted') {
         // Legacy path for old orders
         try {
            const io: SocketIOServer = (req.app.get("io") as SocketIOServer);
            if (io) {
                const fullOrder = await Order.findById(order._id).populate({ path: 'items', populate: { path: 'seller' } }).lean();
                if (fullOrder) {
                     const { notifyDeliveryBoysOfNewOrder } = await import("../../../services/orderNotificationService");
                     await notifyDeliveryBoysOfNewOrder(io, fullOrder);
                }
            }
        } catch (notifyError) {
            console.error('Error notifying delivery boys on legacy seller acceptance:', notifyError);
        }
    }

    try {
        const { processOrderStatusTransition } = await import("../../../services/orderService");
        await processOrderStatusTransition(id, mappedStatus, previousStatus);
    } catch (transitionError: any) {
        console.error('Error processing order status transition in seller updateOrderStatus:', transitionError);
    }

    // Emit real-time status update to the tracking page
    try {
        const io: SocketIOServer = (req.app.get("io") as SocketIOServer);
        if (io) {
            io.to(`order-${order._id}`).emit('order-status-updated', {
                orderId: order._id,
                status: mappedStatus,
            });
        }
    } catch (socketError) {
        console.error('Error emitting order status update:', socketError);
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        id: order._id,
        status: order.status,
      },
    });
  }
);
