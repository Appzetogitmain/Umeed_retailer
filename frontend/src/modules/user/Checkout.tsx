import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useOrders } from "../../hooks/useOrders";
import { useLocation as useLocationContext } from "../../hooks/useLocation";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import RazorpayCheckout from "../../components/RazorpayCheckout";
import { useThemeContext } from "../../context/ThemeContext";

// import { products } from '../../data/products'; // Removed
import { OrderAddress, Order } from "../../types/order";
import PartyPopper from "./components/PartyPopper";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "../../components/ui/sheet";
import WishlistButton from "../../components/WishlistButton";

import {
  getCoupons,
  validateCoupon,
  Coupon as ApiCoupon,
} from "../../services/api/customerCouponService";
import { appConfig } from "../../services/configService";
import {
  getAddresses,
  updateAddress,
} from "../../services/api/customerAddressService";
import GoogleMapsLocationPicker from "../../components/GoogleMapsLocationPicker";
import { getProducts } from "../../services/api/customerProductService";
import { addToWishlist } from "../../services/api/customerWishlistService";
import { updateProfile } from "../../services/api/customerService";
import { calculateProductPrice } from "../../utils/priceUtils";
import { normalizeImageUrl } from "../../utils/imageUrl";
// const STORAGE_KEY = 'saved_address'; // Removed

// Similar products helper removed - using API

