import { Server as SocketIOServer } from 'socket.io';
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import Seller from '../models/Seller';
import DeliveryTracking from '../models/DeliveryTracking';
import mongoose from 'mongoose';
import { notifySellersOfOrderUpdate } from './sellerNotificationService';
import { sendNotificationToDeliveryBoy } from '../utils/pushNotificationHelper';

// Track order notification state
export interface OrderNotificationState {
    orderId: string;
    notifiedDeliveryBoys: Set<string>;
    rejectedDeliveryBoys: Set<string>;
    acceptedBy: string | null;
    orderData?: any;
}

export const notificationStates = new Map<string, OrderNotificationState>();

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Find all available delivery boys (online and active)
 */
export async function findAvailableDeliveryBoys(): Promise<mongoose.Types.ObjectId[]> {
    try {
        const deliveryBoys = await Delivery.find({
            isOnline: true,
            status: 'Active',
        }).select('_id');

        return deliveryBoys.map((db: any) => db._id);
    } catch (error) {
        console.error('Error finding available delivery boys:', error);
        return [];
    }
}

/**
 * Find delivery boys near a specific location within a radius
 * Uses the delivery boy's location from the Delivery model (preferred)
 * or falls back to DeliveryTracking
 */
export async function findDeliveryBoysNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 10
): Promise<{ deliveryBoyId: mongoose.Types.ObjectId; distance: number }[]> {
    try {
        // 1. Try to find delivery boys using the new GeoJSON location field in Delivery model
        const nearbyDeliveryBoys: { deliveryBoyId: mongoose.Types.ObjectId; distance: number }[] = [];

        const deliveryBoysWithLocation = await Delivery.find({
            isOnline: true,
            status: 'Active',
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: radiusKm * 1000 // Convert km to meters
                }
            }
        }).select('_id location');

        if (deliveryBoysWithLocation.length > 0) {
            for (const db of deliveryBoysWithLocation) {
                if (db.location && db.location.coordinates) {
                    const [dbLng, dbLat] = db.location.coordinates;
                    const distance = calculateDistance(latitude, longitude, dbLat, dbLng);
                    nearbyDeliveryBoys.push({
                        deliveryBoyId: db._id as mongoose.Types.ObjectId,
                        distance
                    });
                }
            }

            console.log(`📍 Found ${nearbyDeliveryBoys.length} delivery boys using live location within ${radiusKm}km of seller`);
            return nearbyDeliveryBoys.sort((a, b) => a.distance - b.distance);
        }

        console.log(`⚠️ No delivery boys found within ${radiusKm}km using live location. Checking fallback...`);

        // 2. Fallback to the old method using DeliveryTracking if no delivery boys found with the new field
        // Get all active and online delivery boys
        const allDeliveryBoys = await Delivery.find({
            isOnline: true,
            status: 'Active',
        }).select('_id');

        if (allDeliveryBoys.length === 0) {
            return [];
        }

        // Get latest locations for these delivery boys from DeliveryTracking
        const deliveryBoyIds = allDeliveryBoys.map((db: any) => db._id);

        // Get the most recent tracking record for each delivery boy
        const trackingRecords = await DeliveryTracking.aggregate([
            {
                $match: {
                    deliveryBoy: { $in: deliveryBoyIds },
                    // Check both legacy fields and new currentLocation structure
                    $or: [
                        { 'currentLocation.latitude': { $exists: true }, 'currentLocation.longitude': { $exists: true } },
                        { latitude: { $exists: true }, longitude: { $exists: true } }
                    ]
                }
            },
            {
                $sort: { 'currentLocation.timestamp': -1, updatedAt: -1 }
            },
            {
                $group: {
                    _id: '$deliveryBoy',
                    latestLocation: { $first: '$currentLocation' },
                    legacyLat: { $first: '$latitude' },
                    legacyLng: { $first: '$longitude' }
                }
            }
        ]);

        for (const record of trackingRecords) {
            const deliveryLat = record.latestLocation?.latitude || record.legacyLat;
            const deliveryLng = record.latestLocation?.longitude || record.legacyLng;

            if (deliveryLat && deliveryLng) {
                const distance = calculateDistance(latitude, longitude, deliveryLat, deliveryLng);

                if (distance <= radiusKm) {
                    nearbyDeliveryBoys.push({
                        deliveryBoyId: record._id,
                        distance,
                    });
                }
            }
        }

        // Also include delivery boys who don't have tracking data yet (they might be new)
        // but give them a default distance
        const trackedIds = new Set(trackingRecords.map((r: any) => r._id.toString()));
        for (const db of allDeliveryBoys) {
            if (!trackedIds.has(db._id.toString())) {
                // Include untracked delivery boys with a default distance
                nearbyDeliveryBoys.push({
                    deliveryBoyId: db._id as mongoose.Types.ObjectId,
                    distance: radiusKm / 2, // Default to half the radius
                });
            }
        }

        // Sort by distance (nearest first)
        nearbyDeliveryBoys.sort((a, b) => a.distance - b.distance);

        console.log(`📍 Found ${nearbyDeliveryBoys.length} delivery boys (fallback) within ${radiusKm}km`);
        return nearbyDeliveryBoys;
    } catch (error) {
        console.error('Error finding nearby delivery boys:', error);
        return [];
    }
}

