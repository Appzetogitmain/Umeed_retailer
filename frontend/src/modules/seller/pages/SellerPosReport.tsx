import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPosSalesReport, PosReportRow, PosReportSummary } from '../../../services/api/posService';

export default function SellerPosReport() {
  const [rows, setRows] = useState<PosReportRow[]>([]);
  const [summary, setSummary] = useState<PosReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getPosSalesReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page: currentPage,
          limit: 15,
        });
        if (response.success) {
          setRows(response.data);
          setSummary(response.summary);
          setTotalPages(response.pagination?.pages || 1);
        } else {
          setError(response.message || 'Failed to fetch report');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [fromDate, toDate, currentPage]);

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">POS Sales Report</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/seller" className="text-blue-600 hover:text-blue-700">Home</Link>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-700">POS Sales Report</span>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 space-y-4">
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <span className="font-medium">₹{p.revenue.toFixed(2)} ({p.orders})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3">
            <h2 className="text-base sm:text-lg font-semibold">Sales Detail</h2>
          </div>

          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-neutral-200 flex flex-wrap items-center gap-3">
            <label className="text-xs sm:text-sm font-medium text-neutral-700">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              max={toDate || undefined}
              className="px-2 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm"
            />
            <label className="text-xs sm:text-sm font-medium text-neutral-700">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              min={fromDate || undefined}
              className="px-2 py-1.5 border border-neutral-300 rounded text-xs sm:text-sm"
            />
          </div>

          {loading && <div className="p-8 text-center text-neutral-500">Loading report...</div>}
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
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Subtotal</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Tax</th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 sm:px-4 md:px-6 py-8 sm:py-12 text-center text-xs sm:text-sm text-neutral-500">
                        No POS sales in this range
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.orderId} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900">{row.orderId}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">
                          {new Date(row.date).toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">{row.customerName}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">{row.paymentMethod}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700 text-right">₹{row.subtotal.toFixed(2)}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700 text-right">₹{row.tax.toFixed(2)}</td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900 font-medium text-right">₹{row.total.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-neutral-200 flex items-center justify-end gap-2">
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
  );
}
