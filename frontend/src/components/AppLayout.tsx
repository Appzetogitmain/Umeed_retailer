import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FloatingCartPill from './FloatingCartPill';
import { useLocation as useLocationContext } from '../hooks/useLocation';
import LocationPermissionRequest from './LocationPermissionRequest';
import ComingSoonScreen from './ComingSoonScreen';
import { useThemeContext } from '../context/ThemeContext';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categoriesRotation, setCategoriesRotation] = useState(0);
  const [prevCategoriesActive, setPrevCategoriesActive] = useState(false);
  const { isLocationEnabled, isLocationLoading, location: userLocation, hasSellersInRange, isServiceAreaLoading } = useLocationContext();
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [showLocationChangeModal, setShowLocationChangeModal] = useState(false);
  const { currentTheme } = useThemeContext();

  const isActive = (path: string) => location.pathname === path;

  // Check if location is required for current route
  const requiresLocation = () => {
    const publicRoutes = ['/login', '/signup', '/seller/login', '/seller/signup', '/delivery/login', '/delivery/signup', '/admin/login'];
    // Don't require location on login/signup pages
    if (publicRoutes.includes(location.pathname)) {
      return false;
    }
    // Require location for ALL routes (not just authenticated users)
    // This ensures location is mandatory for everyone visiting the platform
    return true;
  };

  // ALWAYS show location request modal on app load if location is not enabled
  // This ensures modal appears on every app open, regardless of browser permission state
  useEffect(() => {
    // Wait for initial loading to complete
    if (isLocationLoading) {
      return;
    }

    // If location is enabled, hide modal
    if (isLocationEnabled) {
      setShowLocationRequest(false);
      return;
    }

    // If location is NOT enabled and route requires location, ALWAYS show modal
    // This will trigger on every app open until user explicitly confirms location
    if (!isLocationEnabled && requiresLocation()) {
      setShowLocationRequest(true);
    } else {
      setShowLocationRequest(false);
    }
  }, [isLocationLoading, isLocationEnabled, location.pathname]);

  // Update search query when URL params change
  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
  }, [searchParams]);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (location.pathname === '/search') {
      // Update URL params when on search page (use replace to avoid history stack pollution)
      if (value.trim()) {
        setSearchParams({ q: value }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    } else {
      // Navigate to search page with query
      if (value.trim()) {
        navigate(`/search?q=${encodeURIComponent(value)}`);
      }
    }
  };




  // Reset scroll position when navigating to any page (smooth, no flash)
  useEffect(() => {
    // Use requestAnimationFrame to prevent visual flash
    requestAnimationFrame(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
      // Also reset window scroll smoothly
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  }, [location.pathname]);

  // Track categories active state for rotation
  const isCategoriesActive = isActive('/categories') || location.pathname.startsWith('/category/');

  useEffect(() => {
    if (isCategoriesActive && !prevCategoriesActive) {
      // Rotate clockwise when clicked (becoming active)
      setCategoriesRotation(prev => prev + 360);
      setPrevCategoriesActive(true);
    } else if (!isCategoriesActive && prevCategoriesActive) {
      // Rotate counter-clockwise when unclicked (becoming inactive)
      setCategoriesRotation(prev => prev - 360);
      setPrevCategoriesActive(false);
    }
  }, [isCategoriesActive, prevCategoriesActive]);

  const isProductDetailPage = location.pathname.startsWith('/product/');
  const isSearchPage = location.pathname === '/search';
  const isCheckoutPage = location.pathname === '/checkout' || location.pathname.startsWith('/checkout/');
  const isCartPage = location.pathname === '/cart';
  const showHeader = isSearchPage && !isCheckoutPage && !isCartPage;
  const showSearchBar = isSearchPage && !isCheckoutPage && !isCartPage;
  const showFooter = !isCheckoutPage && !isProductDetailPage;

  const showComingSoon = Boolean(userLocation && hasSellersInRange === false);

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      {/* Desktop Container Wrapper */}
      <div className="md:w-full md:bg-white md:min-h-screen overflow-x-hidden">
        <div className="md:w-full md:min-h-screen md:flex md:flex-col overflow-x-hidden">
          {showComingSoon ? (
            <ComingSoonScreen onChangeLocation={() => setShowLocationChangeModal(true)} />
          ) : (
            <>
          {/* Top Navigation Bar - Desktop Only */}
          {showFooter && (
            <nav
              className="hidden md:flex items-center justify-center gap-8 px-6 lg:px-8 py-3 shadow-sm transition-colors duration-300"
              style={{
                background: `linear-gradient(to right, ${currentTheme.primary[0]}, ${currentTheme.primary[1]})`,
                borderBottom: `1px solid ${currentTheme.primary[0]}`
              }}
            >
              {/* Home */}
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/') ? (
                    <>
                      <path d="M2 12L12 4L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
                      <rect x="4" y="12" width="16" height="8" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12L12 4L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <rect x="4" y="12" width="16" height="8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Home</span>
              </Link>

              {/* Order Again */}
              <Link
                to="/order-again"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/order-again')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/order-again') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/order-again') ? (
                    <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  ) : (
                    <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
                  )}
                </svg>
                <span className="font-medium text-sm">Order Again</span>
              </Link>

              {/* Categories */}
              <Link
                to="/categories"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${(isActive('/categories') || location.pathname.startsWith('/category/'))
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: (isActive('/categories') || location.pathname.startsWith('/category/')) ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {(isActive('/categories') || location.pathname.startsWith('/category/')) ? (
                    <>
                      <circle cx="7" cy="7" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <circle cx="17" cy="7" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <circle cx="7" cy="17" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <circle cx="17" cy="17" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                    </>
                  ) : (
                    <>
                      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="17" cy="7" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="7" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Categories</span>
              </Link>

              {/* Profile */}
              <Link
                to="/account"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/account')
                  ? 'bg-white shadow-md font-semibold'
                  : 'hover:bg-white/20'
                  }`}
                style={{
                  color: isActive('/account') ? currentTheme.accentColor : currentTheme.headerTextColor
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isActive('/account') ? (
                    <>
                      <circle cx="12" cy="8" r="4" fill="currentColor" stroke="currentColor" strokeWidth="2" />
                      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </>
                  )}
                </svg>
                <span className="font-medium text-sm">Profile</span>
              </Link>
            </nav>
          )}

          {/* Sticky Header - Show on search page and other non-home pages, excluding account page */}
          {(showHeader || isSearchPage) && (
            <header 
              className="sticky top-0 z-50 shadow-[0_8px_30px_rgba(245,124,0,0.12)] md:top-[60px] overflow-hidden"
              style={{
                background: `linear-gradient(to bottom, ${currentTheme.primary[0]}, ${currentTheme.primary[1]})`,
                borderBottomLeftRadius: '1.5rem',
                borderBottomRightRadius: '1.5rem',
              }}
            >
              {/* Premium Glow Overlay */}
              <div 
                className="absolute top-0 left-0 right-0 h-full opacity-20 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 50% 0%, white 0%, transparent 80%)',
                }}
              />
              {/* Delivery info line - Hide on search page */}
              {!isSearchPage && (
                <div 
                  className="px-4 md:px-6 lg:px-8 py-1.5 backdrop-blur-sm text-[10px] md:text-xs text-center font-bold border-b border-white/10 uppercase tracking-widest"
                  style={{ backgroundColor: `${currentTheme.accentColor}33`, color: currentTheme.accentColor }}
                >
                  Delivering in 10–15 mins
                </div>
              )}

              {/* Location line - Hide on search page */}
              {!isSearchPage && userLocation && (userLocation.address || userLocation.city) && (
              <div className="px-4 md:px-6 lg:px-8 py-2 flex items-center justify-between text-sm">
                  <span className="text-neutral-800 font-medium line-clamp-1" title={userLocation?.address || ''}>
                  {userLocation?.address
                    ? userLocation.address.length > 50
                      ? `${userLocation.address.substring(0, 50)}...`
                      : userLocation.address
                    : userLocation?.city && userLocation?.state
                      ? `${userLocation.city}, ${userLocation.state}`
                        : userLocation?.city || ''}
                </span>
                <button
                  onClick={() => setShowLocationChangeModal(true)}
                  className="text-blue-600 font-medium hover:text-blue-700 transition-colors flex-shrink-0 ml-2"
                >
                  Change
                </button>
              </div>
              )}

              {/* Search bar - Hidden on Order Again page */}
              {showSearchBar && (
                <div className="px-4 md:px-6 lg:px-8 py-3 flex items-center gap-2">
                  {/* Left Navigate/Back Icon */}
                  <button
                    onClick={() => navigate('/')}
                    className="p-1.5 hover:bg-black/5 active:bg-black/10 rounded-full transition-colors text-neutral-800 flex-shrink-0"
                    aria-label="Go back"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12"></line>
                      <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                  </button>

                  <div className="relative flex-1 max-w-2xl md:mx-auto">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search for products..."
                      className="w-full px-4 py-2.5 pl-11 pr-10 bg-neutral-50 border border-neutral-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#7A3E8E] focus:border-transparent md:py-3 shadow-inner"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </span>
                    {searchQuery && (
                      <button
                        onClick={() => handleSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors p-1"
                        aria-label="Clear search"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </header>
          )}

          {/* Scrollable Main Content */}
          <main ref={mainRef} className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-24 md:pb-8 ${location.pathname !== '/' ? 'pt-[max(1rem,env(safe-area-inset-top))] md:pt-[max(1.5rem,env(safe-area-inset-top))]' : ''}`}>
            <AnimatePresence>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: "easeInOut"
                }}
                className="w-full max-w-full"
                style={{ minHeight: '100%' }}
                onAnimationComplete={() => {
                  if (mainRef.current) {
                    mainRef.current.scrollTop = 0;
                  }
                  window.scrollTo(0, 0);
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Floating Cart Pill */}
          <FloatingCartPill />
            </>
          )}

          {/* Location Permission Request Modal - Mandatory for all users */}
          {showLocationRequest && (
            <LocationPermissionRequest
              onLocationGranted={() => setShowLocationRequest(false)}
              skipable={true}
              title="Location Access Required"
              description="We need your location to show you products available near you and enable delivery services. Location access is required to continue."
            />
          )}

          {/* Location Change Modal – same UI as "Location Access Required", allows updating location (e.g. from Coming Soon screen) */}
          {showLocationChangeModal && (
            <LocationPermissionRequest
              onLocationGranted={() => setShowLocationChangeModal(false)}
              skipable={true}
              isChangeMode={true}
              title="Change Location"
              description="We need your location to show you products available near you and enable delivery services. Update your location below."
            />
          )}

          {/* Fixed Bottom Navigation - Mobile Only, Hidden on checkout pages */}
          {showFooter && (
            <nav
              className="fixed bottom-0 left-0 right-0 bg-[#7A3E8E]/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-12px_40px_-5px_rgba(0,0,0,0.3)] z-50 md:hidden rounded-t-[2.5rem]"
            >
              <div className="flex justify-around items-center h-16">
                {/* Home */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    {isActive('/') && (
                      <motion.div 
                        layoutId="activeTabBubble"
                        className="absolute inset-0 bg-white/10 rounded-2xl m-1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                    <div className="flex flex-col items-center justify-center relative z-10 transition-all duration-300">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/') ? {
                          scale: [1, 1.2, 1],
                        } : {}}
                      >
                        {isActive('/') ? (
                          <>
                            <path d="M2 12L12 4L22 12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#F57C00" />
                            <rect x="4" y="12" width="16" height="8" fill="#F57C00" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
                          </>
                        ) : (
                          <>
                            <path d="M2 12L12 4L22 12" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            <rect x="4" y="12" width="16" height="8" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinejoin="round" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-[10px] mt-1 relative z-10 transition-colors duration-300 ${isActive('/') ? 'font-bold text-white' : 'font-medium text-white/60'}`}>
                      Home
                    </span>
                  </Link>
                </motion.div>

                {/* Order Again */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/order-again"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    {isActive('/order-again') && (
                      <motion.div 
                        layoutId="activeTabBubble"
                        className="absolute inset-0 bg-white/10 rounded-2xl m-1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                    <div className="flex flex-col items-center justify-center relative z-10 transition-all duration-300">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/order-again') ? {
                          scale: [1, 1.2, 1],
                        } : {}}
                      >
                        {isActive('/order-again') ? (
                          <>
                            <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" fill="#F57C00" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M7 8V6C7 5.44772 7.44772 5 8 5H16C16.5523 5 17 5.44772 17 6V8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </>
                        ) : (
                          <>
                            <path d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinejoin="round" fill="none" />
                            <path d="M7 8V6C7 5.44772 7.44772 5 8 5H16C16.5523 5 17 5.44772 17 6V8" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-[10px] mt-1 relative z-10 transition-colors duration-300 ${isActive('/order-again') ? 'font-bold text-white' : 'font-medium text-white/60'}`}>
                      Reorder
                    </span>
                  </Link>
                </motion.div>

                {/* Categories */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/categories"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    {isCategoriesActive && (
                      <motion.div 
                        layoutId="activeTabBubble"
                        className="absolute inset-0 bg-white/10 rounded-2xl m-1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                    <div className="flex flex-col items-center justify-center relative z-10 transition-all duration-300">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={{
                          rotate: categoriesRotation,
                          scale: isCategoriesActive ? 1.2 : 1
                        }}
                      >
                        {isCategoriesActive ? (
                          <>
                            <circle cx="7" cy="7" r="2.5" fill="#F57C00" stroke="#ffffff" strokeWidth="2" />
                            <circle cx="17" cy="7" r="2.5" fill="#ffffff" stroke="#ffffff" strokeWidth="2" />
                            <circle cx="7" cy="17" r="2.5" fill="#ffffff" stroke="#ffffff" strokeWidth="2" />
                            <circle cx="17" cy="17" r="2.5" fill="#F57C00" stroke="#ffffff" strokeWidth="2" />
                          </>
                        ) : (
                          <>
                            <circle cx="7" cy="7" r="2.5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
                            <circle cx="17" cy="7" r="2.5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
                            <circle cx="7" cy="17" r="2.5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
                            <circle cx="17" cy="17" r="2.5" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-[10px] mt-1 relative z-10 transition-colors duration-300 ${isCategoriesActive ? 'font-bold text-white' : 'font-medium text-white/60'}`}>
                      Categories
                    </span>
                  </Link>
                </motion.div>

                {/* Profile */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 h-full"
                >
                  <Link
                    to="/account"
                    className="flex flex-col items-center justify-center h-full relative"
                  >
                    {isActive('/account') && (
                      <motion.div 
                        layoutId="activeTabBubble"
                        className="absolute inset-0 bg-white/10 rounded-2xl m-1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                    <div className="flex flex-col items-center justify-center relative z-10 transition-all duration-300">
                      <motion.svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={isActive('/account') ? {
                          scale: [1, 1.2, 1]
                        } : {}}
                      >
                        {isActive('/account') ? (
                          <>
                            <circle cx="12" cy="8" r="4" fill="#F57C00" stroke="#ffffff" strokeWidth="2" />
                            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="#F57C00" />
                          </>
                        ) : (
                          <>
                            <circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
                            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </>
                        )}
                      </motion.svg>
                    </div>
                    <span className={`text-[10px] mt-1 relative z-10 transition-colors duration-300 ${isActive('/account') ? 'font-bold text-white' : 'font-medium text-white/60'}`}>
                      Profile
                    </span>
                  </Link>
                </motion.div>
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

