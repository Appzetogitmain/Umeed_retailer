import { useState, useEffect } from "react";
import {
  getDeliveryBoyTransactions,
  getDeliveryBoyWalletStats,
  manualFundTransfer,
} from "../../../services/api/admin/adminWalletService";
import { getDeliveryBoys } from "../../../services/api/admin/adminDeliveryService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

interface Transaction {
  id: string;
  deliveryBoyName: string;
  deliveryBoyId: string;
  orderId?: string;
  productName?: string;
  flag: string;
  amount: number;
  remark?: string;
  date: string;
  type: string;
  status: string;
}

interface DeliveryBoy {
  _id: string;
  name: string;
  balance: number;
  cashCollected: number;
}

interface WalletStats {
  totalEarned: number;
  totalWithdrawn: number;
  currentBalance: number;
}

export default function AdminFundTransfer() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({
    userId: "",
    amount: "",
    type: "Credit" as "Credit" | "Debit",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch delivery boys on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchDeliveryBoys = async () => {
      try {
        const response = await getDeliveryBoys({ status: "Active" });
        if (response.success && response.data) {
          setDeliveryBoys(
            response.data.map((db) => ({
              _id: db._id,
              name: db.name,
              balance: db.balance || 0,
              cashCollected: db.cashCollected || 0,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching delivery boys:", err);
      }
    };

    fetchDeliveryBoys();
  }, [isAuthenticated, token]);

  // Fetch stats and transactions
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Stats
        const statsRes = await getDeliveryBoyWalletStats(selectedDeliveryBoy);
        if (statsRes.success) {
          setStats(statsRes.data);
        }

        // Fetch Transactions
        const txRes = await getDeliveryBoyTransactions(selectedDeliveryBoy, {
          page: currentPage,
          limit: selectedDeliveryBoy === "all" ? 50 : entriesPerPage,
          type: selectedType,
        });

        if (txRes.success && txRes.data) {
          const mappedTxs: Transaction[] = txRes.data.map((tx: any) => {
            const db = deliveryBoys.find(d => d._id === (tx as any).userId || selectedDeliveryBoy);
            return {
              id: tx.id,
              deliveryBoyName: (tx as any).userName || db?.name || "Delivery Boy",
              deliveryBoyId: (tx as any).userId || selectedDeliveryBoy,
              amount: tx.amount,
              flag: tx.transactionType,
              date: tx.date,
              type: tx.type,
              status: tx.status,
              remark: tx.description,
              orderId: tx.orderId,
              productName: tx.productName,
            };
          });
          setTransactions(mappedTxs);
        } else {
          setTransactions([]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (deliveryBoys.length > 0 || selectedDeliveryBoy !== "all") {
        fetchData();
    }
  }, [selectedDeliveryBoy, selectedType, currentPage, entriesPerPage, isAuthenticated, token, deliveryBoys.length]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleFundTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData.userId || !modalData.amount || !modalData.description) {
      showToast("Please fill all fields", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await manualFundTransfer({
        userId: modalData.userId,
        userType: "DELIVERY_BOY",
        amount: Number(modalData.amount),
        type: modalData.type,
        description: modalData.description,
      });

      if (res.success) {
        showToast("Fund transfer successful", "success");
        setIsModalOpen(false);
        setModalData({ userId: "", amount: "", type: "Credit", description: "" });
        // Refresh data
        window.location.reload(); 
      } else {
        showToast(res.message || "Transfer failed", "error");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Transfer failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter and Sort Logic
  const filteredTransactions = transactions.filter(
    (tx) =>
      tx.deliveryBoyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.orderId && tx.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.remark?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (sortColumn) {
    filteredTransactions.sort((a, b) => {
      let aV = (a as any)[sortColumn];
      let bV = (b as any)[sortColumn];
      if (sortColumn === "date") {
        aV = new Date(a.date).getTime();
        bV = new Date(b.date).getTime();
      }
      if (aV < bV) return sortDirection === "asc" ? -1 : 1;
      if (aV > bV) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(filteredTransactions.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const displayedTransactions = filteredTransactions.slice(startIndex, startIndex + entriesPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-neutral-800">Delivery Boy Wallet & Transactions</h1>
          </div>
          <p className="text-neutral-500">Manage partner earnings, withdrawals, and manual adjustments.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Fund Transfer
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Total Partner Earnings</span>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-neutral-800">₹{stats?.totalEarned.toLocaleString() || "0"}</h3>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"></polyline></svg>
            Total commissions earned from deliveries
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Paid to Partner</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" /></svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-neutral-800">₹{stats?.totalWithdrawn.toLocaleString() || "0"}</h3>
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
            Money transferred to partner bank accounts
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-teal-200 bg-teal-50/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-teal-600 uppercase tracking-wider">Partner Wallet Balance</span>
            <div className="p-2 bg-teal-600 rounded-lg text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
          </div>
          <h3 className="text-3xl font-bold text-teal-700">₹{stats?.currentBalance.toLocaleString() || "0"}</h3>
          <p className="text-xs text-teal-600 mt-2 font-medium">Net amount Admin needs to pay to partners</p>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {/* Filters */}
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">Delivery Partner</label>
              <select
                value={selectedDeliveryBoy}
                onChange={(e) => { setSelectedDeliveryBoy(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 transition-all outline-none">
                <option value="all">All Partners</option>
                {deliveryBoys.map((db) => <option key={db._id} value={db._id}>{db.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">Type</label>
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 transition-all outline-none">
                <option value="all">All Transactions</option>
                <option value="credit">Credits (+)</option>
                <option value="debit">Debits (-)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by Partner, Order # or Remark..."
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th onClick={() => handleSort("date")} className="px-6 py-4 text-xs font-bold text-neutral-600 uppercase tracking-wider cursor-pointer hover:text-teal-600">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-600 uppercase tracking-wider">Transaction Type</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-600 uppercase tracking-wider">Details / Reference</th>
                <th onClick={() => handleSort("amount")} className="px-6 py-4 text-xs font-bold text-neutral-600 uppercase tracking-wider cursor-pointer hover:text-teal-600 text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-600 uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-neutral-400"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>Loading Ledger...</td></tr>
              ) : displayedTransactions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-neutral-500 font-medium">No transactions found in this period.</td></tr>
              ) : (
                displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-neutral-800">{new Date(tx.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-xs text-neutral-400">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        tx.flag === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {tx.flag === "credit" ? "Delivery Bonus" : tx.type === "Debit" ? "Withdrawal" : tx.type}
                      </span>
                      <div className="text-xs text-neutral-500 mt-1">{tx.deliveryBoyName}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm font-medium text-neutral-800 truncate">{tx.remark}</div>
                      {tx.orderId && <div className="text-xs text-teal-600 font-bold mt-0.5">Order #{tx.orderId}</div>}
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-bold ${tx.flag === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {tx.flag === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tx.status === "Completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-5 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/30">
          <p className="text-sm text-neutral-500">Showing {startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredTransactions.length)} of {filteredTransactions.length}</p>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="px-3 py-1 border border-neutral-300 rounded hover:bg-white disabled:opacity-50 transition-all shadow-xs">Prev</button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-3 py-1 border border-neutral-300 rounded hover:bg-white disabled:opacity-50 transition-all shadow-xs">Next</button>
          </div>
        </div>
      </div>

      {/* Fund Transfer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-teal-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Add Fund Transfer</h3>
                <p className="text-teal-100 text-sm mt-1">Adjust partner balance manually.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:rotate-90 transition-transform">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleFundTransfer} className="p-6 space-y-5">
              <div>
                <label className="text-sm font-bold text-neutral-700 block mb-2">Select Partner</label>
                <select 
                  value={modalData.userId}
                  onChange={e => setModalData({...modalData, userId: e.target.value})}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                  <option value="">Choose a partner...</option>
                  {deliveryBoys.map(db => (
                    <option key={db._id} value={db._id}>
                      {db.name} (Bal: ₹{db.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
                {modalData.userId && (
                  <div className="mt-2 flex items-center justify-between px-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-400 uppercase font-bold">Current Wallet Balance</span>
                      <span className="text-sm font-bold text-teal-600">
                        ₹{deliveryBoys.find(d => d._id === modalData.userId)?.balance.toLocaleString() || "0"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-neutral-400 uppercase font-bold">Cash Held (COD)</span>
                      <span className="text-sm font-bold text-orange-600">
                        ₹{deliveryBoys.find(d => d._id === modalData.userId)?.cashCollected.toLocaleString() || "0"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-neutral-700 block mb-2">Amount (₹)</label>
                  <input 
                    type="number"
                    value={modalData.amount}
                    onChange={e => setModalData({...modalData, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-700 block mb-2">Transfer Type</label>
                  <select 
                    value={modalData.type}
                    onChange={e => setModalData({...modalData, type: e.target.value as "Credit" | "Debit"})}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                    <option value="Credit">Credit (+)</option>
                    <option value="Debit">Debit (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-700 block mb-2">Description / Remark</label>
                <textarea 
                  value={modalData.description}
                  onChange={e => setModalData({...modalData, description: e.target.value})}
                  placeholder="e.g. Monthly Bonus, Cash Settlement, Penalty, etc."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-bold text-neutral-600 hover:bg-neutral-50 transition-all">
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all disabled:opacity-50 shadow-md">
                  {submitting ? "Processing..." : "Confirm Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2026. Developed By{' '}
        <a href="#" className="text-teal-600 hover:text-teal-700 font-medium">Speedoo - Your Order Our Priority
        </a>
      </div>
    </div>
  );
}
