import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getWishlist, removeFromWishlist } from '../../services/api/customerWishlistService';
import { Product } from '../../types/domain';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../hooks/useLocation';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateProductPrice } from '../../utils/priceUtils';
import { useAuth } from '../../context/AuthContext';
import AuthPrompt from '../../components/AuthPrompt';
import { normalizeImageUrl } from '../../utils/imageUrl';

export default function Wishlist() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { location } = useLocation();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const res = await getWishlist({
        latitude: location?.latitude,
        longitude: location?.longitude
      });
      
      // Defensive check for res and res.data
      if (res?.success && res?.data?.products && Array.isArray(res.data.products)) {
        setProducts(res.data.products.map(p => ({
          ...p,
          id: p._id || (p as any).id,
          name: p.productName || (p as any).name || 'Unknown Product',
          imageUrl: normalizeImageUrl(p.mainImageUrl || p.mainImage || (p as any).imageUrl),
          price: (p as any).price || (p as any).variations?.[0]?.price || 0,
          pack: (p as any).pack || (p as any).variations?.[0]?.name || 'Standard'
        })) as any);
      } else {
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch wishlist:', error);
      showToast(error.message || 'Failed to fetch wishlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [location?.latitude, location?.longitude, isAuthenticated]);


  const handleRemove = async (productId: string) => {
    try {
      await removeFromWishlist(productId);
      setProducts(products.filter(p => (p.id !== productId && p._id !== productId)));
      showToast('Removed from wishlist', 'success');
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      showToast('Failed to remove item', 'error');
    }
  };

  return (
    <div className="pb-24 md:pb-8 bg-gradient-to-br from-white via-yellow-50/20 to-purple-50/20 min-h-screen">
      {/* Premium Header */}
      <div className="px-4 py-6 bg-white/70 backdrop-blur-md border-b border-purple-100/50 sticky top-0 z-10 flex items-center gap-4">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-purple-100 text-purple-600"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18L9 12L15 6" />
          </svg>
        </motion.button>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-800 to-purple-600 bg-clip-text text-transparent">My Wishlist</h1>
          <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
            {products.length} {products.length === 1 ? 'Item' : 'Items'} Saved
          </p>
        </div>
      </div>

      <div className="px-4 py-4">
        {!isAuthenticated ? (
          <AuthPrompt 
            title="Your Wishlist" 
            description="Login to see your saved products."
            icon="💝"
          />

        ) : loading ? (

          <div className="flex flex-col items-center justify-center pt-20 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-purple-600 animate-pulse">Loading your favorites...</p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {products.map((product) => {
                const { displayPrice, mrp, hasDiscount } = calculateProductPrice(product);
                return (
                  <motion.div
                    key={product.id || Math.random().toString()}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ y: -4 }}
                    className="bg-white rounded-2xl border border-purple-50 shadow-[0_4px_20px_-4px_rgba(123,31,162,0.08)] overflow-hidden flex flex-col relative group"
                  >
                    {/* Remove Button */}
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={() => handleRemove(product.id)}
                      className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-red-500 shadow-md border border-red-50 hover:bg-red-50 transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </motion.button>

                    {/* Product Image */}
                    <Link to={`/product/${product.id}`} className="aspect-square bg-gradient-to-b from-neutral-50 to-white flex items-center justify-center p-4">
                      {product.imageUrl || product.mainImage ? (
                        <motion.img 
                          layoutId={`product-image-${product.id}`}
                          src={product.imageUrl || product.mainImage} 
                          alt={product.name} 
                          className="w-full h-full object-contain drop-shadow-sm" 
                        />
                      ) : (
                        <span className="text-4xl filter grayscale">📦</span>
                      )}
                    </Link>

                    {/* Product Info */}
                    <div className="p-3 flex-1 flex flex-col">
                      <h3 className="text-[13px] font-bold text-neutral-900 line-clamp-2 leading-tight mb-1 group-hover:text-purple-700 transition-colors">
                        {product.name}
                      </h3>
                      <div className="text-[10px] font-semibold text-neutral-400 mb-2 bg-neutral-100 self-start px-2 py-0.5 rounded-full">
                        {product.pack}
                      </div>
                      
                      <div className="mt-auto pt-2 space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-neutral-900">₹{displayPrice.toLocaleString('en-IN')}</span>
                          {hasDiscount && (
                            <span className="text-[10px] text-neutral-400 line-through font-medium">₹{mrp.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                        
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => addToCart(product)}
                          className="w-full bg-gradient-to-r from-[#6D0736] via-[#943521] to-[#B95F15] text-white rounded-xl py-2 text-[11px] font-black uppercase tracking-wider shadow-md hover:opacity-90 transition-all"
                        >
                          Add to Cart
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 px-8"
          >
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-20"></div>
              <div className="relative w-full h-full bg-white rounded-full shadow-inner flex items-center justify-center text-6xl">
                💝
              </div>
            </div>
            <h2 className="text-xl font-bold text-purple-900 mb-2">Empty Wishlist?</h2>
            <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
              Looks like you haven't saved anything yet. Shortlist products you love and they'll show up here!
            </p>
            <Button 
              onClick={() => navigate('/')} 
              className="bg-gradient-to-r from-[#6D0736] via-[#943521] to-[#B95F15] text-white rounded-2xl px-10 py-4 shadow-lg shadow-orange-100 font-bold active:scale-95 transition-transform"
            >
              Discover Products
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

