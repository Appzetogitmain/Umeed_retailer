import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPosOrders, getPosSummary, Order, PosSummary } from '../../../services/api/admin/adminOrderService';
import { getAllSellers, Seller } from '../../../services/api/sellerService';

export default function AdminPosOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seller, setSeller] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    getAllSellers({ status: 'Approved' })
      .then((res) => {
        if (res.success) setSellers(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const filters = {
          seller: seller || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        };

        const [ordersRes, summaryRes] = await Promise.all([
          getPosOrders({
            ...filters,
            paymentStatus: paymentStatus !== 'All' ? paymentStatus : undefined,
            search: search || undefined,
            page: currentPage,
            limit: 10,
          }),
          getPosSummary(filters),
        ]);

        if (ordersRes.success) {
          setOrders(ordersRes.data);
          setTotalPages(ordersRes.pagination?.pages || 1);
          setTotalEntries(ordersRes.pagination?.total || ordersRes.data.length);
        } else {
          setError(ordersRes.message || 'Failed to fetch POS orders');
        }
        if (summaryRes.success) {
          setSummary(summaryRes.data);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch POS orders');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [seller, paymentStatus, dateFrom, dateTo, search, currentPage]);

  const sellerName = (order: Order) => {
    if (order.posSeller && typeof order.posSeller !== 'string') {
      return order.posSeller.storeName || order.posSeller.sellerName || 'N/A';
    }
    return 'N/A';
  };

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">POS Orders &amp; Reports</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/admin" className="text-blue-600 hover:text-blue-700">Home</Link>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-700">POS</span>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 space-y-4">
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wide">Total POS Orders</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{summary.totalOrders}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">₹{summary.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">By Payment Method</p>
              <div className="space-y-0.5">
                {summary.byPaymentMethod.map((p) => (
                  <div key={p.paymentMethod} className="flex justify-between text-xs text-neutral-700">
                    <span>{p.paymentMethod}</span>
                    <span className="font-medium">₹{p.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Top Sellers</p>
              <div className="space-y-0.5">
                {summary.bySeller.slice(0, 3).map((s) => (
                  <div key={s.sellerId} className="flex justify-between text-xs text-neutral-700">
                    <span className="truncate max-w-[7rem]">{s.storeName}</span>
                    <span className="font-medium">₹{s.revenue.toFixed(2)}</span>
                  </div>
                ))}
                {summary.bySeller.length === 0 && <p className="text-xs text-neutral-400">No data</p>}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3">
            <h2 className="text-base sm:text-lg font-semibold">All In-Store Sales</h2>
          </div>

          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-neutral-200 flex flex-wrap items-center gap-3">
            <select
              value={seller}
              onChange={(e) => { setSeller(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm bg-white"
            >
              <option value="">All Sellers</option>
              {sellers.map((s) => (
                <option key={s._id} value={s._id}>{s.storeName}</option>
              ))}
            </select>

            <select
              value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm bg-white"
            >
              <option value="All">All Payment Status</option>
              <option value="Paid">Paid</option>
              <option value="Refunded">Refunded</option>
            </select>

            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm text-neutral-700">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                max={dateTo || undefined}
                className="px-2 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm"
              />
              <label className="text-xs sm:text-sm text-neutral-700">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                min={dateFrom || undefined}
                className="px-2 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm"
              />
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search order #, customer name/phone"
              className="flex-1 min-w-[220px] px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm"
            />
          </div>

          {loading && <div className="p-8 text-center text-neutral-500">Loading POS orders...</div>}
          {error && !loading && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg m-4">{error}</div>
          )}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Order #</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Date</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Seller</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Customer</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">Payment</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 sm:px-4 md:px-6 py-8 sm:py-12 text-center text-xs sm:text-sm text-neutral-500">
                        No POS sales found
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order._id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900">{order.orderNumber}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">
                          {new Date(order.orderDate).toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">{sellerName(order)}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">{order.customerName}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900 font-medium text-right">
                          ₹{order.total.toFixed(2)}
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
