import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../../hooks/useOrders';
import { useCart } from '../../context/CartContext';
import { getProducts } from '../../services/api/customerProductService';
import WishlistButton from '../../components/WishlistButton';
import { calculateProductPrice } from '../../utils/priceUtils';
import { useThemeContext } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AuthPrompt from '../../components/AuthPrompt';


export default function OrderAgain() {
  const { isAuthenticated } = useAuth();
  const { orders } = useOrders();

  const { cart, addToCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const { currentTheme } = useThemeContext();

  const brandPrimary = currentTheme.primary[2] || '#9048A5';

  // Extract unique products from previous orders
  const previousProducts = useMemo(() => {
    if (!orders) return [];
    const productsMap = new Map();
    
    // Process orders from newest to oldest to keep latest variation/info if any
    [...orders].reverse().forEach(order => {
      order.items.forEach(item => {
        if (item.product && item.product.id) {
          productsMap.set(item.product.id, item.product);
        }
      });
    });
    
    return Array.from(productsMap.values());
  }, [orders]);

  const hasOrders = previousProducts.length > 0;

  return (
    <div className="pb-24 bg-neutral-50 min-h-screen">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 shadow-md" style={{ background: `linear-gradient(to right, ${currentTheme.primary[0]}, ${currentTheme.primary[1]})` }}>
        <div className="px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95"
            aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18L9 12L15 6" />
            </svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white tracking-tight">
              Reorder
            </h1>
            <p className="text-[11px] text-white/80 font-bold uppercase tracking-widest">
              Your Favorites
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {!isAuthenticated ? (
          <AuthPrompt 
            title="Reorder Favorites" 
            description="Login to reorder your favorites."
            icon="🔄"
          />

        ) : hasOrders ? (

          <>
            <h2 className="text-lg font-black text-neutral-900 mb-4 px-1">Previously Ordered Items</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-6">
              {previousProducts.map((product) => {
                const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);
                const cartItem = cart.items.find(item => item?.product && item.product.id === product.id);
                const inCartQty = cartItem?.quantity || 0;

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full"
                  >
                    {/* Image Container */}
                    <div className="relative group aspect-square bg-neutral-50 p-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={product.mainImage || product.imageUrl}
                        alt={product.productName || product.name}
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                        onClick={() => navigate(`/product/${product.id}`)}
                      />
                      
                      {/* Red Discount Badge */}
                      {discount > 0 && (
                        <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">
                          {discount}% OFF
                        </div>
                      )}

                      {/* Wishlist Button */}
                      <WishlistButton
                        productId={product.id}
                        size="sm"
                        className="top-2 right-2 shadow-md bg-white/80 backdrop-blur-sm"
                      />

                      {/* ADD Button or Quantity Stepper */}
                      <div className="absolute bottom-2 right-2 z-20">
                        <AnimatePresence mode="wait">
                          {inCartQty === 0 ? (
                            <motion.button
                              key="add-button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCart(product);
                              }}
                              className="bg-white text-purple-700 border-2 border-purple-700 text-[10px] font-black px-4 py-1.5 rounded-xl shadow-lg hover:bg-purple-50 transition-all active:scale-95"
                            >
                              ADD
                            </motion.button>
                          ) : (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-2 bg-neutral-900 rounded-xl px-2 py-1.5 shadow-lg border border-white/20"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product.id, inCartQty - 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-white font-bold hover:bg-white/10 rounded-lg transition-all"
                              >
                                <span className="text-sm">−</span>
                              </button>
                              <span className="text-white font-black text-xs min-w-[1rem] text-center">
                                {inCartQty}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product.id, inCartQty + 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-white font-bold hover:bg-white/10 rounded-lg transition-all"
                              >
                                <span className="text-sm">+</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="text-[11px] font-bold text-neutral-800 line-clamp-2 leading-tight mb-1" onClick={() => navigate(`/product/${product.id}`)}>
                        {product.productName || product.name}
                      </h3>
                      <p className="text-[10px] text-neutral-400 font-medium mb-2 uppercase tracking-wide">
                        {product.pack || product.smallDescription || 'Standard Pack'}
                      </p>
                      
                      <div className="mt-auto pt-2 border-t border-neutral-50">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-black text-neutral-900">
                            ₹{displayPrice.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <span className="text-[10px] text-neutral-300 line-through font-bold">
                              ₹{mrp.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-48 h-48 bg-purple-50 rounded-full flex items-center justify-center mb-8 relative">
              <span className="text-8xl">🛍️</span>
              <div className="absolute -bottom-2 -right-2 bg-white p-3 rounded-2xl shadow-xl">
                <span className="text-3xl">✨</span>
              </div>
            </div>
            <h2 className="text-2xl font-black text-neutral-900 mb-2">Start your journey!</h2>
            <p className="text-neutral-500 text-sm max-w-xs leading-relaxed mb-8 font-medium">
              Items you order will magically appear here for lightning-fast reordering.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3.5 bg-neutral-900 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              Explore Products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
