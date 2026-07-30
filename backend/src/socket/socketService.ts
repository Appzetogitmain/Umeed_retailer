import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../services/jwtService';
import { PRODUCTION_ALLOWED_ORIGINS, isLocalhostOrigin } from '../config/corsOrigins';
import { handleOrderAcceptance, handleOrderRejection, notificationStates } from '../services/orderNotificationService';
import Order from '../models/Order';
import DeliveryTracking from '../models/DeliveryTracking';

// In-memory cache for order destinations (lat, lng) to avoid DB reads on every update
// Key: orderId, Value: { latitude, longitude }
const orderDestinationsCache = new Map<string, { latitude: number; longitude: number }>();

// Throttler for DB updates
// Key: orderId, Value: last timestamp
const locationUpdateThrottler = new Map<string, number>();

// Haversine formula to calculate distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Calculate ETA (assuming 30 km/h)
const calculateETA = (distanceInMeters: number): number => {
    const averageSpeedKmh = 30;
    const averageSpeedMs = (averageSpeedKmh * 1000) / 60; // meters per minute
    return Math.ceil(distanceInMeters / averageSpeedMs);
};

export const initializeSocket = (httpServer: HttpServer) => {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                // Allow requests with no origin (like mobile apps or server-to-server)
                if (!origin) return callback(null, true);

                // In production, check against allowed origins
                if (process.env.NODE_ENV === 'production') {
                    // Shared with server.ts's Express CORS config via config/corsOrigins.ts
                    // so HTTP and WebSocket CORS policy can't drift apart.
                    const allAllowedOrigins = PRODUCTION_ALLOWED_ORIGINS;

                    // Normalize origins for comparison (remove trailing slash, lowercase)
                    const normalizeUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
                    const normalizedOrigin = normalizeUrl(origin);

                    // Check if origin matches any allowed origin
                    const isAllowed = allAllowedOrigins.some((allowedOrigin) => {
                        const normalizedAllowed = normalizeUrl(allowedOrigin);

                        // Exact match
                        if (normalizedOrigin === normalizedAllowed) return true;

                        // Support for www and non-www variants
                        if (normalizedAllowed.includes("www.")) {
                            const nonWww = normalizedAllowed.replace("www.", "");
                            if (normalizedOrigin === nonWww) return true;
                        } else {
                            const withWww = normalizedAllowed.replace(/^(https?:\/\/)/, "$1www.");
                            if (normalizedOrigin === withWww) return true;
                        }
                        return false;
                    });

                    if (!isAllowed) {
                        console.warn(`⚠️ Socket.io connection rejected from origin: ${origin}. Allowed origins: ${allAllowedOrigins.join(', ')}`);
                        console.warn(`⚠️ Normalized origin: ${normalizedOrigin}`);
                    } else {
                        console.log(`✅ Socket.io connection allowed from origin: ${origin}`);
                    }

                    return callback(null, isAllowed);
                }

                // In development, allow any localhost port
                if (isLocalhostOrigin(origin)) {
                    return callback(null, true);
                }

                return callback(null, false);
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Production-specific Socket.io configuration
        allowEIO3: true, // Allow Engine.IO v3 clients
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        transports: ['websocket', 'polling'], // Allow both transports
        upgradeTimeout: 30000, // 30 seconds for upgrade
    });

    // Authentication middleware
    io.use((socket: any, next: (err?: Error) => void) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            // Allow connection but mark as unauthenticated
            return next();
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            (socket as any).user = decoded;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: any) => {
        console.log('✅ Socket connected:', socket.id, 'User:', (socket as any).user?.userId || 'Unauthenticated');

        // Customer subscribes to order tracking
        socket.on('track-order', async (orderId: string) => {
            const user = (socket as any).user;

            if (!user) {
                console.warn(`⚠️ Unauthenticated socket tried to track order: ${orderId}`);
                socket.emit('tracking-error', { message: 'Authentication required' });
                return;
            }

            try {
                // Verify order belongs to this customer
                const order = await Order.findOne({ _id: orderId, customer: user.userId });

                if (!order) {
                    console.warn(`⚠️ User ${user.userId} tried to track unauthorized order: ${orderId}`);
                    socket.emit('tracking-error', { message: 'Unauthorized or order not found' });
                    return;
                }

                console.log(`📦 Customer ${user.userId} tracking order: ${orderId}`);
                socket.join(`order-${orderId}`);

                // Send acknowledgment
                socket.emit('tracking-started', {
                    orderId,
                    message: 'Live tracking started',
                });
            } catch (error) {
                console.error(`❌ Error in track-order for order ${orderId}:`, error);
                socket.emit('tracking-error', { message: 'Internal server error' });
            }
        });

        // Customer unsubscribes from order tracking
        socket.on('stop-tracking', (orderId: string) => {
            console.log(`🛑 Stopped tracking order: ${orderId}`);
            socket.leave(`order-${orderId}`);
        });

        // Delivery partner joins their active deliveries room
        // Only the authenticated delivery partner themselves may join their own room
        // (prevents any client from eavesdropping on another delivery partner's events).
        socket.on('join-delivery-room', (deliveryPartnerId: string) => {
            const user = (socket as any).user;
            const normalizedId = String(deliveryPartnerId).trim();

            if (!user || user.userType !== 'Delivery' || user.userId !== normalizedId) {
                console.warn(`⚠️ Unauthorized attempt to join delivery room: ${normalizedId}`);
                socket.emit('join-delivery-room-error', { message: 'Unauthorized' });
                return;
            }

            console.log(`🛵 Delivery partner joined: ${normalizedId}`);
            socket.join(`delivery-${normalizedId}`);
        });

        // Seller joins their notification room
        // Only the authenticated seller themselves may join their own room.
        socket.on('join-seller-room', (sellerId: string) => {
            const user = (socket as any).user;
            const normalizedSellerId = String(sellerId).trim();

            if (!user || user.userType !== 'Seller' || user.userId !== normalizedSellerId) {
                console.warn(`⚠️ Unauthorized attempt to join seller room: ${normalizedSellerId}`);
                socket.emit('joined-seller-room', { success: false, message: 'Unauthorized' });
                return;
            }

            console.log(`🏪 Seller ${normalizedSellerId} joined notifications room`);
            socket.join(`seller-${normalizedSellerId}`);

            socket.emit('joined-seller-room', {
                success: true,
                message: 'Successfully joined seller notifications room',
                sellerId: normalizedSellerId
            });
        });

        // Delivery boy joins notification room
        // Only the authenticated delivery partner themselves may join their own room.
        socket.on('join-delivery-notifications', (deliveryBoyId: string) => {
            const user = (socket as any).user;
            const normalizedDeliveryBoyId = String(deliveryBoyId).trim();

            if (!user || user.userType !== 'Delivery' || user.userId !== normalizedDeliveryBoyId) {
                console.warn(`⚠️ Unauthorized attempt to join delivery notifications room: ${normalizedDeliveryBoyId}`);
                socket.emit('joined-notifications-room', { success: false, message: 'Unauthorized' });
                return;
            }

            console.log(`🔔 Delivery boy ${normalizedDeliveryBoyId} joined notifications room`);

            // Only join personal room (not general room) to prevent duplicate notifications
            socket.join(`delivery-${normalizedDeliveryBoyId}`);

            console.log(`✅ Delivery boy ${normalizedDeliveryBoyId} joined room: delivery-${normalizedDeliveryBoyId}`);

            // Send confirmation that they joined successfully
            socket.emit('joined-notifications-room', {
                success: true,
                message: 'Successfully joined delivery notifications room',
                deliveryBoyId: normalizedDeliveryBoyId
            });

            // Check if there are any active orders waiting for this delivery boy
            for (const [orderId, state] of notificationStates.entries()) {
                if (
                    state.notifiedDeliveryBoys.has(normalizedDeliveryBoyId) &&
                    !state.rejectedDeliveryBoys.has(normalizedDeliveryBoyId) &&
                    !state.acceptedBy &&
                    state.orderData
                ) {
                    console.log(`🔄 Sending pending new-order event to reconnected delivery boy ${normalizedDeliveryBoyId} for order ${orderId}`);
                    socket.emit('new-order', state.orderData);
                }
            }
        });

        // Handle order acceptance
        socket.on('accept-order', async (data: { orderId: string; deliveryBoyId: string; sellerId?: string }) => {
            try {
                console.log(`✅ Delivery boy ${data.deliveryBoyId} accepting order ${data.orderId}${data.sellerId ? ` (seller ${data.sellerId})` : ''}`);
                const result = await handleOrderAcceptance(io, data.orderId, String(data.deliveryBoyId).trim(), data.sellerId);
                socket.emit('accept-order-response', result);
            } catch (error) {
                console.error('❌ Error in accept-order handler:', error);
                socket.emit('accept-order-response', { success: false, message: 'Internal server error' });
            }
        });

        // Handle order rejection
        socket.on('reject-order', async (data: { orderId: string; deliveryBoyId: string; sellerId?: string }) => {
            try {
                console.log(`❌ Delivery boy ${data.deliveryBoyId} rejecting order ${data.orderId}${data.sellerId ? ` (seller ${data.sellerId})` : ''}`);
                // Modify handleOrderRejection to take sellerId as well (or at least log it here)
                // For now we pass it down, but handleOrderRejection would need to be updated similarly if we wanted full per-seller rejection tracking.
                // We'll just pass the standard ones for now, but state tracking in orderNotificationService handles sellerId if we pass stateKey.
                // Actually, handleOrderRejection doesn't take sellerId yet. Let's just log it.
                const result = await handleOrderRejection(io, data.orderId, String(data.deliveryBoyId).trim());
                socket.emit('reject-order-response', result);
            } catch (error) {
                console.error('❌ Error in reject-order handler:', error);
                socket.emit('reject-order-response', { success: false, message: 'Internal server error', allRejected: false });
            }
        });

        // Handle delivery location update (optimized)
        socket.on('update-location', async (data: { orderId: string; latitude: number; longitude: number; sellerId?: string }) => {
            const { orderId, latitude, longitude, sellerId } = data;
            const deliveryBoyId = (socket as any).user?.userId;

            if (!deliveryBoyId || !orderId || !latitude || !longitude) return;

            try {
                // 1. Verify Delivery Boy is assigned to this order (either globally or to a specific seller)
                const order = await Order.findOne({ 
                    _id: orderId, 
                    $or: [
                        { deliveryBoy: deliveryBoyId },
                        { "sellerAcceptances.deliveryBoy": deliveryBoyId }
                    ]
                }).select('deliveryAddress status sellerAcceptances');
                
                if (!order) {
                    console.warn(`⚠️ Unauthorized location update attempt from ${deliveryBoyId} for order ${orderId}`);
                    return;
                }

                // 2. Get Destination (from cache or DB)
                let destination = orderDestinationsCache.get(orderId);

                if (!destination && order.deliveryAddress) {
                    destination = {
                        latitude: order.deliveryAddress.latitude || 0,
                        longitude: order.deliveryAddress.longitude || 0
                    };
                    orderDestinationsCache.set(orderId, destination);

                    // Clear cache after 2 hours (cleanup)
                    setTimeout(() => orderDestinationsCache.delete(orderId), 2 * 60 * 60 * 1000);
                }

                // 3. Calculate Distance & ETA
                let distance = 0;
                let eta = 0;
                if (destination) {
                    distance = calculateDistance(latitude, longitude, destination.latitude, destination.longitude);
                    eta = calculateETA(distance);
                }

                // 4. Determine Status (Simplified)
                let status = 'in_transit';
                if (distance < 100) status = 'nearby';
                // Note: We don't change to 'picked_up'/'delivered' here as those are state transitions, not just location updates

                // 5. Broadcast Immediately (Fast Path)
                const locationUpdatePayload = {
                    orderId,
                    location: { latitude, longitude, timestamp: new Date() },
                    eta,
                    distance,
                    status
                };

                io.to(`order-${orderId}`).emit('location-update', locationUpdatePayload);

                // 6. Throttled DB Update (Slow Path)
                const lastUpdate = locationUpdateThrottler.get(orderId) || 0;
                const now = Date.now();

                if (now - lastUpdate > 30000) { // 30 seconds throttle
                    locationUpdateThrottler.set(orderId, now);

                    try {
                        let tracking = await DeliveryTracking.findOne({ order: orderId });

                        if (!tracking) {
                            tracking = new DeliveryTracking({
                                order: orderId,
                                deliveryBoy: deliveryBoyId,
                                latitude,
                                longitude,
                                currentLocation: { latitude, longitude, timestamp: new Date() },
                                route: [{ lat: latitude, lng: longitude }],
                                status: status as any
                            });
                        } else {
                            tracking.currentLocation = { latitude, longitude, timestamp: new Date() };
                            tracking.latitude = latitude;
                            tracking.longitude = longitude;
                            tracking.route.push({ lat: latitude, lng: longitude });
                            if (tracking.route.length > 50) tracking.route = tracking.route.slice(-50);
                            tracking.distance = distance;
                            tracking.eta = eta;
                            // Only update status if it's a spatial status (nearby/in_transit), don't override Delivered/Picked Up
                            if (tracking.status !== 'delivered' && tracking.status !== 'picked_up' && tracking.status !== 'idle') {
                                tracking.status = status as any;
                            }
                        }
                        await tracking.save();
                    } catch (dbError) {
                        console.error('Error syncing location to DB:', dbError);
                    }
                }
            } catch (err) {
                console.error('Error in socket location update:', err);
            }
        });

        // Handle disconnection
        socket.on('disconnect', (reason: string) => {
            console.log('❌ Socket disconnected:', socket.id, 'Reason:', reason);
        });

        // Error handling
        socket.on('error', (error: any) => {
            console.error('Socket error:', error);
        });

        // Handle connection errors
        socket.on('connect_error', (error: any) => {
            console.error('Socket connection error:', error.message);
        });
    });

    console.log('🔌 Socket.io initialized');
    return io;
};

// Helper function to clear order cache when status changes
export const clearOrderCache = (orderId: string) => {
    orderDestinationsCache.delete(orderId);
    locationUpdateThrottler.delete(orderId);
};

// Helper function to emit location updates
export const emitLocationUpdate = (
    io: SocketIOServer,
    orderId: string,
    data: {
        location: { latitude: number; longitude: number; timestamp: Date };
        eta: number;
        distance: number;
        status: string;
    }
) => {
    io.to(`order-${orderId}`).emit('location-update', {
        orderId,
        ...data,
        timestamp: new Date(),
    });
};
