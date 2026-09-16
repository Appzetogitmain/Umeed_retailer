import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { getSocketBaseURL } from '../../../services/api/config';
import { getOrderNotificationSnapshot } from '../../../services/api/orderService';

export interface SellerNotification {
    type: 'NEW_ORDER' | 'STATUS_UPDATE';
    orderId: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    customer: {
        name: string;
        email: string;
        phone: string;
        address: {
            address: string;
            city: string;
            state?: string;
            pincode: string;
            landmark?: string;
        };
    };
    items: Array<{
        productName: string;
        quantity: number;
        price: number;
        total: number;
        variation?: string;
    }>;
    totalAmount: number;
    timestamp: Date;
}

interface NotificationState {
    currentNotification: SellerNotification | null;
    notificationQueue: SellerNotification[];
}

const STORAGE_KEY = 'seller_order_notifications';

const loadPersistedNotifications = (): NotificationState => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                currentNotification: parsed.currentNotification || null,
                notificationQueue: parsed.notificationQueue || [],
            };
        }
    } catch (e) {
        console.error('Error loading persisted seller notifications', e);
    }
    return { currentNotification: null, notificationQueue: [] };
};

const savePersistedNotifications = (currentNotification: SellerNotification | null, notificationQueue: SellerNotification[]) => {
    try {
        if (!currentNotification && notificationQueue.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentNotification, notificationQueue }));
        }
    } catch (e) {
        console.error('Error saving persisted seller notifications', e);
    }
};

export const useSellerSocket = () => {
    const { user, token, isAuthenticated } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const persistedRef = useRef(loadPersistedNotifications());
    const [state, setState] = useState<NotificationState>(persistedRef.current);

    // Save to localStorage whenever notifications change, so a popup for an
    // order still awaiting Accept/Reject survives a reload or the tab being
    // discarded while backgrounded, instead of vanishing with no way back.
    useEffect(() => {
        savePersistedNotifications(state.currentNotification, state.notificationQueue);
    }, [state.currentNotification, state.notificationQueue]);

    // Revalidate anything restored from localStorage against the server once
    // on mount - by the time this reloads, the seller may have already
    // actioned the order from another tab/device, or it may have been
    // cancelled in the meantime, and the socket event that would normally
    // clear it could easily have been missed while this tab was gone.
    useEffect(() => {
        const persisted = persistedRef.current;
        const toCheck = [
            ...(persisted.currentNotification ? [persisted.currentNotification] : []),
            ...persisted.notificationQueue,
        ];
        if (toCheck.length === 0) return;

        (async () => {
            const staleIds = new Set<string>();
            await Promise.all(
                toCheck.map(async (notif) => {
                    try {
                        const res = await getOrderNotificationSnapshot(notif.orderId);
                        if (!res.success || !res.data?.pending) staleIds.add(notif.orderId);
                    } catch {
                        // Network blip - don't drop the popup on an ambiguous error,
                        // let the seller's own Accept/Reject click be the final check.
                    }
                })
            );
            if (staleIds.size === 0) return;

            setState(prev => {
                const currentIsStale = prev.currentNotification && staleIds.has(prev.currentNotification.orderId);
                const filteredQueue = prev.notificationQueue.filter(n => !staleIds.has(n.orderId));
                if (currentIsStale) {
                    const nextNotification = filteredQueue[0] || null;
                    return {
                        currentNotification: nextNotification,
                        notificationQueue: filteredQueue.slice(nextNotification ? 1 : 0),
                    };
                }
                return { ...prev, notificationQueue: filteredQueue };
            });
        })();
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !token || !user || user.userType !== 'Seller') {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        const socketUrl = getSocketBaseURL();
        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });
        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            console.log('✅ Seller connected to socket server');
            setIsConnected(true);

            // Join seller room - the server replays any still-pending
            // "new order" notification for this seller as part of this, so a
            // reconnect (backgrounded tab resuming, page reload) recovers a
            // popup even if it wasn't in localStorage for some reason.
            newSocket.emit('join-seller-room', user.id);
        });

        newSocket.on('joined-seller-room', (data) => {
            console.log('📦 Joined seller notification room:', data.sellerId);
        });

        newSocket.on('seller-notification', (notification: SellerNotification) => {
            console.log('🔔 New seller notification received:', notification);
            setState(prev => {
                if (prev.currentNotification?.orderId === notification.orderId) {
                    // Replayed/duplicate delivery of the same order - just refresh in place.
                    return { ...prev, currentNotification: notification };
                }
                if (prev.currentNotification) {
                    return {
                        ...prev,
                        notificationQueue: [
                            ...prev.notificationQueue.filter(n => n.orderId !== notification.orderId),
                            notification,
                        ],
                    };
                }
                return { ...prev, currentNotification: notification };
            });
        });

        newSocket.on('disconnect', () => {
            console.log('❌ Seller disconnected from socket server');
            setIsConnected(false);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, token, user?.id, user?.userType]);

    const clearCurrentNotification = () => {
        setState(prev => ({
            currentNotification: prev.notificationQueue[0] || null,
            notificationQueue: prev.notificationQueue.slice(1),
        }));
    };

    return {
        socket: socketRef.current,
        isConnected,
        currentNotification: state.currentNotification,
        clearCurrentNotification,
    };
};