/**
 * Find delivery boys near seller locations for an order
 * Aggregates all unique sellers from order items and finds delivery boys within their service radius
 */
export async function findDeliveryBoysNearSellerLocations(
    order: any
): Promise<mongoose.Types.ObjectId[]> {
    try {
        // Get unique seller IDs from order items
        const sellerIds = [...new Set(
            order.items
                ?.map((item: any) => {
                    if (!item.seller) return null;
                    return typeof item.seller === 'object' && item.seller._id
                        ? item.seller._id.toString()
                        : item.seller.toString();
                })
                .filter((id: string) => id && id !== '[object Object]') || []
        )];

        if (sellerIds.length === 0) {
            console.log('No sellers found in order, falling back to all available delivery boys');
            return findAvailableDeliveryBoys();
        }

        // Get seller locations
        const sellers = await Seller.find({
            _id: { $in: sellerIds },
        }).select('latitude longitude location serviceRadiusKm storeName');

        if (sellers.length === 0) {
            console.log('No seller data found, falling back to all available delivery boys');
            return findAvailableDeliveryBoys();
        }

        // Find delivery boys near each seller location
        const nearbyDeliveryBoyMap = new Map<string, { distance: number }>();

        for (const seller of sellers) {
            let lat: number | null = null;
            let lng: number | null = null;

            // Prioritize GeoJSON location field
            if (seller.location && seller.location.coordinates) {
                lng = seller.location.coordinates[0];
                lat = seller.location.coordinates[1];
            } else {
                // Fallback to legacy fields
                lat = seller.latitude ? parseFloat(seller.latitude) : null;
                lng = seller.longitude ? parseFloat(seller.longitude) : null;
            }

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                console.log(`Seller ${seller.storeName} has no valid location, skipping`);
                continue;
            }

            const radius = seller.serviceRadiusKm || 10; // Default 10km
            const nearbyBoys = await findDeliveryBoysNearLocation(lat, lng, radius);

            for (const boy of nearbyBoys) {
                const boyId = boy.deliveryBoyId.toString();
                // Keep the smallest distance if same delivery boy is near multiple sellers
                if (!nearbyDeliveryBoyMap.has(boyId) || nearbyDeliveryBoyMap.get(boyId)!.distance > boy.distance) {
                    nearbyDeliveryBoyMap.set(boyId, { distance: boy.distance });
                }
            }
        }

        if (nearbyDeliveryBoyMap.size === 0) {
            console.log('No delivery boys found near seller locations, falling back to all available');
            return findAvailableDeliveryBoys();
        }

        // Sort by distance and return IDs
        const sortedBoys = Array.from(nearbyDeliveryBoyMap.entries())
            .sort((a, b) => a[1].distance - b[1].distance)
            .map(([id]) => new mongoose.Types.ObjectId(id));

        console.log(`📍 Found ${sortedBoys.length} delivery boys near seller locations`);
        return sortedBoys;
    } catch (error) {
        console.error('Error finding delivery boys near seller locations:', error);
        return findAvailableDeliveryBoys();
    }
}

/**
 * Emit new order notification to delivery boys near a specific seller
 * Prioritizes delivery boys within the seller's service radius
 */