export default function Checkout() {
  const { currentTheme } = useThemeContext();
  const {
    cart,
    updateQuantity,
    clearCart,
    addToCart,
    removeFromCart,
    refreshCart,
    loading: cartLoading,
  } = useCart();
  const { addOrder } = useOrders();
  const { location: userLocation } = useLocationContext();
  const { showToast: showGlobalToast } = useToast();
  const { user, updateUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState<number>(0);
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [savedAddress, setSavedAddress] = useState<OrderAddress | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<OrderAddress | null>(
    null
  );
  const [allAddresses, setAllAddresses] = useState<OrderAddress[]>([]);
  const [showAddressSheet, setShowAddressSheet] = useState(false);


  // Recalculate delivery charges when address changes
  useEffect(() => {
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      refreshCart(selectedAddress.latitude, selectedAddress.longitude);
    }
  }, [selectedAddress?.id, selectedAddress?.latitude, selectedAddress?.longitude]);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<ApiCoupon | null>(null);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const [hasAppliedCouponBefore, setHasAppliedCouponBefore] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<ApiCoupon[]>([]);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatedDiscount, setValidatedDiscount] = useState<number>(0);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [showGstinSheet, setShowGstinSheet] = useState(false);
  const [gstin, setGstin] = useState<string>("");
  const [giftPackaging, setGiftPackaging] = useState<boolean>(false);
  const [showRazorpayCheckout, setShowRazorpayCheckout] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "Online">("COD");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile completion modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: "",
    email: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Map Picker State
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLocation, setMapLocation] = useState<{
    lat: number;
    lng: number;
    address?: any;
  } | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isMapSelected, setIsMapSelected] = useState(false);

  // Check if user has placeholder data (needs profile completion)
  const isPlaceholderUser =
    user?.name === "User" || user?.email?.endsWith("@Speedoo.temp");

  // Redirect if empty OR not authenticated
  useEffect(() => {
    if (!cartLoading && !showOrderSuccess) {
      if (!isAuthenticated) {
        // Encode current path to return after login
        const redirectPath = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?redirect=${redirectPath}`);
        return;
      }
      
      if (cart.items.length === 0) {
        navigate("/");
      }
    }
  }, [cart.items.length, cartLoading, navigate, showOrderSuccess, isAuthenticated, location.pathname, location.search]);

  // Load addresses and coupons (only if authenticated)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!isAuthenticated) return;
      
      try {
        const [addressResponse, couponResponse] = await Promise.all([
          getAddresses(),
          getCoupons(),
        ]);

        if (
          addressResponse.success &&
          Array.isArray(addressResponse.data)
        ) {
          const mappedAddresses = addressResponse.data.map((addr: any) => ({
            name: addr.fullName,
            phone: addr.phone,
            flat: "",
            street: addr.address ? addr.address.replace(/^[\s,]+/, '') : "",
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            landmark: addr.landmark || "",
            latitude: addr.latitude,
            longitude: addr.longitude,
            id: addr._id,
            _id: addr._id,
            isDefault: addr.isDefault,
            type: addr.type
          }));
          setAllAddresses(mappedAddresses);

          if (mappedAddresses.length > 0) {
            const defaultAddr =
              mappedAddresses.find((a: any) => a.isDefault) ||
              mappedAddresses[0];
            setSavedAddress(defaultAddr);
            setSelectedAddress(defaultAddr);
          }
        }


        if (couponResponse.success) {
          setAvailableCoupons(couponResponse.data);
        }
      } catch (error) {
        alert("Error loading Speedoo data. Please check your connection.");
      }
    };
    fetchInitialData();
  }, []);

  // Fetch similar products dynamically
  useEffect(() => {
    const fetchSimilar = async () => {
      const items = (cart?.items || []).filter((item) => item && item.product);
      if (items.length === 0) return;

      const cartItem = items[0];
      try {
        let response;
        if (cartItem && cartItem.product) {
          // Try to fetch by category of the first item
          let catId = "";
          const product = cartItem.product;

          if (product.categoryId) {
            catId =
              typeof product.categoryId === "string"
                ? product.categoryId
                : (product.categoryId as any)._id ||
                (product.categoryId as any).id;
          }

          const params: any = { limit: 10 };
          if (userLocation?.latitude && userLocation?.longitude) {
            params.latitude = userLocation.latitude;
            params.longitude = userLocation.longitude;
          }

          if (catId) {
            response = await getProducts({ ...params, category: catId });
          } else {
            response = await getProducts({ ...params, sort: "popular" });
          }
        } else {
          const params: any = { limit: 10, sort: "popular" };
          if (userLocation?.latitude && userLocation?.longitude) {
            params.latitude = userLocation.latitude;
            params.longitude = userLocation.longitude;
          }
          response = await getProducts(params);
        }

        if (response && response.success && response.data) {
          // Filter out items already in cart
          const itemsInCartIds = new Set(
            (cart?.items || [])
              .map((i) => i.product?.id || i.product?._id)
              .filter(Boolean)
          );
          const filtered = response.data
            .filter((p: any) => {
              const pid = String(p._id || p.id || "");
              // Only show products available in the user's area and not already in cart
              return pid && !itemsInCartIds.has(pid) && p.isAvailable !== false;
            })
            .map((p: any) => {
              const { displayPrice, mrp } = calculateProductPrice(p);
              const pid = String(p._id || p.id || "");
              return {
                ...p,
                id: pid,
                _id: pid,
                name: p.productName || p.name || "Product",
                imageUrl: normalizeImageUrl(p.mainImage || p.imageUrl || p.mainImageUrl || ""),
                price: displayPrice,
                mrp: mrp,
                pack:
                  p.pack ||
                  p.variations?.[0]?.title ||
                  p.variations?.[0]?.name ||
                  "Standard",
              };
            })
            .slice(0, 6);
          setSimilarProducts(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch similar products", err);
      }
    };
    fetchSimilar();
  }, [cart?.items?.length]);

  if (cartLoading || ((cart?.items?.length || 0) === 0 && !showOrderSuccess)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div 
            className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
            style={{ borderColor: currentTheme.primary[2], borderTopColor: "transparent" }}
          ></div>
          <p className="text-sm font-medium text-neutral-600">
            {cartLoading ? "Loading checkout..." : "Redirecting..."}
          </p>
        </div>
      </div>
    );
  }

  const displayItems = (cart?.items || []).filter(
    (item) => item && item.product
  );
  const displayCart = {
    ...cart,
    items: displayItems,
    itemCount: displayItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    ),
    total: displayItems.reduce((sum, item) => {
      const { displayPrice } = calculateProductPrice(
        item.product,
        item.variant
      );
      return sum + displayPrice * (item.quantity || 0);
    }, 0),
  };

  const threshold = cart.freeDeliveryThreshold ?? appConfig.freeDeliveryThreshold;
  const amountNeededForFreeDelivery = Math.max(
    0,
    threshold - (displayCart.total || 0)
  );
  const cartItem = displayItems[0];

  const itemsTotal = displayItems.reduce((sum, item) => {
    if (!item?.product) return sum;
    const { mrp } = calculateProductPrice(item.product, item.variant);
    return sum + mrp * (item.quantity || 0);
  }, 0);

  const discountedTotal = displayCart.total;
  const savedAmount = itemsTotal - discountedTotal;
  const handlingCharge = cart.platformFee ?? appConfig.platformFee;
  const deliveryCharge = cart.estimatedDeliveryFee ?? (displayCart.total >= threshold ? 0 : appConfig.deliveryFee);

  // Recalculate or use validated discount
  // If we have a selected coupon, we should re-validate if cart total changes,
  // but for simplicity, we'll re-calculate locally if possible or trust the previous validation if acceptable (better to re-validate)
  const subtotalBeforeCoupon =
    discountedTotal + handlingCharge + deliveryCharge;

  // Local calculation for immediate feedback, relying on backend validation on Apply
  let currentCouponDiscount = 0;
  if (selectedCoupon) {
    // Logic mirrors backend for UI update purposes
    if (
      selectedCoupon.minOrderValue &&
      subtotalBeforeCoupon < selectedCoupon.minOrderValue
    ) {
      // Invalid now
    } else {
      if (selectedCoupon.discountType === "percentage") {
        currentCouponDiscount = Math.round(
          (subtotalBeforeCoupon * selectedCoupon.discountValue) / 100
        );
        if (
          selectedCoupon.maxDiscountAmount &&
          currentCouponDiscount > selectedCoupon.maxDiscountAmount
        ) {
          currentCouponDiscount = selectedCoupon.maxDiscountAmount;
        }
      } else {
        currentCouponDiscount = selectedCoupon.discountValue;
      }
    }
  }

  // Calculate tip amount (use custom tip if custom tip input is shown, otherwise use selected tip)
  const finalTipAmount = showCustomTipInput ? customTipAmount : tipAmount || 0;
  const giftPackagingFee = giftPackaging ? 30 : 0;
  const grandTotal = Math.max(
    0,
    discountedTotal +
    handlingCharge +
    deliveryCharge +
    finalTipAmount +
    giftPackagingFee -
    currentCouponDiscount
  );

  const handleApplyCoupon = async (coupon: ApiCoupon) => {
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(coupon.code, subtotalBeforeCoupon);
      if (result.success && result.data?.isValid) {
        const isFirstTime = !hasAppliedCouponBefore;
        setSelectedCoupon(coupon);
        setValidatedDiscount(result.data.discountAmount);
        setShowCouponSheet(false);
        if (isFirstTime) {
          setHasAppliedCouponBefore(true);
          setShowPartyPopper(true);
        }
      } else {
        setCouponError(result.message || "Invalid coupon");
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.message || "Failed to apply coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setSelectedCoupon(null);
    setValidatedDiscount(0);
    setCouponError(null);
  };

  const handleMoveToWishlist = async (product: any, variantId?: string, variantTitle?: string) => {
    if (!product?.id && !product?._id) return;

    const productId = product.id || product._id;

    try {
      if (!userLocation?.latitude || !userLocation?.longitude) {
        showGlobalToast(
          "Location is required to move items to wishlist",
          "error"
        );
        return;
      }

      // Add to wishlist
      await addToWishlist(
        productId,
        userLocation.latitude,
        userLocation.longitude
      );
      // Remove from cart
      await removeFromCart(productId, variantId, variantTitle);
      // Show success message
      showGlobalToast("Item moved to wishlist");
    } catch (error: any) {
      console.error("Failed to move to wishlist:", error);
      const msg =
        error.response?.data?.message || "Failed to move item to wishlist";
      showGlobalToast(msg, "error");
    }
  };

  const handlePlaceOrder = async (arg?: any) => {
    // Only bypass if explicitly passed true (handles event objects from onClick)
    const bypassProfileCheck = arg === true;

    if (!selectedAddress || cart.items.length === 0 || isSubmitting) {
      return;
    }

    // Check if user needs to complete their profile first
    if (!bypassProfileCheck && isPlaceholderUser) {
      setProfileFormData({
        name: user?.name === "User" ? "" : user?.name || "",
        email: user?.email?.endsWith("@Speedoo.temp") ? "" : user?.email || "",
      });
      setShowProfileModal(true);
      return;
    }

    // Validate required address fields
    if (!selectedAddress.city || !selectedAddress.pincode) {
      console.error("Address is missing required fields (city or pincode)");
      alert("Please ensure your address has city and pincode.");
      return;
    }

    setIsSubmitting(true);

    // Use user's current location as fallback if address doesn't have coordinates
    const finalLatitude = selectedAddress.latitude ?? userLocation?.latitude;
    const finalLongitude = selectedAddress.longitude ?? userLocation?.longitude;

    // Validate that we have location data (either from address or user's current location)
    if (finalLatitude == null || finalLongitude == null) {
      console.error(
        "Address is missing location data (latitude/longitude) and user location is not available"
      );
      alert(
        "Location is required for delivery. Please ensure your address has location data or enable location access."
      );
      return;
    }

    // Create address object with location data (use fallback if needed)
    const addressWithLocation: OrderAddress = {
      ...selectedAddress,
      latitude: finalLatitude,
      longitude: finalLongitude,
    };

    const orderId = `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;

    const order: Order = {
      id: orderId,
      items: cart.items,
      totalItems: cart.itemCount,
      subtotal: discountedTotal,
      fees: {
        platformFee: handlingCharge,
        deliveryFee: deliveryCharge,
      },
      totalAmount: grandTotal,
      address: addressWithLocation,
      paymentMethod: paymentMethod,
      status: "Placed",
      createdAt: new Date().toISOString(),
      tipAmount: finalTipAmount,
      gstin: gstin || undefined,
      couponCode: selectedCoupon?.code || undefined,
      giftPackaging: giftPackaging,
    };

    try {
      const placedId = await addOrder(order);
      if (placedId) {
        if (paymentMethod === "Online") {
          setPendingOrderId(placedId);
          setShowRazorpayCheckout(true);
        } else {
          setPlacedOrderId(placedId);
          clearCart();
          setShowOrderSuccess(true);
        }
      }
    } catch (error: any) {
      console.error("Order placement failed", error);
      // Show user-friendly error message
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        "Failed to place order. Please try again.";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToOrders = () => {
    if (placedOrderId) {
      navigate(`/orders/${placedOrderId}`);
    } else {
      navigate("/orders");
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedAddress?.id || !mapLocation) return;
    setIsUpdatingLocation(true);
    try {
      // Prepare update payload with existing details as fallback to prevent data loss or undefined values
      const updatePayload: any = {
        latitude: mapLocation.lat,
        longitude: mapLocation.lng,
        fullName: selectedAddress.name,
        phone: selectedAddress.phone,
        city: mapLocation.address?.city || selectedAddress.city,
        state: mapLocation.address?.state || selectedAddress.state,
        pincode: mapLocation.address?.pincode || selectedAddress.pincode,
        landmark: mapLocation.address?.landmark || selectedAddress.landmark,
        type: (selectedAddress as any).type || 'Home',
        address: mapLocation.address?.street || selectedAddress.street,
      };

      // Update the address in backend
      await updateAddress(selectedAddress.id, updatePayload);

      // Update local state
      const updated = {
        ...selectedAddress,
        latitude: mapLocation.lat,
        longitude: mapLocation.lng,
        street: mapLocation.address?.street || selectedAddress.street,
        city: mapLocation.address?.city || selectedAddress.city,
        state: mapLocation.address?.state || selectedAddress.state,
        pincode: mapLocation.address?.pincode || selectedAddress.pincode,
        landmark: mapLocation.address?.landmark || selectedAddress.landmark,
      };
      setSelectedAddress(updated);
      setSavedAddress(updated); // Sync
      setShowMapPicker(false);
      setIsMapSelected(true); // Mark map as selected
      showGlobalToast("Location and address updated successfully!");
    } catch (err) {
      console.error(err);
      // showGlobalToast('Failed to update location');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Handle profile completion submission
  const handleProfileSubmit = async () => {
    if (!profileFormData.name.trim() || !profileFormData.email.trim()) {
      setProfileError("Please enter both name and email");
      return;
    }

    setIsUpdatingProfile(true);
    setProfileError(null);

    try {
      const response = await updateProfile({
        name: profileFormData.name.trim(),
        email: user?.email || "", // Keep existing email
      });

      if (response.success) {
        // Update local user data
        updateUser({
          ...user,
          id: user?.id || "",
          name: response.data.name,
          email: response.data.email,
        });

        setShowProfileModal(false);
        showGlobalToast("Profile updated successfully!");

        // Directly trigger order placement, bypassing the profile check
        handlePlaceOrder(true);
      }
    } catch (error: any) {
      setProfileError(
        error.response?.data?.message ||
        "Failed to update profile. Please try again."
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div
      className="bg-white min-h-screen flex flex-col opacity-100 pb-24"
      style={{ opacity: 1 }}>
      {/* Party Popper Animation */}
      <PartyPopper
        show={showPartyPopper}
        onComplete={() => setShowPartyPopper(false)}
      />

      {/* Profile Completion Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowProfileModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">
                Complete Your Profile
              </h2>
              <p className="text-sm text-neutral-600 mb-4">
                Please provide your full name to continue with your order.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileFormData.name}
                    onChange={(e) =>
                      setProfileFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 transition-colors"
                    disabled={isUpdatingProfile}
                  />
                </div>

                {profileError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    {profileError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                    disabled={isUpdatingProfile}>
                    Cancel
                  </button>
                  <button
                    onClick={handleProfileSubmit}
                    disabled={
                      isUpdatingProfile ||
                      !profileFormData.name.trim()
                    }
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${isUpdatingProfile ||
                      !profileFormData.name.trim()
                      ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                      : "text-white shadow-lg"
                      }`}
                    style={!(isUpdatingProfile || !profileFormData.name.trim()) ? { backgroundColor: currentTheme.primary[2] } : {}}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Picker Modal */}
      <AnimatePresence>
        {showMapPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowMapPicker(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl overflow-hidden w-full max-w-lg shadow-xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-neutral-900">
                  Pin Delivery Location
                </h3>
                <button onClick={() => setShowMapPicker(false)}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <GoogleMapsLocationPicker
                initialLat={
                  mapLocation?.lat ||
                  userLocation?.latitude ||
                  selectedAddress?.latitude ||
                  0
                }
                initialLng={
                  mapLocation?.lng ||
                  userLocation?.longitude ||
                  selectedAddress?.longitude ||
                  0
                }
                onLocationSelect={(lat, lng, address) =>
                  setMapLocation({ lat, lng, address })
                }
                height="300px"
              />

              <div className="p-4 bg-white border-t">
                <p className="text-xs text-neutral-500 mb-3 text-center">
                  Move the map to set your exact delivery location
                </p>
                <button
                  onClick={handleUpdateLocation}
                  disabled={isUpdatingLocation}
                  className="w-full py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-70 flex justify-center items-center gap-2">
                  {isUpdatingLocation ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    "Confirm Location"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Success Celebration Page */}
      {showOrderSuccess && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
          style={{ animation: "fadeIn 0.3s ease-out" }}>
          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated confetti pieces */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: [
                    "#22c55e",
                    "#3b82f6",
                    "#f59e0b",
                    "#ef4444",
                    "#8b5cf6",
                    "#ec4899",
                  ][Math.floor(Math.random() * 6)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2
                    }s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>

          {/* Success Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* Success Tick Circle */}
            <div
              className="relative mb-8"
              style={{
                animation:
                  "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both",
              }}>
              {/* Outer ring animation */}
              <div
                className="absolute inset-0 w-32 h-32 rounded-full border-4"
                style={{
                  borderColor: currentTheme.accentColor,
                  animation: "ringPulse 1.5s ease-out infinite",
                  opacity: 0.3,
                }}
              />
              {/* Main circle */}
              <div 
                className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl"
                style={{ background: `linear-gradient(to bottom right, ${currentTheme.accentColor}, ${currentTheme.primary[2]})` }}
              >
                <svg
                  className="w-16 h-16 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: "checkDraw 0.5s ease-out 0.5s both" }}>
                  <path d="M5 12l5 5L19 7" className="check-path" />
                </svg>
              </div>
              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: "50%",
                    left: "50%",
                    animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                    transform: `rotate(${i * 60}deg) translateY(-80px)`,
                  }}
                />
              ))}
            </div>

            {/* Location Info */}
            <div
              className="text-center"
              style={{ animation: "slideUp 0.5s ease-out 0.6s both" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 text-red-500">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedAddress?.city || "Your Location"}
                </h2>
              </div>
              <p className="text-gray-500 text-base">
                {selectedAddress
                  ? `${selectedAddress.street}, ${selectedAddress.city}`
                  : "Delivery Address"}
              </p>
            </div>

            {/* Order Placed Message */}
            <div
              className="mt-12 text-center"
              style={{ animation: "slideUp 0.5s ease-out 0.8s both" }}>
              <h3 className="text-3xl font-bold mb-2" style={{ color: currentTheme.primary[2] }}>
                Order Placed!
              </h3>
              <p className="text-gray-600">Your order is on the way</p>
            </div>

            <button
              onClick={handleGoToOrders}
              className="mt-10 text-white font-semibold py-4 px-12 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ backgroundColor: currentTheme.primary[2], animation: "slideUp 0.5s ease-out 1s both" }}>
              Track Your Order
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div 
        className="sticky top-0 z-[60] shadow-sm"
        style={{ backgroundColor: currentTheme.primary[2] }}
      >
        <div className="px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-white p-1 rounded-full hover:bg-black/10 transition-colors"
            aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white tracking-tight">Checkout</h1>
        </div>
      </div>


      {/* Saved Address Section */}
      {savedAddress && (
        <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 border-b border-neutral-200">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-neutral-900 mb-0.5">
                Delivery Address
              </h3>
              <p className="text-[10px] text-neutral-600">
                Select or edit your saved address
              </p>
            </div>
            {allAddresses.length > 1 && (
              <button
                onClick={() => setShowAddressSheet(true)}
                className="text-xs font-bold px-3 py-1 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                style={{ borderColor: currentTheme.primary[2], color: currentTheme.primary[2] }}
              >
                Change
              </button>
            )}
          </div>


          <div
            className={`border rounded-lg p-2.5 cursor-pointer transition-all ${selectedAddress && !isMapSelected
              ? "border-opacity-100"
              : "border-neutral-300 bg-white"
              }`}
            style={selectedAddress && !isMapSelected ? { borderColor: currentTheme.primary[2], backgroundColor: `${currentTheme.primary[2]}10` } : {}}
            onClick={() => {
              setSelectedAddress(savedAddress);
              setIsMapSelected(false);
            }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={selectedAddress && !isMapSelected 
                      ? { borderColor: currentTheme.primary[2], backgroundColor: currentTheme.primary[2] } 
                      : { borderColor: "#A3A3A3" }}
                  >
                    {selectedAddress && !isMapSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-900">
                    {savedAddress.name}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-600 mb-0.5">
                  {savedAddress.phone}
                </p>
                <p className="text-[10px] text-neutral-600">
                  {savedAddress.flat ? `${savedAddress.flat}, ` : ""}
                  {savedAddress.street}
                  {savedAddress.landmark ? (
                    <>
                      ,{" "}
                      <span className="font-medium" style={{ color: currentTheme.primary[2] }}>
                        Near {savedAddress.landmark}
                      </span>
                    </>
                  ) : (
                    ""
                  )}
                  , {savedAddress.city} - {savedAddress.pincode}
                </p>
              </div>
                <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/checkout/address", {
                    state: {
                      editAddress: savedAddress,
                    },
                  });
                }}
                className="text-xs font-medium ml-2"
                style={{ color: currentTheme.primary[2] }}
              >
                Edit
              </button>
            </div>
          </div>
          {/* Set Location on Map Button */}
          <div className="mt-2.5">
            <button
              onClick={() => {
                // Prioritize current GPS location (matches homepage header), then saved address
                setMapLocation({
                  lat: userLocation?.latitude || selectedAddress?.latitude || 0,
                  lng:
                    userLocation?.longitude || selectedAddress?.longitude || 0,
                });
                setShowMapPicker(true);
              }}
              className={`flex items-center gap-3 text-base font-bold px-5 py-4 rounded-xl w-full justify-center transition-all border-2 ${isMapSelected
                ? "ring-2"
                : "hover:bg-opacity-80"
                }`}
              style={{
                backgroundColor: isMapSelected ? `${currentTheme.accentColor}15` : `${currentTheme.primary[2]}10`,
                borderColor: isMapSelected ? currentTheme.accentColor : currentTheme.primary[2],
                color: isMapSelected ? currentTheme.accentColor : currentTheme.primary[2],
                boxShadow: isMapSelected ? `0 0 0 2px ${currentTheme.accentColor}` : "none"
              }}>
              {isMapSelected ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {isMapSelected
                ? "Precise Location Selected"
                : selectedAddress?.latitude
                  ? "Update Precise Location on Map"
                  : "Set Exact Location on Map"}
            </button>
          </div>
        </div>
      )}


      {/* Main Product Card */}
      <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 bg-white border-b border-neutral-200">
        <div className="bg-white rounded-lg border border-neutral-200 p-2.5">
          {/* Delivery info */}
          <div className="flex items-center gap-1.5 mb-2">
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: currentTheme.primary[2] }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                <path
                  d="M12 6v6l4 2"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold text-neutral-900">
              Delivery in {cart.estimatedDeliveryTime || appConfig.estimatedDeliveryTime}
            </span>
          </div>

          <p className="text-[10px] text-neutral-600 mb-2.5">
            Shipment of {displayCart.itemCount || 0}{" "}
            {(displayCart.itemCount || 0) === 1 ? "item" : "items"}
          </p>

          {/* Cart Items */}
          <div className="space-y-2.5">
            {displayItems
              .filter((item) => item.product)
              .map((item) => (
                <div
                  key={item.product?.id || Math.random()}
                  className="flex gap-2">
                  {/* Product Image */}
                  <div className="w-12 h-12 bg-neutral-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {item.product?.imageUrl ? (
                      <img
                        src={item.product?.imageUrl}
                        alt={item.product?.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        {(item.product?.name || "").charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-neutral-900 mb-0.5 line-clamp-2">
                      {item.product?.name}
                    </h3>
                    <p className="text-[10px] text-neutral-600 mb-0.5">
                      {item.quantity} × {item.product?.pack}
                    </p>
                      <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const variantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id || item.variant;
                        const variantTitle = (item.product as any).variantTitle || item.product.pack;
                        handleMoveToWishlist(item.product, variantId, variantTitle);
                      }}
                      className="text-[10px] font-medium mb-1.5 transition-colors"
                      style={{ color: currentTheme.primary[2] }}
                    >
                      Move to wishlist
                    </button>

                    {/* Quantity Selector */}
                    <div className="flex items-center justify-between mt-1.5">
                      <div 
                        className="flex items-center gap-1.5 bg-white border-2 rounded-full px-1.5 py-0.5"
                        style={{ borderColor: currentTheme.primary[2] }}
                      >
                        <button
                          onClick={() => {
                            const variantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id || item.variant;
                            const variantTitle = (item.product as any).variantTitle || item.product.pack;
                            updateQuantity(item.product?.id, item.quantity - 1, variantId, variantTitle);
                          }}
                          className="w-5 h-5 flex items-center justify-center font-bold rounded-full transition-colors text-xs"
                          style={{ color: currentTheme.primary[2] }}
                        >
                          −
                        </button>
                        <span className="text-xs font-bold min-w-[1.25rem] text-center" style={{ color: currentTheme.primary[2] }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => {
                            const variantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id || item.variant;
                            const variantTitle = (item.product as any).variantTitle || item.product.pack;
                            updateQuantity(item.product?.id, item.quantity + 1, variantId, variantTitle);
                          }}
                          className="w-5 h-5 flex items-center justify-center font-bold rounded-full transition-colors text-xs"
                          style={{ color: currentTheme.primary[2] }}
                        >
                          +
                        </button>
                      </div>

                      {/* Price */}
                      {(() => {
                        const { displayPrice, mrp, hasDiscount } =
                          calculateProductPrice(item.product, item.variant);
                        return (
                          <div className="flex items-center gap-1.5">
                            {hasDiscount && (
                              <span className="text-[10px] text-neutral-500 line-through">
                                ₹{mrp}
                              </span>
                            )}
                            <span className="text-sm font-bold text-neutral-900">
                              ₹{displayPrice}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* You might also like */}
      {similarProducts.length > 0 && (
        <div className="px-4 md:px-6 lg:px-8 py-2.5 md:py-3 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">
            You might also like
          </h2>
          <div
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-3"
            style={{ scrollSnapType: "x mandatory" }}>
          {similarProducts.map((product) => {
            // Get price details
            const { displayPrice, mrp, discount, hasDiscount } =
              calculateProductPrice(product);

            // Get quantity in cart
            const productId = product.id || product._id;
            const inCartItem = (cart?.items || []).find((item) => {
              const itemProductId = item.product?.id || item.product?._id;
              return itemProductId === productId;
            });
            const inCartQty = inCartItem?.quantity || 0;

            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-[140px]"
                style={{ scrollSnapAlign: "start" }}>
                <div
                  className="bg-white rounded-lg overflow-hidden flex flex-col relative h-full"
                  style={{ boxShadow: "0 1px 1px rgba(0, 0, 0, 0.03)" }}>
                  {/* Product Image Area */}
                  <div
                    onClick={() =>
                      navigate(`/product/${product.id || product._id}`)
                    }
                    className="relative block cursor-pointer">
                    <div className="w-full h-28 bg-neutral-100 flex items-center justify-center overflow-hidden relative">
                      {product.imageUrl || product.mainImage ? (
                        <img
                          src={normalizeImageUrl(product.imageUrl || product.mainImage)}
                          alt={product.name || product.productName || "Product"}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (
                              parent &&
                              !parent.querySelector(".fallback-icon")
                            ) {
                              const fallback = document.createElement("div");
                              fallback.className =
                                "w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon";
                              fallback.textContent = (
                                product.name ||
                                product.productName ||
                                "?"
                              )
                                .charAt(0)
                                .toUpperCase();
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
                          {(product.name || product.productName || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}

                      {/* Red Discount Badge - Top Left */}
                      {discount > 0 && (
                        <div className="absolute top-1 left-1 z-10 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                          {discount}% OFF
                        </div>
                      )}

                      {/* Heart Icon - Top Right */}
                      <WishlistButton
                        productId={product.id || product._id}
                        size="sm"
                        className="top-1 right-1 shadow-sm"
                      />

                      {/* ADD Button or Quantity Stepper - Overlaid on bottom right of image */}
                      <div className="absolute bottom-1.5 right-1.5 z-10">
                        <AnimatePresence mode="wait">
                          {inCartQty === 0 ? (
                            <motion.button
                              key="add-button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCart(product, e.currentTarget);
                              }}
                              className="bg-white/95 backdrop-blur-sm text-[10px] font-semibold px-2 py-1 rounded shadow-md hover:bg-white transition-colors border-2"
                              style={{ borderColor: currentTheme.primary[2], color: currentTheme.primary[2] }}
                            >
                              ADD
                            </motion.button>
                          ) : (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center gap-1 rounded px-1.5 py-1 shadow-md"
                              style={{ backgroundColor: currentTheme.primary[2] }}
                              onClick={(e) => e.stopPropagation()}>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateQuantity(productId, inCartQty - 1);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-black/10 rounded transition-colors p-0 leading-none"
                                style={{ lineHeight: 1, fontSize: "14px" }}>
                                <span className="relative top-[-1px]">−</span>
                              </motion.button>
                              <motion.span
                                key={inCartQty}
                                initial={{ scale: 1.2, y: -2 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 15,
                                }}
                                className="text-white font-bold min-w-[0.75rem] text-center"
                                style={{ fontSize: "12px" }}>
                                {inCartQty}
                              </motion.span>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateQuantity(productId, inCartQty + 1);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
                                style={{ lineHeight: 1, fontSize: "14px" }}>
                                <span className="relative top-[-1px]">+</span>
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-1.5 flex-1 flex flex-col bg-white">
                    {/* Light Grey Tags */}
                    <div className="flex gap-0.5 mb-0.5">
                      <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded">
                        {product.pack || "1 unit"}
                      </div>
                      {product.pack &&
                        (product.pack.includes("g") ||
                          product.pack.includes("kg")) && (
                          <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded">
                            {product.pack.replace(/[gk]/gi, "").trim()} GSM
                          </div>
                        )}
                    </div>

                    {/* Product Name */}
                    <div
                      onClick={() =>
                        navigate(`/product/${product.id || product._id}`)
                      }
                      className="mb-0.5 cursor-pointer">
                      <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight">
                        {product.name || product.productName || "Product"}
                      </h3>
                    </div>

                    {/* Rating and Reviews */}
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill={i < 4 ? "#fbbf24" : "#e5e7eb"}
                            xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[8px] text-neutral-500">(85)</span>
                    </div>

                    {/* Delivery Time */}
                    <div className="text-[9px] text-neutral-600 mb-0.5">
                      20 MINS
                    </div>

                    {/* Discount - Blue Text */}
                    {discount > 0 && (
                      <div className="text-[9px] text-blue-600 font-semibold mb-0.5">
                        {discount}% OFF
                      </div>
                    )}

                    {/* Price */}
                    <div className="mb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[13px] font-bold text-neutral-900">
                          ₹{(displayPrice || 0).toLocaleString("en-IN")}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-neutral-400 line-through">
                            ₹{(mrp || 0).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Link */}
                    <div
                      onClick={() => {
                        const catId = product.categoryId || product.category;
                        const finalCatId = typeof catId === "object" ? (catId?._id || catId?.id) : catId;
                        navigate(`/category/${finalCatId || "all"}`);
                      }}
                      className="w-full text-[8px] font-medium py-0.5 rounded-lg flex items-center justify-between px-1 transition-colors mt-auto cursor-pointer"
                      style={{ backgroundColor: `${currentTheme.primary[2]}20`, color: currentTheme.primary[2] }}
                    >
                      <span>See more like this</span>
                      <div className="flex items-center gap-0.5">
                        <div className="w-px h-2" style={{ backgroundColor: `${currentTheme.primary[2]}40` }}></div>
                        <svg
                          width="6"
                          height="6"
                          viewBox="0 0 8 8"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 0L8 4L0 8Z" fill="currentColor" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

      {/* Address Selection Sheet */}
      <Sheet open={showAddressSheet} onOpenChange={setShowAddressSheet}>
        <SheetContent side="bottom" className="rounded-t-[2rem] p-0 overflow-hidden border-none max-h-[85vh]">
          <SheetHeader className="px-6 py-5 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-black text-neutral-900 tracking-tight">
                Select Address
              </SheetTitle>
              <SheetClose className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)] bg-neutral-50/50">
            <div className="space-y-3 pb-6">
              {allAddresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => {
                    setSelectedAddress(addr);
                    setSavedAddress(addr);
                    setIsMapSelected(false);
                    setShowAddressSheet(false);
                    showGlobalToast(`Switched to ${addr.name}'s address`);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group hover:shadow-md ${
                    selectedAddress?.id === addr.id
                      ? "bg-white"
                      : "bg-white/60 border-transparent hover:border-neutral-200"
                  }`}
                  style={selectedAddress?.id === addr.id ? { borderColor: currentTheme.primary[2] } : {}}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors"
                      style={selectedAddress?.id === addr.id 
                        ? { borderColor: currentTheme.primary[2], backgroundColor: currentTheme.primary[2] } 
                        : { borderColor: "#D4D4D4" }}
                    >
                      {selectedAddress?.id === addr.id && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-neutral-900 truncate">{addr.name}</span>
                        {(addr as any).type && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full uppercase tracking-wider">
                            {(addr as any).type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 mb-1 font-medium">{addr.phone}</p>
                      <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                        {addr.street}, {addr.city} - {addr.pincode}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              <button
                onClick={() => {
                  setShowAddressSheet(false);
                  navigate("/checkout/address");
                }}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-neutral-400 hover:text-neutral-600 transition-all bg-white/40"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add New Address
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Get FREE delivery banner */}

      {deliveryCharge > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2 mb-1.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 13h14M5 13l4-4m-4 4l4 4"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="5" r="2" fill="#3b82f6" />
            </svg>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700">
                  Get FREE delivery
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 18l6-6-6-6"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[10px] text-blue-600 mt-0.5">
                Add products worth ₹{amountNeededForFreeDelivery.toLocaleString('en-IN')} more
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  ((199 - amountNeededForFreeDelivery) / 199) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Coupon Section */}
      {selectedCoupon ? (
        <div className="px-4 py-1.5 border-b border-neutral-200">
          <div 
             className="flex items-center justify-between rounded-lg p-2 border"
             style={{ backgroundColor: `${currentTheme.accentColor}10`, borderColor: `${currentTheme.accentColor}20` }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div 
                 className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ backgroundColor: currentTheme.accentColor }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: currentTheme.accentColor }}>
                  {selectedCoupon.code}
                </p>
                <p className="text-[10px] truncate" style={{ color: currentTheme.accentColor }}>
                  {selectedCoupon.title}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-xs font-medium ml-2 flex-shrink-0"
              style={{ color: currentTheme.accentColor }}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-1.5 flex justify-end border-b border-neutral-200">
          <button
            onClick={() => setShowCouponSheet(true)}
            className="text-xs text-neutral-600 flex items-center gap-1">
            See all coupons
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Bill details */}
      <div className="px-4 md:px-6 lg:px-8 py-2.5 md:py-3 border-b border-neutral-200">
        <h2 className="text-base font-bold text-neutral-900 mb-2.5">
          Bill details
        </h2>

        <div className="space-y-2">
          {/* Items total */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-700">Items total</span>
              {savedAmount > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                  Saved ₹{savedAmount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {itemsTotal > discountedTotal && (
                <span className="text-xs text-neutral-500 line-through">
                  ₹{itemsTotal}
                </span>
              )}
              <span className="text-xs font-medium text-neutral-900">
                ₹{discountedTotal}
              </span>
            </div>
          </div>

          {/* Handling charge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              <span className="text-xs text-neutral-700">Handling charge</span>
            </div>
            <span className="text-xs font-medium text-neutral-900">
              ₹{handlingCharge}
            </span>
          </div>

          {/* Delivery charge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="5.5" cy="18.5" r="1.5" fill="currentColor" />
                <circle cx="18.5" cy="18.5" r="1.5" fill="currentColor" />
              </svg>
              <span className="text-xs text-neutral-700">Delivery charge</span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className="text-xs font-medium"
                style={deliveryCharge === 0 ? { color: currentTheme.primary[2] } : { color: "#171717" }}
              >
                {deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge}`}
              </span>
              {deliveryCharge > 0 && (
                <span className="text-[10px] text-orange-600 mt-0.5">
                  Shop for ₹{amountNeededForFreeDelivery} more to get FREE delivery
                </span>
              )}
            </div>
          </div>

          {/* Coupon discount */}
          {selectedCoupon && currentCouponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs text-neutral-700">
                  Coupon discount
                </span>
                <span 
                   className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                   style={{ backgroundColor: `${currentTheme.accentColor}10`, color: currentTheme.accentColor }}
                >
                  {selectedCoupon.code}
                </span>
              </div>
              <span className="text-xs font-medium" style={{ color: currentTheme.accentColor }}>
                -₹{currentCouponDiscount.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Tip amount */}
          {finalTipAmount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs text-neutral-700">
                  Tip to delivery partner
                </span>
              </div>
              <span className="text-xs font-medium text-neutral-900">
                ₹{finalTipAmount}
              </span>
            </div>
          )}



          {/* Grand total */}
          <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-900">
              Grand total
            </span>
            <span className="text-sm font-bold text-neutral-900">
              ₹{Math.max(0, grandTotal)}
            </span>
          </div>
        </div>
      </div>




      {/* Made with love by Speedoo */}
      <div className="px-4 py-2">
        <div className="w-full flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-neutral-500">
            <span className="text-[10px] font-medium">Made with</span>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
              className="text-red-500 text-sm">
              ❤️
            </motion.span>
            <span className="text-[10px] font-medium">by</span>
            <span className="text-[10px] font-bold" style={{ color: currentTheme.primary[2] }}>
              Speedoo
            </span>
          </div>
        </div>
      </div>




      {/* Payment Method Selection */}
      <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50/50">
        <h3 className="text-sm font-bold text-neutral-900 mb-2">Payment Method</h3>
        <div className="space-y-2">
          {/* Online Payment Option */}
          <div
            onClick={() => setPaymentMethod("Online")}
            className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
            style={paymentMethod === "Online" 
              ? { borderColor: currentTheme.primary[2], backgroundColor: `${currentTheme.primary[2]}10` } 
              : { borderColor: "#E5E5E5", backgroundColor: "white" }}
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={paymentMethod === "Online" 
                ? { backgroundColor: `${currentTheme.primary[2]}20`, color: currentTheme.primary[2] } 
                : { backgroundColor: "#F5F5F5", color: "#737373" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div>
              <span 
                className="text-xs font-bold block transition-colors"
                style={{ color: paymentMethod === "Online" ? currentTheme.primary[2] : "#171717" }}
              >
                Online Payment
              </span>
              <span className="text-[10px] text-neutral-500">Secure payment via Razorpay</span>
            </div>
            {paymentMethod === "Online" && (
              <div className="ml-auto">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentTheme.primary[2] }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          {/* COD Option */}
          <div
            onClick={() => setPaymentMethod("COD")}
            className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
            style={paymentMethod === "COD" 
              ? { borderColor: currentTheme.primary[2], backgroundColor: `${currentTheme.primary[2]}10` } 
              : { borderColor: "#E5E5E5", backgroundColor: "white" }}
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={paymentMethod === "COD" 
                ? { backgroundColor: `${currentTheme.primary[2]}20`, color: currentTheme.primary[2] } 
                : { backgroundColor: "#F5F5F5", color: "#737373" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div>
              <span 
                className="text-xs font-bold block transition-colors"
                style={{ color: paymentMethod === "COD" ? currentTheme.primary[2] : "#171717" }}
              >
                Cash on Delivery
              </span>
              <span className="text-[10px] text-neutral-500">Pay when you receive your order</span>
            </div>
            {paymentMethod === "COD" && (
              <div className="ml-auto">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: currentTheme.primary[2] }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coupon Sheet Modal */}
      <Sheet open={showCouponSheet} onOpenChange={setShowCouponSheet}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between mb-2">
              <SheetTitle className="text-base font-bold text-neutral-900">
                Available Coupons
              </SheetTitle>
              <SheetClose onClick={() => setShowCouponSheet(false)}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-80px)]">
            <div className="space-y-2.5 mt-2">
              {availableCoupons.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <p>No coupons available at the moment.</p>
                </div>
              ) : (
                availableCoupons.map((coupon) => {
                  const subtotalBeforeCoupon =
                    discountedTotal + handlingCharge + deliveryCharge;
                  const meetsMinOrder =
                    !coupon.minOrderValue ||
                    subtotalBeforeCoupon >= coupon.minOrderValue;
                  const isSelected = selectedCoupon?._id === coupon._id;

                  return (
                    <div
                      key={coupon._id}
                      className="border-2 rounded-lg p-2.5 transition-all"
                      style={isSelected 
                        ? { borderColor: currentTheme.accentColor, backgroundColor: `${currentTheme.accentColor}10` } 
                        : meetsMinOrder 
                          ? { borderColor: "#E5E5E5", backgroundColor: "white" } 
                          : { borderColor: "#E5E5E5", backgroundColor: "#F5F5F5", opacity: 0.6 }}
                      >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold" style={{ color: currentTheme.accentColor }}>
                              {coupon.code}
                            </span>
                            <span className="text-xs font-semibold text-neutral-900">
                              {coupon.title}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-600 mb-1">
                            {coupon.description}
                          </p>
                          {coupon.minOrderValue && (
                            <p className="text-[10px] text-neutral-500">
                              Min. order: ₹{coupon.minOrderValue}
                            </p>
                          )}
                        </div>
                        {isSelected ? (
                          <div className="flex items-center gap-1" style={{ color: currentTheme.accentColor }}>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M20 6L9 17l-5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="text-xs font-medium">Applied</span>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              meetsMinOrder && handleApplyCoupon(coupon)
                            }
                            disabled={!meetsMinOrder || isValidatingCoupon}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${meetsMinOrder
                              ? "text-white shadow-md"
                              : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                              }`}
                              style={meetsMinOrder && !isValidatingCoupon ? { backgroundColor: currentTheme.accentColor } : {}}
                            >
                            {isValidatingCoupon ? "..." : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Sticky Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-[60] shadow-lg">
        {selectedAddress ? (
          <button
            onClick={handlePlaceOrder}
            disabled={cart.items.length === 0 || isSubmitting}
            className={`w-full py-3 px-4 font-bold text-sm uppercase tracking-wide transition-colors ${(cart.items.length > 0 && !isSubmitting)
              ? "text-black shadow-[0_-4px_10px_rgba(0,0,0,0.1)]"
              : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
              }`}
            style={(cart.items.length > 0 && !isSubmitting) ? { backgroundColor: currentTheme.accentColor } : {}}
          >
            {isSubmitting ? "Processing..." : "Place Order"}
          </button>
        ) : (
          <button
            onClick={() =>
              navigate("/checkout/address", {
                state: {
                  editAddress: savedAddress,
                },
              })
            }
            className="w-full text-black py-3 px-4 font-bold text-sm uppercase tracking-wide transition-colors shadow-[0_-4px_10px_rgba(0,0,0,0.1)]"
            style={{ backgroundColor: currentTheme.accentColor }}
          >
            Choose address at next step
          </button>
        )}
      </div>

      {/* Razorpay Checkout Modal */}
      {
        showRazorpayCheckout && pendingOrderId && user && (
          <RazorpayCheckout
            orderId={pendingOrderId}
            amount={grandTotal}
            customerDetails={{
              name: user.name || "Customer",
              email: user.email || "",
              phone: user.phone || "",
            }}
            onSuccess={(paymentId) => {
              setShowRazorpayCheckout(false);
              setPlacedOrderId(pendingOrderId);
              setPendingOrderId(null);
              clearCart();
              setShowOrderSuccess(true);
              showGlobalToast("Payment successful!", "success");
            }}
            onFailure={(error) => {
              setShowRazorpayCheckout(false);
              setPendingOrderId(null);
              showGlobalToast(error || "Payment failed. Please try again.", "error");
            }}
          />
        )
      }
      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }

        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }

        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
    </div >
  );
}
