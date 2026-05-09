import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/button";
import { useOrders } from "../../hooks/useOrders";
import { OrderStatus } from "../../types/order";
import { useThemeContext } from "../../context/ThemeContext";
import GoogleMapsTracking from "../../components/GoogleMapsTracking";
import { useDeliveryTracking } from "../../hooks/useDeliveryTracking";
import DeliveryPartnerCard from "../../components/DeliveryPartnerCard";
import {
  cancelOrder,
  updateOrderNotes,
  getSellerLocationsForOrder,
  refreshDeliveryOtp,
} from "../../services/api/customerOrderService";

// Icon Components
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const Share2Icon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const RefreshCwIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.48L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ChefHatIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M6 13h12M6 13c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2M6 13v5c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-5" />
    <path d="M9 9V7a3 3 0 0 1 6 0v2" />
  </svg>
);

const ReceiptIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="16" y2="15" />
  </svg>
);

const CircleSlashIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => {
  const { currentTheme } = useThemeContext();
  const brandPrimary = currentTheme.primary[2] || "#F57C00";

  return (
    <motion.svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      initial="hidden"
      animate="visible"
      className="mx-auto">
      <motion.circle
        cx="40"
        cy="40"
        r="36"
        fill="none"
        stroke={brandPrimary}
        strokeWidth="4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay, ease: "easeOut" }}
      />
      <motion.path
        d="M24 40 L35 51 L56 30"
        fill="none"
        stroke={brandPrimary}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
      />
    </motion.svg>
  );
};

