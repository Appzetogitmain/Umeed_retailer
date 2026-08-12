import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPosOrders, PosOrder } from '../../../services/api/posService';

export default function SellerPosOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getPosOrders({
          page: currentPage,
          limit: parseInt(entriesPerPage),
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          paymentMethod: paymentMethod !== 'All' ? paymentMethod : undefined,
          search: searchQuery || undefined,
        });
        if (response.success) {
          setOrders(response.data);
          setTotalPages(response.pagination?.pages || 1);
          setTotalEntries(response.pagination?.total || response.data.length);
        } else {
          setError(response.message || 'Failed to fetch POS orders');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch POS orders');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [dateFrom, dateTo, paymentMethod, searchQuery, entriesPerPage, currentPage]);

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">POS Sale History</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/seller" className="text-blue-600 hover:text-blue-700">Home</Link>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-700">POS Sale History</span>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold">In-Store Sales</h2>
            <Link
              to="/seller/pos"
              className="bg-white text-green-700 hover:bg-green-50 px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors"
            >
              + New Sale
            </Link>
          </div>

          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  max={dateTo || undefined}
                  className="px-2 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm"
                />
                <label className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  min={dateFrom || undefined}
                  className="px-2 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm"
                />
              </div>

              <select
                value={paymentMethod}
                onChange={(e) => { setPaymentMethod(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="All">All Payment Methods</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
              </select>

              <select
                value={entriesPerPage}
                onChange={(e) => { setEntriesPerPage(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-900 bg-white"
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by order #, customer name, or phone"
                className="flex-1 min-w-[220px] px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="text-neutral-500">Loading POS orders...</div>
            </div>
          )}
          {error && !loading && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg m-4">{error}</div>
          )}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Order #</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Date</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Customer</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Payment</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Amount</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 sm:px-4 md:px-6 py-8 sm:py-12 text-center text-xs sm:text-sm text-neutral-500">
                        No POS sales recorded yet
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900">{order.orderId}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">
                          {new Date(order.orderDate).toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">
                          {order.customerName}
                          {order.customerPhone && order.customerPhone !== '0000000000' ? ` (${order.customerPhone})` : ''}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900 font-medium">
                          ₹{order.amount.toFixed(2)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3">
                          <button
                            onClick={() => navigate(`/seller/pos/history/${order.id}`)}
                            className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium transition-colors"
                          >
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <span className="text-sm text-neutral-700">
              Showing <span className="font-medium">{orders.length}</span> of{' '}
              <span className="font-medium">{totalEntries}</span> entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm transition-colors ${
                  currentPage === 1 ? 'text-neutral-400 cursor-not-allowed bg-neutral-50' : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Previous
              </button>
              <span className="text-xs sm:text-sm text-neutral-600">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className={`px-3 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm transition-colors ${
                  currentPage >= totalPages ? 'text-neutral-400 cursor-not-allowed bg-neutral-50' : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
