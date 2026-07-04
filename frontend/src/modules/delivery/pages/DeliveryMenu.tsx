import { useNavigate } from 'react-router-dom';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { useAuth } from '../../../context/AuthContext';
import { useDeliveryUser } from '../context/DeliveryUserContext';
import { useState, useEffect } from 'react';

export default function DeliveryMenu() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { clearUserName } = useDeliveryUser();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (showLogoutModal) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY) * -1);
      }
    };
  }, [showLogoutModal]);

  const menuItems = [
    { id: 'menu-1', title: 'Profile', route: '/delivery/profile' },
    { id: 'menu-wallet', title: 'Wallet & Payouts', route: '/delivery/wallet' },
    { id: 'menu-4', title: 'Help & Support', route: '/delivery/support' },
    { id: 'menu-5', title: 'About', route: '/delivery/about' },
    { id: 'menu-6', title: 'Logout', route: '/delivery/login' },
  ];

  const getMenuIcon = (menuId: string) => {
    switch (menuId) {
      case 'menu-1': // Profile
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'menu-wallet': // Wallet
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );


      case 'menu-4': // Help & Support
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path
              d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="12" cy="17" r="1" fill="currentColor" />
          </svg>
        );
      case 'menu-5': // About
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <path
              d="M12 16V12M12 8H12.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        );
      case 'menu-6': // Logout
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M16 17L21 12L16 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M21 12H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleMenuClick = (route: string) => {
    if (route === '/delivery/login') {
      setShowLogoutModal(true);
    } else {
      // Navigate to the selected route
      navigate(route);
    }
  };

  const handleConfirmLogout = () => {
    // Properly logout using AuthContext to clear all auth state
    logout();
    clearUserName();
    navigate('/delivery/login');
  };

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate('/delivery')}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors text-neutral-800"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-semibold">Menu</h2>
        </div>
        {menuItems.length > 0 ? (
          <div className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.route)}
                className={`w-full bg-white rounded-xl p-4 shadow-sm border border-neutral-200 flex items-center gap-3 hover:shadow-md transition-shadow ${item.id === 'menu-6' ? 'text-red-600 hover:bg-red-50' : 'hover:bg-neutral-50'
                  }`}
              >
                <span className={`flex-shrink-0 ${item.id === 'menu-6' ? 'text-red-600' : 'text-neutral-600'}`}>
                  {getMenuIcon(item.id)}
                </span>
                <span
                  className={`text-sm font-medium flex-1 text-left ${item.id === 'menu-6' ? 'text-red-600' : 'text-neutral-900'
                    }`}
                >
                  {item.title}
                </span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={item.id === 'menu-6' ? 'text-red-600' : 'text-neutral-400'}
                >
                  <path
                    d="M9 18L15 12L9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 min-h-[400px] flex items-center justify-center shadow-sm border border-neutral-200">
            <p className="text-neutral-500 text-sm">Menu options coming soon</p>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onTouchMove={(e) => e.preventDefault()}
          style={{ overscrollBehavior: 'contain' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-600">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Logout?</h3>
              <p className="text-sm text-neutral-500 mb-6">
                Are you sure you want to log out of your account?
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 bg-neutral-100 text-neutral-900 py-2.5 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-sm"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeliveryBottomNav />
    </div>
  );
}