// Promotional banner carousel
const PromoCarousel = () => {
  const { currentTheme } = useThemeContext();
  const brandPrimary = currentTheme.primary[2] || "#F57C00";
  const [currentSlide, setCurrentSlide] = useState(0);
  const promos = [
    {
      bank: "HDFC BANK",
      offer: "10% cashback on all orders",
      subtext: "Extraordinary Rewards | Zero Joining Fee | T&C apply",
      color: "from-blue-50 to-indigo-50",
    },
    {
      bank: "ICICI BANK",
      offer: "15% instant discount",
      subtext: "Valid on orders above ₹299 | Use code ICICI15",
      color: "from-orange-50 to-red-50",
    },
    {
      bank: "SBI CARD",
      offer: "Flat ₹75 off",
      subtext: "On all orders | No minimum order value",
      color: "from-purple-50 to-pink-50",
    },
    {
      bank: "AXIS BANK",
      offer: "20% cashback up to ₹100",
      subtext: "Valid on first order | T&C apply",
      color: "from-teal-50 to-cyan-50",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % promos.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}>
      <div className="overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r ${promos[currentSlide].color}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-blue-900 text-white px-2 py-0.5 rounded">
                  {promos[currentSlide].bank}
                </span>
              </div>
              <p className="font-semibold text-gray-900">
                {promos[currentSlide].offer}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {promos[currentSlide].subtext}
              </p>
              <button
                className="font-medium text-sm mt-2 flex items-center gap-1"
                style={{ color: brandPrimary }}
              >
                Apply now <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💳</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-3">
        {promos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentSlide ? "w-4" : "bg-gray-300"
              }`}
            style={{ backgroundColor: index === currentSlide ? brandPrimary : undefined }}
          />
        ))}
      </div>
    </motion.div>
  );
};

// Tip selection component
const TipSection = () => {
  const { currentTheme } = useThemeContext();
  const brandPrimary = currentTheme.primary[2] || "#F57C00";
  const lightPrimary = currentTheme.primary[0] || "#FFF3E0";
  const [selectedTip, setSelectedTip] = useState<number | "other" | null>(null);
  const [customTip, setCustomTip] = useState("");
  const tips = [20, 30, 50];

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}>
      <p className="text-gray-700 text-sm mb-3">
        Make their day by leaving a tip. 100% of the amount will go to them
        after delivery
      </p>
      <div className="flex gap-3">
        {tips.map((tip) => (
          <motion.button
            key={tip}
            onClick={() => {
              setSelectedTip(tip);
              setCustomTip("");
            }}
            className="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all"
            style={{
              borderColor: selectedTip === tip ? brandPrimary : "#E5E7EB",
              backgroundColor: selectedTip === tip ? lightPrimary : "transparent",
              color: selectedTip === tip ? brandPrimary : "#374151"
            }}
            whileTap={{ scale: 0.95 }}>
            ₹{tip}
          </motion.button>
        ))}
        <motion.button
          onClick={() => {
            setSelectedTip("other");
          }}
          className="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all"
          style={{
            borderColor: selectedTip === "other" ? brandPrimary : "#E5E7EB",
            backgroundColor: selectedTip === "other" ? lightPrimary : "transparent",
            color: selectedTip === "other" ? brandPrimary : "#374151"
          }}
          whileTap={{ scale: 0.95 }}>
          Other
        </motion.button>
      </div>

      <AnimatePresence>
        {selectedTip === "other" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <input
              type="number"
              placeholder="Enter custom amount"
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              className="mt-3 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ caretColor: brandPrimary }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Section item component
const SectionItem = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  showArrow = true,
  rightContent,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  showArrow?: boolean;
  rightContent?: React.ReactNode;
}) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
    whileTap={{ scale: 0.99 }}>
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
    </div>
    {rightContent ||
      (showArrow && <ChevronRightIcon className="w-5 h-5 text-gray-400" />)}
  </motion.button>
);

export default function OrderDetail() {
  const { currentTheme } = useThemeContext();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const { getOrderById, fetchOrderById, loading: contextLoading } = useOrders();
  const [order, setOrder] = useState<any>(id ? getOrderById(id) : undefined);
  const [loading, setLoading] = useState(!order);

  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    order?.status || "Placed"
  );
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    durationValue: number;
    distanceValue: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showSpecialRequestsModal, setShowSpecialRequestsModal] =
    useState(false);

  // Form states
  const [specialRequests, setSpecialRequests] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedTip, setSelectedTip] = useState<number | "other" | null>(null);
  const [customTip, setCustomTip] = useState("");

  // Real-time delivery tracking via WebSocket
  const {
    deliveryLocation,
    eta,
    distance,
    status: trackingStatus,
    orderStatus: socketOrderStatus, // Real-time order status from socket
    isConnected,
    lastUpdate,
    error: trackingError,
    reconnectAttempts,
    reconnect,
  } = useDeliveryTracking(id);

  // Seller locations for the order
  const [sellerLocations, setSellerLocations] = useState<any[]>([]);
  const [loadingSellerLocations, setLoadingSellerLocations] = useState(false);

  // Fetch order if not in context
  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      const existingOrder = getOrderById(id);
      if (existingOrder) {
        setOrder(existingOrder);
        setOrderStatus(existingOrder.status);
        setLoading(false);
        return;
      }

      setLoading(true);
      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setOrderStatus(fetchedOrder.status);
      }
      setLoading(false);
    };

    loadOrder();
  }, [id, getOrderById, fetchOrderById]);

  // Fetch seller locations when order is loaded
  useEffect(() => {
    const fetchSellerLocations = async () => {
      if (!id || !order) return;

      // Only fetch if order has delivery boy assigned and status is before "Picked up" or "Out for Delivery"
      const shouldFetch =
        order.status &&
        order.status !== "Delivered" &&
        order.status !== "Cancelled" &&
        order.status !== "Picked up" &&
        order.status !== "Out for Delivery";

      if (shouldFetch) {
        try {
          setLoadingSellerLocations(true);
          const response = await getSellerLocationsForOrder(id);
          if (response.success && response.data) {
            setSellerLocations(response.data || []);
          }
        } catch (err) {
          console.error("Failed to fetch seller locations:", err);
        } finally {
          setLoadingSellerLocations(false);
        }
      }
    };

    fetchSellerLocations();
  }, [id, order?.status]);

  // Update orderStatus when order state changes
  useEffect(() => {
    if (order) {
      setOrderStatus(order.status);
    }
  }, [order]);

  // Real-time order status updates from socket
  useEffect(() => {
    if (socketOrderStatus && socketOrderStatus !== orderStatus) {
      console.log("🔄 Real-time status update:", socketOrderStatus);
      setOrderStatus(socketOrderStatus as OrderStatus);

      // Re-fetch order to get complete updated data
      if (id) {
        fetchOrderById(id).then((fetchedOrder) => {
          if (fetchedOrder) {
            setOrder(fetchedOrder);
          }
        });
      }
    }
  }, [socketOrderStatus, orderStatus, id, fetchOrderById]);

  // Sync instructions from order
  useEffect(() => {
    if (order) {
      if (order.specialRequests) setSpecialRequests(order.specialRequests);
    }
  }, [order]);

  // Simulate order status progression
  useEffect(() => {
    if (confirmed && order) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false);
        setOrderStatus("Accepted");
      }, 3000);
      return () => clearTimeout(timer1);
    }
  }, [confirmed, order]);

  // Countdown timer
  useEffect(() => {
    if (orderStatus === "Accepted" || orderStatus === "On the way") {
      const timer = setInterval(() => {
        setEstimatedTime((prev) => Math.max(0, prev - 1));
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [orderStatus]);

  // Handler functions
  const handleRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    const fetchedOrder = await fetchOrderById(id);
    if (fetchedOrder) {
      setOrder(fetchedOrder);
      setOrderStatus(fetchedOrder.status);
    }
    // Add a small delay for the animation
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRefreshOtp = async () => {
    if (!id || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshDeliveryOtp(id);
      // Re-fetch order to get updated OTP and expiry
      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setOrderStatus(fetchedOrder.status);
      }
    } catch (error) {
      console.error("Failed to refresh OTP:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Order #${order?.id?.split("-").slice(-1)[0]}`,
      text: `Track my Speedoo order: Order #${order?.id?.split("-").slice(-1)[0]
        }`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleCallStore = () => {
    // Default store number, should be from order/seller data
    const storeNumber = order?.seller?.phone || "1234567890";
    window.location.href = `tel:${storeNumber}`;
  };

  const handleCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      alert("Please provide a cancellation reason");
      return;
    }

    if (!id) return;

    try {
      // TODO: Call backend API to cancel order
      await cancelOrder(id, cancellationReason);
      setOrderStatus("Cancelled" as any);
      setShowCancelModal(false);
      alert("Order cancelled successfully");
      // Refresh order to get updated status
      handleRefresh();
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Failed to cancel order");
    }
  };


  const handleSaveSpecialRequests = async () => {
    try {
      if (!id) return;
      await updateOrderNotes(id, { specialRequests });
      setShowSpecialRequestsModal(false);
      // alert("Special requests saved!");
      handleRefresh();
    } catch (error) {
      console.error("Failed to save special requests:", error);
      alert("Failed to save special requests");
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ borderColor: currentTheme.accentColor }}
          ></div>
          <p className="text-sm text-neutral-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">
            Order Not Found
          </h1>
          <Link to="/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isPartnerAssigned = !!(order?.deliveryBoy || order?.deliveryPartner);
  const displayEta = routeInfo ? Math.ceil(routeInfo.durationValue / 60) : (eta || estimatedTime);

  const statusConfig: Record<
    string,
    { title: string; subtitle: string; color: string }
  > = {
    Placed: {
      title: "Order placed",
      subtitle: "Order will reach you shortly",
      color: currentTheme.accentColor,
    },
    Accepted: {
      title: isPartnerAssigned ? "Preparing your order" : "Searching for delivery partner...",
      subtitle: isPartnerAssigned ? `Arriving in ${displayEta} mins` : "",
      color: currentTheme.accentColor,
    },
    "On the way": {
      title: "Order picked up",
      subtitle: `Arriving in ${displayEta} mins`,
      color: currentTheme.accentColor,
    },
    Delivered: {
      title: "Order delivered",
      subtitle: "Enjoy your meal!",
      color: currentTheme.accentColor,
    },
    // Backend status mappings
    Received: {
      title: "Order received",
      subtitle: "Processing your order",
      color: currentTheme.accentColor,
    },
    Pending: {
      title: "Order pending",
      subtitle: "Waiting for confirmation",
      color: currentTheme.accentColor,
    },
    Processed: {
      title: isPartnerAssigned ? "Preparing your order" : "Searching for delivery partner...",
      subtitle: isPartnerAssigned ? `Arriving in ${displayEta} mins` : "",
      color: currentTheme.accentColor,
    },
    Shipped: {
      title: "Order shipped",
      subtitle: isPartnerAssigned ? `Arriving in ${displayEta} mins` : "On the way to you",
      color: currentTheme.accentColor,
    },
    "Out for Delivery": {
      title: "Out for delivery",
      subtitle: `Arriving in ${displayEta} mins`,
      color: currentTheme.accentColor,
    },
    Cancelled: {
      title: "Order cancelled",
      subtitle: "This order has been cancelled",
      color: currentTheme.accentColor,
    },
    Returned: {
      title: "Order returned",
      subtitle: "This order has been returned",
      color: currentTheme.accentColor,
    },
  };

  const currentStatus = statusConfig[orderStatus] || statusConfig["Received"];

  if (orderStatus === "Cancelled") {
    const isOnlinePayment = order.paymentMethod === "Online" || order.paymentMethod?.toLowerCase() === "online" || order.paymentMethod?.toLowerCase()?.includes("card") || order.paymentMethod?.toLowerCase()?.includes("upi");
    
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col pb-12">
        {/* Navigation bar */}
        <div 
          className="sticky top-0 z-40 text-white flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: "#7A3E8E" }} // Premium Purple Header to match footer
        >
          <Link to="/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
              whileTap={{ scale: 0.9 }}>
              <ArrowLeftIcon className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">Order Cancelled</h2>
          <motion.button
            className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}>
            <Share2Icon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Cancelled Icon & Status Banner Card */}
        <div className="px-4 pt-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100 text-center flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-500 shadow-inner">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">This Order was Cancelled</h1>
            <p className="text-sm text-neutral-500 mt-1 max-w-xs mx-auto">
              Order #{order.orderNumber || order.id?.split("-").slice(-1)[0]}
            </p>
            
            {order.cancellationReason && (
              <div className="mt-4 px-4 py-3 bg-red-50/50 rounded-xl border border-red-100/50 text-left w-full max-w-sm">
                <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">Cancellation Reason</p>
                <p className="text-sm text-red-900 mt-0.5 font-medium">{order.cancellationReason}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Refund / Settlement Information */}
        <div className="px-4 mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100"
          >
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Refund & Payment Info</h3>
            <div className="flex justify-between items-center py-2 border-b border-neutral-50">
              <span className="text-sm text-neutral-500 font-medium">Payment Mode</span>
              <span className="text-sm font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                {order.paymentMethod || "COD"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-neutral-50">
              <span className="text-sm text-neutral-500 font-medium">Refund Amount</span>
              <span className="text-base font-extrabold text-neutral-900">
                ₹{order.total?.toFixed(0) || order.totalAmount?.toFixed(0) || "0"}
              </span>
            </div>
            <div className="mt-3 flex gap-2.5 items-start bg-blue-50/40 p-3 rounded-xl border border-blue-100/40">
              <span className="text-blue-600 text-base mt-0.5">ℹ️</span>
              <p className="text-xs text-blue-800 leading-relaxed font-medium">
                {isOnlinePayment 
                  ? "Refund has been initiated successfully. The amount will reflect back in your account within 3 to 5 business days."
                  : "This order was set for Cash on Delivery. No payment was collected or needs to be refunded."}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Cancelled Items Summary */}
        <div className="px-4 mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Cancelled Items ({order.items?.length || 0})</h3>
              <span className="text-xs text-neutral-500 font-semibold">Total: ₹{order.total?.toFixed(0) || order.totalAmount?.toFixed(0) || "0"}</span>
            </div>
            <div className="space-y-3 divide-y divide-neutral-100">
              {order.items?.map((item: any, index: number) => (
                <div key={index} className="flex gap-3 pt-3 first:pt-0 items-center">
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-neutral-200/50">
                    {item.product?.mainImage ? (
                      <img
                        src={item.product.mainImage}
                        alt={item.product?.name || item.productName || "Product"}
                        className="w-full h-full object-cover rounded-xl filter grayscale"
                      />
                    ) : (
                      <span className="text-xl grayscale">📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-700 truncate line-through">
                      {item.product?.name || item.productName || "Product"}
                    </p>
                    <p className="text-xs text-neutral-400 font-medium">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-neutral-400 line-through">
                      ₹{(item.total || item.unitPrice * item.quantity).toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Buttons / Actions */}
        <div className="px-4 mt-6 space-y-3">
          <Link to="/orders" className="block w-full">
            <Button className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-sm uppercase tracking-wide rounded-xl shadow-lg shadow-neutral-950/10">
              All Orders
            </Button>
          </Link>
          <Link to="/" className="block w-full">
            <Button variant="outline" className="w-full py-3.5 border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-sm uppercase tracking-wide rounded-xl">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8">
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-gray-900 mt-6">
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2">
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                  style={{ borderColor: currentTheme.accentColor }}
                />
                <p className="text-sm text-gray-500 mt-3">
                  Loading order details...
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Header */}
      <motion.div
        className="text-white sticky top-0 z-40"
        style={{ backgroundColor: currentStatus.color }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}>
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}>
              <ArrowLeftIcon className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">Speedoo</h2>
          <motion.button
            className="w-10 h-10 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}>
            <Share2Icon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1
            className="text-2xl font-bold mb-3"
            key={currentStatus.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}>
            {currentStatus.title}
          </motion.h1>

          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10"
            style={{ backgroundColor: `${currentTheme.accentColor}66` }} // 40% opacity
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}>
            <span className="text-sm font-medium">{currentStatus.subtitle}</span>
            <motion.button
              onClick={handleRefresh}
              className="ml-1"
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5 }}>
              <RefreshCwIcon className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Map Section */}
      {!showConfirmation &&
        !["Delivered", "Cancelled", "Returned"].includes(orderStatus as string) && (
          <GoogleMapsTracking
            sellerLocations={sellerLocations.map((s) => ({
              lat: s.latitude,
              lng: s.longitude,
              name: s.storeName,
            }))}
            customerLocation={{
              lat:
                order?.deliveryAddress?.latitude ||
                order?.address?.latitude ||
                0,
              lng:
                order?.deliveryAddress?.longitude ||
                order?.address?.longitude ||
                0,
            }}
            deliveryLocation={deliveryLocation || undefined}
            isTracking={isConnected && !!deliveryLocation}
            showRoute={
              isConnected &&
              !!deliveryLocation &&
              (orderStatus as string) !== "Delivered" &&
              (orderStatus as string) !== "Cancelled" &&
              (orderStatus as string) !== "Returned"
            }
            routeOrigin={deliveryLocation || undefined}
            routeDestination={{
              lat:
                order?.deliveryAddress?.latitude ||
                order?.address?.latitude ||
                0,
              lng:
                order?.deliveryAddress?.longitude ||
                order?.address?.longitude ||
                0,
            }}
            routeWaypoints={
              (orderStatus as string) === "Picked up" ||
                (orderStatus as string) === "Out for Delivery"
                ? []
                : sellerLocations.map((s) => ({
                  lat: s.latitude,
                  lng: s.longitude,
                }))
            }
            destinationName={
              (orderStatus as string) === "Picked up" ||
                (orderStatus as string) === "Out for Delivery"
                ? (typeof order?.deliveryAddress === "string" ? order?.deliveryAddress?.split(",")[0] : order?.deliveryAddress?.address?.split(",")[0]) ||
                (typeof order?.address === "string" ? order?.address?.split(",")[0] : order?.address?.address?.split(",")[0]) ||
                "Delivery Address"
                : sellerLocations.length > 0
                  ? "Sellers & Delivery Address"
                  : "Delivery Address"
            }
            onRouteInfoUpdate={setRouteInfo}
            lastUpdate={lastUpdate}
          />
        )}

      {/* Tracking Error Display */}
      {trackingError && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-center gap-2">
          <span>⚠️</span>
          <span>{trackingError}</span>
        </div>
      )}

      {/* Delivery Partner Card */}
      {isPartnerAssigned && (
        <DeliveryPartnerCard
          partner={{
            name: order?.deliveryPartner?.name || "Delivery Partner",
            phone: order?.deliveryPartner?.phone,
            profileImage: order?.deliveryPartner?.profileImage,
            vehicleNumber: order?.deliveryPartner?.vehicleNumber,
          }}
          eta={routeInfo ? Math.ceil(routeInfo.durationValue / 60) : eta}
          distance={routeInfo ? routeInfo.distanceValue : distance}
          isTracking={isConnected && !!deliveryLocation && !["Delivered", "Cancelled", "Returned"].includes(orderStatus as string)}
          deliveryOtp={!["Delivered", "Cancelled", "Returned"].includes(orderStatus as string) ? order?.deliveryOtp : undefined}
          orderStatus={orderStatus}
          onCall={() => {
            const phone = order?.deliveryPartner?.phone || "1234567890";
            window.location.href = `tel:${phone}`;
          }}
        />
      )}

      {/* Scrollable Content */}
      <div className="px-4 py-4 space-y-4 pb-24">


        {/* Delivery Partner Assignment - Only show if no partner assigned yet */}
        {!isPartnerAssigned && (
          <motion.div
            className="bg-white rounded-xl p-4 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">👨‍🍳</span>
              </div>
              <p className="font-semibold text-gray-900">
                Assigning delivery partner shortly
              </p>
            </div>
          </motion.div>
        )}



        {/* Contact & Address Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}>
          <SectionItem
            icon={PhoneIcon}
            title={`${order.customerName || order.address?.name || order.deliveryAddress?.name || "Customer"}, ${order.customerPhone || order.address?.phone || order.deliveryAddress?.phone || "Mobile Unavailable"}`}
            subtitle="Delivery partner may call this number"
          />
          <SectionItem
            icon={HomeIcon}
            title="Delivery Address"
            subtitle={
              order.deliveryAddress?.address || order.address?.address || "Address Unavailable"
            }
          />
        </motion.div>

        {/* Store Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}>
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🛒</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Speedoo Store</p>
              <p className="text-sm text-gray-500">
                {order.address?.city || "Local Area"}
              </p>
            </div>
            <motion.button
              className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
              onClick={handleCallStore}>
              <PhoneIcon className="w-5 h-5 text-[#7A3E8E]" />
            </motion.button>
          </div>

          {/* Order Items */}
          <div
            className="p-4 border-b border-dashed border-gray-200"
            onClick={() => setShowItemsModal(true)}
            style={{ cursor: "pointer" }}>
            <div className="flex items-start gap-3">
              <ReceiptIcon className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Order #{order.id.split("-").slice(-1)[0]}
                </p>
                <div className="mt-2 space-y-1">
                  {order.items?.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-[#7A3E8E] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[#7A3E8E]" />
                      </span>
                      <span>
                        {item.quantity} x{" "}
                        {item.product?.name || item.productName || "Product"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {!["Delivered", "Cancelled", "Returned"].includes(orderStatus as string) && (
            <SectionItem
              icon={ChefHatIcon}
              title={order.specialRequests || "Add special requests"}
              subtitle={order.specialRequests ? "Tap to edit" : "Add preferences for store"}
              onClick={() => setShowSpecialRequestsModal(true)}
            />
          )}
        </motion.div>

        {/* Help Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}>
          <Link
            to="/faq"
            className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200 w-full hover:bg-neutral-50 transition-colors text-left">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <HelpCircleIcon className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                Need help with your order?
              </p>
              <p className="text-sm text-gray-500">Get help & support</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </Link>
          {(orderStatus === "Placed" ||
            orderStatus === "Received" ||
            orderStatus === "Pending") && (
            <SectionItem
              icon={CircleSlashIcon}
              title="Cancel order"
              subtitle=""
              onClick={() => setShowCancelModal(true)}
            />
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}>
          {order?.invoiceEnabled || orderStatus === "Delivered" ? (
            <Link to={`/orders/${id}/invoice`} className="flex-1">
              <Button className="w-full bg-gradient-to-r from-[#7A3E8E] to-[#603070] hover:from-[#6D377F] hover:to-[#552B63] text-white">
                View Invoice
              </Button>
            </Link>
          ) : (
            <div className="flex-1">
              <Button
                className="w-full bg-gray-400 cursor-not-allowed text-white"
                disabled
                title="Invoice will be available after delivery is completed">
                Invoice Unavailable
              </Button>
            </div>
          )}
          <Link to="/orders" className="flex-1">
            <Button variant="outline" className="w-full border-gray-300">
              All Orders
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Cancel Order Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCancelModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Cancel Order
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this order? Please provide a
                reason:
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="Enter cancellation reason..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCancelModal(false)}>
                  Keep Order
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelOrder}>
                  Cancel Order
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Order Items Detail Modal */}
      <AnimatePresence>
        {showItemsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowItemsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {order?.items?.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="flex gap-3 border-b border-gray-200 pb-4 last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {item.product?.mainImage ? (
                        <img
                          src={item.product.mainImage}
                          alt={
                            item.product?.name || item.productName || "Product"
                          }
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.product?.name || item.productName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-500">{item.variant}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ₹
                        {item.total?.toFixed(0) ||
                          (item.unitPrice * item.quantity).toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => setShowItemsModal(false)}>
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Special Requests Modal */}
      <AnimatePresence>
        {showSpecialRequestsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowSpecialRequestsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add Special Requests
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Let the store know if you have any special preferences
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-600"
                rows={4}
                maxLength={200}
                placeholder="e.g., No onions, Extra napkins, etc."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
              <p className="text-xs text-gray-500 mb-4">
                {specialRequests.length}/200
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSpecialRequestsModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleSaveSpecialRequests}>
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