export async function notifyDeliveryBoysForSellerPickup(
    io: SocketIOServer,
    order: any,
    sellerId: string
): Promise<void> {
    try {
        const targetSellerIdStr = sellerId ? sellerId.toString() : '';

        // Find delivery boys near this specific seller
        // This is a simplified version of finding near multiple sellers
        
        let targetSeller: any = null;
        if (order.items && order.items.length > 0) {
            const firstItemForSeller = order.items.find((item: any) => {
                const itemSellerId = item.seller && item.seller._id ? item.seller._id.toString() : item.seller.toString();
                return itemSellerId === targetSellerIdStr;
            });
            if (firstItemForSeller) {
                targetSeller = firstItemForSeller.seller;
            }
        }

        let sellerLng: number | null = null;
        let sellerLat: number | null = null;
        if (targetSeller) {
            if (targetSeller.location && targetSeller.location.coordinates) {
                sellerLng = targetSeller.location.coordinates[0];
                sellerLat = targetSeller.location.coordinates[1];
            } else if (targetSeller.latitude && targetSeller.longitude) {
                sellerLat = parseFloat(targetSeller.latitude);
                sellerLng = parseFloat(targetSeller.longitude);
            }
        }
        
        // Find delivery boys near this seller
        let nearbyDeliveryBoyIds: mongoose.Types.ObjectId[] = [];
        
        if (sellerLat !== null && sellerLng !== null && !isNaN(sellerLat) && !isNaN(sellerLng)) {
            try {
                const nearby = await findDeliveryBoysNearLocation(sellerLat, sellerLng, 15);
                nearbyDeliveryBoyIds = nearby.map(b => b.deliveryBoyId);
            } catch (err) {
                console.error('Error finding delivery boys near specific seller location:', err);
            }
        }

        // Fallback to all online active riders if none found nearby or location is missing
        if (nearbyDeliveryBoyIds.length === 0) {
            console.log(`ℹ️ No nearby delivery boys found within radius for seller ${sellerId}, falling back to all online riders.`);
            nearbyDeliveryBoyIds = await findAvailableDeliveryBoys();
        }

        if (nearbyDeliveryBoyIds.length === 0) {
            console.log(`⚠️ No online delivery boys available anywhere in the system.`);
            return;
        }

        // --- FILTER BUSY DELIVERY BOYS ---
        // Active = deliveryBoyStatus is Assigned, Picked Up, or In Transit
        const busyDeliveryBoys = await Order.find({
            deliveryBoy: { $in: nearbyDeliveryBoyIds },
            deliveryBoyStatus: { $in: ['Assigned', 'Picked Up', 'In Transit'] },
            status: { $nin: ['Delivered', 'Cancelled', 'Rejected', 'Returned'] }
        }).distinct('deliveryBoy');
        
        // Also check sellerAcceptances busy
        const busySubDeliveryBoys = await Order.find({
            "sellerAcceptances.deliveryBoy": { $in: nearbyDeliveryBoyIds },
            "sellerAcceptances.deliveryBoyStatus": { $in: ['Assigned', 'Picked Up', 'In Transit'] },
            status: { $nin: ['Delivered', 'Cancelled', 'Rejected', 'Returned'] }
        }).distinct("sellerAcceptances.deliveryBoy");

        const allBusyIds = new Set([
            ...busyDeliveryBoys.map((id: any) => id.toString()),
            ...busySubDeliveryBoys.map((id: any) => id.toString())
        ]);

        if (allBusyIds.size > 0) {
            const originalCount = nearbyDeliveryBoyIds.length;
            nearbyDeliveryBoyIds = nearbyDeliveryBoyIds.filter(id => !allBusyIds.has(id.toString()));

            console.log(`ℹ️ Filtered out busy delivery boys. Active: ${nearbyDeliveryBoyIds.length}`);

            if (nearbyDeliveryBoyIds.length === 0) {
                console.log('⚠️ All nearby delivery boys are currently busy.');
                return;
            }
        }
        // ---------------------------------

        // Calculate rider earning dynamically for this seller's portion
        // First we calculate the dynamic earning for the entire order
        const { calculateDynamicRiderEarning } = await import('./commissionService');
        const dynamicEarning = await calculateDynamicRiderEarning(order);
        let riderEarning = dynamicEarning.totalEarning;
        
        let sellerSubtotal = 0;
        
        // Calculate subtotal for this seller's items
        if (order.items && order.items.length > 0) {
            sellerSubtotal = order.items
                .filter((item: any) => {
                    const itemSellerId = item.seller && item.seller._id ? item.seller._id.toString() : item.seller.toString();
                    return itemSellerId === targetSellerIdStr;
                })
                .reduce((sum: number, item: any) => sum + (item.total || 0), 0);
        }

        // Find COD amount for this rider
        let codAmount = 0;
        if (order.sellerAcceptances && order.paymentMethod === 'COD') {
             const acceptance = order.sellerAcceptances.find((sa: any) => sa.seller.toString() === targetSellerIdStr);
             if (acceptance && acceptance.codAmountToCollect) {
                 codAmount = acceptance.codAmountToCollect;
             }
        }

        // Prepare order data for notification
        const orderData = {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            sellerId: sellerId,
            sellerInfo: {
                 name: targetSeller.storeName || 'Seller',
                 address: targetSeller.address || 'Seller Address',
                 lat: sellerLat,
                 lng: sellerLng
            },
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            deliveryAddress: {
                address: order.deliveryAddress.address,
                city: order.deliveryAddress.city,
                state: order.deliveryAddress.state,
                pincode: order.deliveryAddress.pincode,
            },
            total: order.total,
            codAmount: codAmount,
            subtotal: sellerSubtotal,
            createdAt: order.createdAt,
            riderEarning: riderEarning,
        };

        // Initialize notification state for this specific seller sub-order
        const stateKey = `${order._id.toString()}-${sellerId}`;
        const notifiedIds = new Set<string>();

        const pushNotificationPayload = {
            title: 'New Delivery Request!',
            body: `Pickup from ${targetSeller.storeName || 'Seller'} for Order #${order.orderNumber}.`,
            data: {
                type: 'NEW_ORDER',
                orderId: String(order._id),
                sellerId: sellerId,
                orderNumber: String(order.orderNumber),
                url: `/delivery/dashboard?openOrder=${String(order._id)}`,
                link: `/delivery/dashboard?openOrder=${String(order._id)}`
            },
        };

        for (const id of nearbyDeliveryBoyIds) {
            const idString = id.toString().trim();
            const roomName = `delivery-${idString}`;

            await sendNotificationToDeliveryBoy(idString, pushNotificationPayload).catch(err => {
                console.error(`Failed to send push notification to ${idString}:`, err);
            });
            notifiedIds.add(idString);

            // Emit socket notification to rider room
            io.to(roomName).emit('new-order', orderData);
        }

        // Broadcast to all online delivery boys as backup
        io.emit('new-order', orderData);

        if (notifiedIds.size === 0) return;

        notificationStates.set(stateKey, {
            orderId: order._id.toString(),
            notifiedDeliveryBoys: notifiedIds,
            rejectedDeliveryBoys: new Set(),
            acceptedBy: null,
            orderData: orderData,
        });

        console.log(`📢 Notified ${notifiedIds.size} riders near seller ${sellerId} for order ${order.orderNumber}`);
    } catch (error) {
        console.error('Error in notifyDeliveryBoysForSellerPickup:', error);
    }
}

