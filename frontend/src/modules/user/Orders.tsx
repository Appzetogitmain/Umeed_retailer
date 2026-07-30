import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { useOrders } from '../../hooks/useOrders';
import { useThemeContext } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AuthPrompt from '../../components/AuthPrompt';


const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Orders() {
  const { isAuthenticated } = useAuth();
  const { orders } = useOrders();

  const { currentTheme } = useThemeContext();
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('latest');

  const brandPrimary = currentTheme.primary[2] || '#F57C00';
  const brandSecondary = currentTheme.accentColor || '#7A3E8E';

  const statuses = ['All', 'Placed', 'Accepted', 'On the way', 'Delivered', 'Cancelled', 'Returned'];

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== 'All') {
      result = result.filter(order => order.status === statusFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'latest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [orders, statusFilter, sortBy]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Delivered':
        return { backgroundColor: `${brandSecondary}10`, color: brandSecondary, borderColor: `${brandSecondary}30` };
      case 'On the way':
      case 'Accepted':
      case 'Out for Delivery':
        return { backgroundColor: `${brandPrimary}10`, color: brandPrimary, borderColor: `${brandPrimary}30` };
      case 'Placed':
      case 'Received':
        return { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' };
      case 'Cancelled':
      case 'Returned':
        return { backgroundColor: '#FEF2F2', color: '#EF4444', borderColor: '#FEE2E2' };
      default:
        return { backgroundColor: '#F9FAFB', color: '#6B7280', borderColor: '#F3F4F6' };
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="pb-24 bg-neutral-50 min-h-screen">
        <AuthPrompt 
          title="Your Orders" 
          description="Login to track your orders."
          icon="📦"
        />

      </div>
    );
  }

  if (orders.length === 0) {

    return (
      <div className="px-4 py-20 text-center">
        <div className="text-7xl mb-6 grayscale opacity-50">📦</div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">No orders yet</h2>
        <p className="text-neutral-500 mb-8 max-w-xs mx-auto">Once you place an order, it will appear here for you to track.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center text-white px-8 py-3.5 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-purple-200"
          style={{ backgroundColor: brandPrimary }}
        >
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24 bg-neutral-50 min-h-screen">
      {/* Header & Filters */}
      <div className="bg-white border-b border-neutral-100 sticky top-0 z-20 shadow-sm">
        <div className="px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">My Orders</h1>
            
            {/* Sort Toggle - More Compact */}
            <div className="flex items-center bg-neutral-50 p-1 rounded-xl border border-neutral-100">
              <button
                onClick={() => setSortBy('latest')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  sortBy === 'latest' ? 'bg-white shadow-sm text-neutral-900 border border-neutral-100' : 'text-neutral-400'
                }`}
              >
                Latest
              </button>
              <button
                onClick={() => setSortBy('oldest')}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  sortBy === 'oldest' ? 'bg-white shadow-sm text-neutral-900 border border-neutral-100' : 'text-neutral-400'
                }`}
              >
                Oldest
              </button>
            </div>
          </div>

          {/* Status Filter Tabs - Compact & Styled */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                  statusFilter === status
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-100 bg-neutral-50 text-neutral-500 hover:border-neutral-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const shortId = order.id.split('-').slice(-1)[0].substring(0, 8);
            const statusStyle = getStatusStyles(order.status);
            
            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white rounded-2xl border border-neutral-100 p-3 hover:border-purple-100 transition-all active:scale-[0.99]"
              >
                {/* Header: Icon + ID + Status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center border border-neutral-100">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-neutral-400">
                        <path d="M21 8V21H3V8" />
                        <path d="M1 3H23V8H1V3Z" />
                        <path d="M10 12H14" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-neutral-900">Order</span>
                        <span className="text-[10px] font-medium text-neutral-400 bg-neutral-50 px-1.5 py-0.5 rounded-md border border-neutral-100">#{shortId}</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 font-medium mt-0.5">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border"
                    style={statusStyle}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Items Row - Tighter */}
                <div className="flex items-center justify-between gap-4 py-3 border-t border-neutral-50">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="flex -space-x-3 overflow-hidden">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="relative z-[idx]">
                          <div className="w-12 h-12 rounded-lg border border-neutral-100 bg-white p-1 shadow-sm">
                            <img 
                              src={normalizeImageUrl(item.product.mainImage || item.product.imageUrl)} 
                              alt={item.product.productName || item.product.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="absolute -top-1 -right-1 bg-neutral-900 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                            {item.quantity}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-neutral-600 font-medium truncate">
                        {order.items.map(item => item.product.productName || item.product.name).join(', ')}
                      </p>
                      {order.items.length > 3 && (
                        <p className="text-[9px] text-neutral-400 font-bold uppercase mt-0.5">
                          +{order.items.length - 3} more items
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-1">Total</div>
                    <div className="text-base font-black text-neutral-900 leading-none">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="py-20 text-center">
            <p className="text-neutral-400 font-bold text-sm">No {statusFilter.toLowerCase()} orders found</p>
            <button 
              onClick={() => setStatusFilter('All')}
              className="mt-2 text-xs font-bold text-purple-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
