import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import {
  getAvailableReturnPickups,
  getActiveReturnPickups,
  acceptReturnPickup,
  updateReturnPickupStatus
} from '../../../services/api/delivery/deliveryService';

export default function DeliveryReturnOrders() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'available' | 'active'>('available');
  const [availablePickups, setAvailablePickups] = useState<any[]>([]);
  const [activePickups, setActivePickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'available') {
        const data = await getAvailableReturnPickups();
        setAvailablePickups(data || []);
      } else {
        const data = await getActiveReturnPickups();
        setActivePickups(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load return orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleAccept = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await acceptReturnPickup(id);
      if (res.success) {
        alert('Return pickup accepted successfully!');
        // Refresh list
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to accept return pickup');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Accepted' ? 'Picked Up' : 'Completed';
    const confirmMsg = nextStatus === 'Picked Up' 
      ? 'Are you sure you have picked up this item from the customer?' 
      : 'Are you sure you have delivered this item back to the seller?';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(id);
      const res = await updateReturnPickupStatus(id, nextStatus);
      if (res.success) {
        alert(`Status updated to ${nextStatus} successfully!`);
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update pickup status');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 font-sans">
      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center mb-5">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 bg-white hover:bg-neutral-100 rounded-full shadow-sm transition-colors border border-neutral-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-bold">Return Pickups</h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-neutral-200/60 p-1 rounded-xl mb-4 border border-neutral-200">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'available'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Available ({availablePickups.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'active'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            My Pickups ({activePickups.length})
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        {/* Main List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
            <p className="text-sm text-neutral-500">Loading pickups...</p>
          </div>
        ) : activeTab === 'available' ? (
          /* Available Pickups list */
          availablePickups.length > 0 ? (
            <div className="space-y-4">
              {availablePickups.map((pickup) => (
                <div
                  key={pickup._id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/80 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Product</p>
                      <p className="text-sm font-bold text-neutral-800">{pickup.productName}</p>
                      {pickup.variant && (
                        <p className="text-xs text-neutral-500 mt-0.5">Variant: {pickup.variant}</p>
                      )}
                    </div>
                    <span className="bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      New Return
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-100 pt-2 text-xs space-y-1.5 text-neutral-600">
                    <p className="flex justify-between">
                      <span>Reason:</span>
                      <span className="font-semibold text-neutral-800">{pickup.reason}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Customer Area:</span>
                      <span className="font-semibold text-neutral-800">{pickup.customerAddress?.city || 'Local'}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleAccept(pickup._id)}
                    disabled={actionLoading === pickup._id}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm py-2.5 rounded-xl shadow-md shadow-teal-600/10 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === pickup._id ? 'Accepting...' : 'Accept Pickup'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 min-h-[300px] flex flex-col items-center justify-center shadow-sm border border-neutral-200 text-center">
              <span className="text-4xl mb-2">📦</span>
              <p className="text-neutral-500 text-sm font-semibold">No available return pickups</p>
              <p className="text-xs text-neutral-400 mt-1">Check back later for new requests</p>
            </div>
          )
        ) : (
          /* Active Pickups list */
          activePickups.length > 0 ? (
            <div className="space-y-4">
              {activePickups.map((pickup) => (
                <div
                  key={pickup._id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/80 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Product to Pickup</p>
                      <p className="text-sm font-bold text-neutral-800">{pickup.productName}</p>
                      {pickup.variant && (
                        <p className="text-xs text-neutral-500 mt-0.5">Variant: {pickup.variant}</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      pickup.deliveryBoyStatus === 'Accepted' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {pickup.deliveryBoyStatus}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-xl space-y-2 text-xs border border-neutral-100">
                    <div>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase">Customer Info</p>
                      <p className="text-sm font-bold text-neutral-800 mt-0.5">{pickup.customerName}</p>
                      <p className="text-neutral-600 mt-0.5 leading-relaxed">{pickup.customerAddress?.address}</p>
                    </div>
                    {pickup.customerPhone && (
                      <div className="flex justify-between items-center pt-2 border-t border-neutral-200/60">
                        <span className="text-neutral-500">Phone: {pickup.customerPhone}</span>
                        <a
                          href={`tel:${pickup.customerPhone}`}
                          className="px-2.5 py-1 bg-white border border-neutral-200 text-teal-600 font-bold rounded-lg shadow-sm"
                        >
                          Call Customer
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-yellow-50/50 rounded-xl space-y-1 text-xs border border-yellow-100">
                    <p className="text-[10px] text-yellow-800 font-bold uppercase">Seller Info (Return Target)</p>
                    <p className="text-sm font-bold text-yellow-950">{pickup.seller?.storeName || 'Store'}</p>
                    <p className="text-yellow-900 mt-0.5 leading-relaxed">
                      {pickup.seller?.address?.address || pickup.seller?.city || 'Seller Address'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleUpdateStatus(pickup._id, pickup.deliveryBoyStatus)}
                    disabled={actionLoading === pickup._id}
                    className={`w-full text-white font-bold text-sm py-2.5 rounded-xl shadow-md transition-colors ${
                      pickup.deliveryBoyStatus === 'Accepted'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
                    }`}
                  >
                    {actionLoading === pickup._id 
                      ? 'Updating...' 
                      : pickup.deliveryBoyStatus === 'Accepted' 
                        ? 'Mark as Picked Up' 
                        : 'Mark as Delivered to Seller'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 min-h-[300px] flex flex-col items-center justify-center shadow-sm border border-neutral-200 text-center">
              <span className="text-4xl mb-2">🚴</span>
              <p className="text-neutral-500 text-sm font-semibold">No active pickups assigned to you</p>
              <p className="text-xs text-neutral-400 mt-1">Accept available pickups from the pool tab</p>
            </div>
          )
        )}
      </div>
      <DeliveryBottomNav />
    </div>
  );
}