/**
 * Emit new order notification to delivery boys near seller locations
 * Prioritizes delivery boys within the seller's service radius
 */
export async function notifyDeliveryBoysOfNewOrder(
    io: SocketIOServer,
    order: any
): Promise<void> {
    try {
        // Find delivery boys near seller locations (within service radius)
        let nearbyDeliveryBoyIds = await findDeliveryBoysNearSellerLocations(order);

        if (nearbyDeliveryBoyIds.length === 0) {
            console.log('No available delivery boys to notify (including fallback)');
            return;
        }

        // --- FILTER BUSY DELIVERY BOYS ---
        // Check if any of these delivery boys already have an active order
        // Active = deliveryBoyStatus is Assigned, Picked Up, or In Transit
        const busyDeliveryBoys = await Order.find({
            deliveryBoy: { $in: nearbyDeliveryBoyIds },
            deliveryBoyStatus: { $in: ['Assigned', 'Picked Up', 'In Transit'] },
            // Double check status to be sure we don't count completed/cancelled ones just in case statuses are out of sync
            status: { $nin: ['Delivered', 'Cancelled', 'Rejected', 'Returned'] }
        }).distinct('deliveryBoy');

        if (busyDeliveryBoys.length > 0) {
            const busyIdsSet = new Set(busyDeliveryBoys.map((id: any) => id.toString()));

            const originalCount = nearbyDeliveryBoyIds.length;
            nearbyDeliveryBoyIds = nearbyDeliveryBoyIds.filter(id => !busyIdsSet.has(id.toString()));

            console.log(`ℹ️ Filtered out ${originalCount - nearbyDeliveryBoyIds.length} busy delivery boys. Active: ${nearbyDeliveryBoyIds.length}`);

            if (nearbyDeliveryBoyIds.length === 0) {
                console.log('⚠️ All nearby delivery boys are currently busy with other orders.');
                // Optionally: could emit to admin or retry later
                return;
            }
        }
        // ---------------------------------

        // Calculate rider earning dynamically
        const { calculateDynamicRiderEarning } = await import('./commissionService');
        const dynamicEarning = await calculateDynamicRiderEarning(order);
        let riderEarning = dynamicEarning.totalEarning;

        // Prepare order data for notification
        const orderData = {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            deliveryAddress: {
                address: order.deliveryAddress.address,
                city: order.deliveryAddress.city,
                state: order.deliveryAddress.state,
                pincode: order.deliveryAddress.pincode,
            },
            total: order.total,
            subtotal: order.subtotal,
            shipping: order.shipping,
            createdAt: order.createdAt,
            riderEarning: riderEarning, // Added rider earning
        };

        // Initialize notification state
        const orderId = order._id.toString();
        const notifiedIds = new Set<string>();

        // We will send push notifications and socket events
        const pushNotificationPayload = {
            title: 'New Delivery Request!',
            body: `Order #${order.orderNumber} is ready for pickup.`,
            data: {
                type: 'NEW_ORDER',
                orderId: String(orderId),
                orderNumber: String(order.orderNumber),
                url: `/delivery/dashboard?openOrder=${String(orderId)}`,
                link: `/delivery/dashboard?openOrder=${String(orderId)}`
            },
        };

        // Notify all eligible nearby delivery boys
        for (const id of nearbyDeliveryBoyIds) {
            const idString = id.toString().trim();
            const roomName = `delivery-${idString}`;
            const room = io.sockets.adapter.rooms.get(roomName);

            // Always send push notification to all eligible delivery boys
            // so they receive it in the background/outside the app
            await sendNotificationToDeliveryBoy(idString, pushNotificationPayload).catch(err => {
                console.error(`Failed to send push notification to ${idString}:`, err);
            });
            notifiedIds.add(idString);

            // Send socket event if they are connected to the room
            if (room && room.size > 0) {
                io.to(roomName).emit('new-order', orderData);
                console.log(`📤 Emitted new-order to connected delivery boy room: ${roomName}`);
            } else {
                console.log(`⏩ Delivery boy offline from socket, but push notification sent: ${idString}`);
            }
        }

        if (notifiedIds.size === 0) {
            console.log('⚠️ No eligible delivery boys found to notify');
            return;
        }

        notificationStates.set(orderId, {
            orderId,
            notifiedDeliveryBoys: notifiedIds,
            rejectedDeliveryBoys: new Set(),
            acceptedBy: null,
            orderData: orderData,
        });

        console.log(`📢 Notified ${notifiedIds.size} delivery boys near seller locations about order ${order.orderNumber}`);
    } catch (error) {
        console.error('Error notifying delivery boys:', error);
    }
}

