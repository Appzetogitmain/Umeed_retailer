import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  getSellerTransactions,
  getSellerSettlementStats,
  manualFundTransfer,
  type SellerSettlementStats,
} from "../../../services/api/admin/adminWalletService";
import { getAllSellers as getSellers } from "../../../services/api/sellerService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

// Components
import SummaryCards from "../components/Settlement/SummaryCards";
import SettlementTable from "../components/Settlement/SettlementTable";
import SettleModal from "../components/Settlement/SettleModal";

interface Transaction {
  id: string;
  date: string;
  sellerName: string;
  type: string;
  referenceId?: string;
  description: string;
  debit: number;
  credit: number;
  status: 'Pending' | 'Completed';
}

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
  balance: number;
}

export default function AdminSellerTransaction() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  
  // State
  const [stats, setStats] = useState<SellerSettlementStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Filters
  const [selectedSeller, setSelectedSeller] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initial Fetch
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const init = async () => {
      try {
        setLoading(true);
        const [sellersRes, statsRes] = await Promise.all([
          getSellers({ status: "Approved" }),
          getSellerSettlementStats()
        ]);

        if (sellersRes.success) {
          setSellers(sellersRes.data.map(s => ({
            _id: s._id,
            sellerName: s.sellerName,
            storeName: s.storeName,
            balance: s.balance || 0
          })));
        }

        if (statsRes.success) {
          setStats(statsRes.data);
        }

        await fetchTransactions();
      } catch (err) {
        console.error("Initialization error:", err);
        showToast("Failed to load dashboard data", "error");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isAuthenticated, token]);

  // Fetch Transactions on filter change
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchTransactions();
    }
  }, [selectedSeller, selectedType]);

  const fetchTransactions = async () => {
    try {
      const res = await getSellerTransactions(selectedSeller, {
        limit: 50,
        type: selectedType !== "all" ? selectedType : undefined
      });

      if (res.success && res.data) {
        setTransactions(res.data.map((t: any) => ({
          id: t.id,
          date: t.date,
          sellerName: t.description.split('#')[0].trim() || "Seller", // Fallback parsing or use a better API
          type: t.transactionType === 'credit' ? 'Order Earning' : 'Seller Payout',
          referenceId: t.orderId || t.id.slice(-8).toUpperCase(),
          description: t.description,
          debit: t.transactionType === 'debit' ? t.amount : 0,
          credit: t.transactionType === 'credit' ? t.amount : 0,
          status: t.status as 'Pending' | 'Completed'
        })));
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const handleSettleSubmit = async (data: any) => {
    try {
      setSubmitting(true);
      const res = await manualFundTransfer(data);
      if (res.success) {
        showToast("Settlement processed successfully", "success");
        setIsModalOpen(false);
        // Refresh data
        const statsRes = await getSellerSettlementStats();
        if (statsRes.success) setStats(statsRes.data);
        fetchTransactions();
      } else {
        showToast(res.message || "Settlement failed", "error");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Settlement failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.referenceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
        <div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Seller Settlement</h1>
          </div>
          <p className="text-neutral-500 font-medium mt-1">COD based payout management system</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-neutral-50 p-1.5 rounded-2xl border border-neutral-100">
            <select 
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="bg-transparent text-sm font-bold text-neutral-600 px-4 py-2 outline-none"
            >
              <option value="all">All Sellers</option>
              {sellers.map(s => <option key={s._id} value={s._id}>{s.storeName}</option>)}
            </select>
            <div className="w-px h-6 bg-neutral-200" />
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-sm font-bold text-neutral-600 px-4 py-2 outline-none"
            >
              <option value="all">All Types</option>
              <option value="credit">Earnings Only</option>
              <option value="debit">Payouts Only</option>
            </select>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-3.5 bg-teal-600 text-white rounded-2xl font-bold text-sm hover:bg-teal-700 transition-all shadow-xl shadow-teal-100 flex items-center gap-2 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Settle Payment
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <SummaryCards stats={stats} />

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-neutral-900">Transaction Ledger</h2>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              Live Feed • {filteredTransactions.length} Entries
            </div>
          </div>
          <SettlementTable 
            transactions={filteredTransactions}
            loading={loading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </div>

        {/* Sidebar Analytics/Recent */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm">
            <h3 className="text-lg font-bold text-neutral-900 mb-6">Recent Payouts</h3>
            <div className="space-y-6">
              {transactions.filter(t => t.type === 'Seller Payout').slice(0, 5).map((t, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-neutral-900">{t.sellerName}</div>
                    <div className="text-[10px] text-neutral-400 font-bold uppercase">{new Date(t.date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm font-bold text-red-600">-₹{t.debit.toLocaleString()}</div>
                </div>
              ))}
              {transactions.filter(t => t.type === 'Seller Payout').length === 0 && (
                <div className="text-center py-8 text-neutral-400 text-sm font-medium italic">
                  No recent payouts recorded.
                </div>
              )}
            </div>
            <button className="w-full mt-8 py-3 text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors border-t border-neutral-50 pt-6">
              View All Settlements
            </button>
          </div>

          <div className="bg-teal-600 p-8 rounded-3xl text-white shadow-xl shadow-teal-100 overflow-hidden relative group">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Settlement Guide</h3>
              <p className="text-teal-50 mt-0.5 leading-relaxed" style={{ color: '#ccfbf1' }}>
                Record manual payouts to sellers. <span className="font-bold text-white underline">Step 1:</span> Transfer the requested amount to the seller's bank/UPI account. <span className="font-bold text-white underline">Step 2:</span> Click the <span className="font-bold text-white">'Settle Payment'</span> button to log the transaction and update their wallet balance.
              </p>
            </div>
            <svg className="absolute -right-8 -bottom-8 w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Settle Modal */}
      <SettleModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sellers={sellers}
        onSubmit={handleSettleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