/**
 * Handle order acceptance by a delivery boy
 */
export async function handleOrderAcceptance(
    io: SocketIOServer,
    orderId: string,
    deliveryBoyId: string,
    sellerId?: string
): Promise<{ success: boolean; message: string }> {
    try {
        const stateKey = sellerId ? `${orderId}-${sellerId}` : orderId;
        const state = notificationStates.get(stateKey);
        const normalizedDeliveryBoyId = String(deliveryBoyId).trim();

        // 1. In-Memory Check (Preferred)
        if (state) {
            // Check if already accepted in memory
            if (state.acceptedBy) {
                return { success: false, message: 'Order already accepted by another delivery boy' };
            }

            // Ensure delivery boy is registered in notified list if they received broadcast
            if (!state.notifiedDeliveryBoys.has(normalizedDeliveryBoyId)) {
                state.notifiedDeliveryBoys.add(normalizedDeliveryBoyId);
            }

            // Check if this delivery boy already rejected
            if (state.rejectedDeliveryBoys.has(normalizedDeliveryBoyId)) {
                return { success: false, message: 'You have already rejected this order' };
            }

            // Mark as accepted in memory
            state.acceptedBy = normalizedDeliveryBoyId;
        } else {
            console.log(`⚠️ Notification state missing for order ${stateKey}. Checking database for fallback...`);
        }

        // Update order in database
        const order = await Order.findById(orderId);
        if (!order) {
            return { success: false, message: 'Order not found' };
        }

        if (sellerId && order.sellerAcceptances && order.sellerAcceptances.length > 0) {
            // Per-seller acceptance logic
            const sellerIdStr = sellerId.toString();
            const acceptanceIndex = order.sellerAcceptances.findIndex((sa: any) => sa.seller.toString() === sellerIdStr);
            if (acceptanceIndex === -1) {
                 return { success: false, message: 'Seller sub-order not found' };
            }
            if (order.sellerAcceptances[acceptanceIndex].deliveryBoy) {
                 return { success: false, message: 'This pickup is already assigned to another rider' };
            }

            order.sellerAcceptances[acceptanceIndex].deliveryBoy = new mongoose.Types.ObjectId(normalizedDeliveryBoyId);
            order.sellerAcceptances[acceptanceIndex].deliveryBoyStatus = 'Assigned';
            order.sellerAcceptances[acceptanceIndex].assignedAt = new Date();

            // Set main deliveryBoy as fallback if not set yet
            if (!order.deliveryBoy) {
                order.deliveryBoy = new mongoose.Types.ObjectId(normalizedDeliveryBoyId);
                order.deliveryBoyStatus = 'Assigned';
                order.assignedAt = new Date();
            }
            
            // Also update main status to Processed if it's currently Accepted
            if (order.status === 'Accepted') {
                order.status = 'Processed';
            }
            
            // Freeze dynamic rider earning breakdown
            const { calculateDynamicRiderEarning } = await import('./commissionService');
            const earningBreakdown = await calculateDynamicRiderEarning(order);
            order.riderEarningBreakdown = earningBreakdown;

            await order.save();
        } else {
            // Legacy single-delivery logic
            if (order.deliveryBoy) {
                return { success: false, message: 'Order already assigned to another delivery boy' };
            }

            // Assign order to delivery boy
            order.deliveryBoy = new mongoose.Types.ObjectId(normalizedDeliveryBoyId);
            order.deliveryBoyStatus = 'Assigned';
            order.assignedAt = new Date();
            order.status = 'Processed'; // Mark as processed when assigned

            // Freeze dynamic rider earning breakdown
            const { calculateDynamicRiderEarning } = await import('./commissionService');
            const earningBreakdown = await calculateDynamicRiderEarning(order);
            order.riderEarningBreakdown = earningBreakdown;

            await order.save();
        }

        // Emit order-accepted event to all delivery boys who were notified
        if (state) {
            for (const notifiedId of state.notifiedDeliveryBoys) {
                const notifiedIdString = String(notifiedId).trim();
                io.to(`delivery-${notifiedIdString}`).emit('order-accepted', {
                    orderId,
                    sellerId,
                    acceptedBy: normalizedDeliveryBoyId,
                });
            }
            // Clean up notification state
            notificationStates.delete(stateKey);
        } else {
            // If no state, emit to the accepting delivery boy
            io.to(`delivery-${normalizedDeliveryBoyId}`).emit('order-accepted', {
                orderId,
                sellerId,
                acceptedBy: normalizedDeliveryBoyId,
            });
        }

        // Emit delivery-boy-accepted event to customer for tracking
        if (sellerId) {
             io.to(`order-${orderId}`).emit('seller-delivery-assigned', {
                orderId,
                sellerId,
                deliveryBoyId: normalizedDeliveryBoyId,
                message: 'Delivery partner assigned for a portion of your order.',
            });
        } else {
             io.to(`order-${orderId}`).emit('delivery-boy-accepted', {
                orderId,
                deliveryBoyId: normalizedDeliveryBoyId,
                message: 'Delivery boy accepted your order. Tracking started.',
            });
        }

        console.log(`✅ Order ${stateKey} accepted by delivery boy ${normalizedDeliveryBoyId} ${state ? '(Memory)' : '(DB Fallback)'}`);
        return { success: true, message: 'Order accepted successfully' };
    } catch (error) {
        console.error('Error handling order acceptance:', error);
        return { success: false, message: 'Error accepting order' };
    }
}

/**
 * Handle order rejection by a delivery boy
 */
export async function handleOrderRejection(
    io: SocketIOServer,
    orderId: string,
    deliveryBoyId: string
): Promise<{ success: boolean; message: string; allRejected: boolean }> {
    try {
        const state = notificationStates.get(orderId);

        if (!state) {
            return { success: false, message: 'Order notification not found', allRejected: false };
        }

        // Check if already accepted
        if (state.acceptedBy) {
            return { success: false, message: 'Order already accepted', allRejected: false };
        }

        const normalizedDeliveryBoyId = String(deliveryBoyId).trim();
        // Ensure delivery boy is registered in notified list
        if (!state.notifiedDeliveryBoys.has(normalizedDeliveryBoyId)) {
            state.notifiedDeliveryBoys.add(normalizedDeliveryBoyId);
        }

        // Check if already rejected
        if (state.rejectedDeliveryBoys.has(normalizedDeliveryBoyId)) {
            return { success: true, message: 'You have already rejected this order', allRejected: false };
        }

        // Mark as rejected
        state.rejectedDeliveryBoys.add(normalizedDeliveryBoyId);

        // Check if all delivery boys have rejected
        const allRejected = state.rejectedDeliveryBoys.size === state.notifiedDeliveryBoys.size;

        if (allRejected) {
            // Update order in database to "Rejected"
            try {
                // Update order in database to "Rejected"
                const order = await Order.findById(orderId);
                if (order) {
                    order.status = 'Rejected';
                    order.deliveryBoyStatus = 'Failed';
                    order.adminNotes = (order.adminNotes ? order.adminNotes + '\n' : '') +
                        `[${new Date().toISOString()}] Rejected: All notified delivery boys (${state.notifiedDeliveryBoys.size}) rejected the order.`;
                    await order.save();

                    // Notify customer via socket
                    io.to(`order-${orderId}`).emit('order-rejected', {
                        orderId,
                        message: 'Unfortunately, no delivery partner is available at the moment. Your order has been rejected.',
                    });

                    // Notify sellers/restaurants
                    notifySellersOfOrderUpdate(io, order, 'STATUS_UPDATE');

                    console.log(`✅ All delivery boys rejected order ${orderId}. Order status updated to Rejected.`);
                } else {
                    console.error(`❌ Order ${orderId} not found when trying to update rejection status`);
                }
            } catch (dbError) {
                console.error(`❌ Error updating order ${orderId} to Rejected status:`, dbError);
                // We still proceed with cleanup to avoid memory leaks/stuck state
            }

            // Clean up notification state
            notificationStates.delete(orderId);
        } else {
            // Emit rejection acknowledgment to the specific delivery boy
            io.to(`delivery-${deliveryBoyId}`).emit('order-rejection-acknowledged', {
                orderId,
            });
        }

        console.log(`🚫 Delivery boy ${deliveryBoyId} rejected order ${orderId}`);
        return { success: true, message: 'Order rejected', allRejected };
    } catch (error) {
        console.error('Error handling order rejection:', error);
        return { success: false, message: 'Error rejecting order', allRejected: false };
    }
}

/**
 * Get notification state for an order
 */
export function getNotificationState(orderId: string): OrderNotificationState | undefined {
    return notificationStates.get(orderId);
}

/**
 * Clean up notification state (for testing or manual cleanup)
 */
export function clearNotificationState(orderId: string): void {
    notificationStates.delete(orderId);
}

