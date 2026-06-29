import { useState, useEffect } from "react";
import { 
  getCashCollections, 
  getDeliveryBoys,
  createCashCollection,
  getCashCollectionSummary,
  type DeliveryBoy,
  type CashCollection
} from "../../../services/api/admin/adminDeliveryService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import SummaryCards from "../components/CashCollection/SummaryCards";
import CashTable from "../components/CashCollection/CashTable";
import CollectModal from "../components/CashCollection/CollectModal";
import HistoryModal from "../components/CashCollection/HistoryModal";
import RecentCollections from "../components/CashCollection/RecentCollections";
import Button from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

export default function AdminCashCollection() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [recentCollections, setRecentCollections] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState({
    totalCollected: 0,
    totalSubmitted: 0,
    pendingAmount: 0,
    agentsWithPending: 0
  });
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  // Filters
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData();
    }
  }, [isAuthenticated, token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [summaryRes, agentsRes, collectionsRes] = await Promise.all([
        getCashCollectionSummary(),
        getDeliveryBoys({ status: "Active", limit: 100 }),
        getCashCollections({ limit: 10 })
      ]);

      if (summaryRes.success) {
        setSummaryData(summaryRes.data);
      }

      if (agentsRes.success) {
        const transformedAgents = agentsRes.data.map((agent: any) => ({
          id: agent._id,
          name: agent.name,
          phone: agent.mobile,
          collected: (agent.cashCollected || 0) + (agent.totalSubmitted || 0),
          submitted: agent.totalSubmitted || 0,
          pending: agent.cashCollected || 0,
          lastSubmission: agent.lastCollectionDate ? new Date(agent.lastCollectionDate).toLocaleDateString() : "No Submissions",
          status: agent.cashCollected > 0 ? (agent.totalSubmitted > 0 ? "Partial" : "Pending") : "Settled"
        }));
        setAgents(transformedAgents);
      }

      if (collectionsRes.success) {
        setRecentCollections(collectionsRes.data.map((c: CashCollection) => ({
          id: c._id,
          agentName: c.deliveryBoyName,
          amount: c.amount,
          mode: "Cash",
          date: c.collectedAt
        })));
      }

    } catch (error) {
      console.error("Error fetching cash collection data:", error);
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = (agent: any) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  const handleConfirmCollection = async (data: any) => {
    try {
      // Create cash collection record via API
      const response = await createCashCollection({
        deliveryBoyId: data.agentId,
        referenceId: data.referenceId || `MANUAL-${Date.now()}`,
        amount: data.amount,
        remark: data.notes
      });

      if (response.success) {
        showToast(`Successfully collected ₹${data.amount} from ${selectedAgent.name}`, "success");
        // Refresh data
        fetchData();
      } else {
        showToast("Failed to record collection", "error");
      }
    } catch (error) {
      console.error("Collection error:", error);
      showToast("An error occurred during collection", "error");
    }
  };

  const handleExport = () => {
    // Basic CSV export logic
    const headers = ["Agent Name", "Phone", "Collected", "Submitted", "Pending", "Status"];
    const rows = agents.map(a => [a.name, a.phone, a.collected, a.submitted, a.pending, a.status]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(r => r.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cash_collection_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-neutral-50/50">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Cash Collection</h1>
          </div>
          <p className="text-neutral-500 mt-1">Track and reconcile COD payments from your delivery fleet.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-xl border border-neutral-200 p-1 shadow-sm">
            <Input 
              type="date" 
              className="border-none focus-visible:ring-0 h-9 text-xs w-32"
              value={dateRange.from}
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
            />
            <span className="text-neutral-300 px-1">—</span>
            <Input 
              type="date" 
              className="border-none focus-visible:ring-0 h-9 text-xs w-32"
              value={dateRange.to}
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
            />
          </div>

          <Button 
            className="rounded-xl text-white flex items-center gap-2 px-6 shadow-md transition-all active:scale-95 border-none bg-teal-600 hover:bg-teal-700"
            style={{ backgroundColor: '#0d9488' }} // teal-600
            onClick={handleExport}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards data={summaryData} />

      {/* Quick Guide Banner */}
      <div className="mt-8 bg-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-teal-100 flex items-center justify-between overflow-hidden relative group">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <h4 className="font-bold text-sm">Cash Collection Guide</h4>
            <p className="text-xs text-teal-500 mt-0.5 leading-relaxed" style={{ color: '#ccfbf1' }}>
              Reconcile COD cash from your delivery fleet. <span className="font-bold text-white underline">Step 1:</span> Collect the physical cash from the Rider. <span className="font-bold text-white underline">Step 2:</span> Click the 'Collect' button and enter the Amount + Reference ID to settle their pending balance.
            </p>
          </div>
        </div>
        <div className="hidden sm:block absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
        <div className="lg:col-span-3">
          <CashTable 
            agents={agents} 
            onCollect={handleCollect}
            onView={(agent) => {
              setSelectedAgent(agent);
              setIsHistoryOpen(true);
            }}
          />
        </div>
        
        <div className="lg:col-span-1">
          <RecentCollections collections={recentCollections} />
        </div>
      </div>

      {/* Modal */}
      <CollectModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        agent={selectedAgent}
        onConfirm={handleConfirmCollection}
      />

      <HistoryModal 
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        agent={selectedAgent}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-teal-900 uppercase tracking-widest animate-pulse">Synchronizing Ledger...</p>
          </div>
        </div>
      )}
    </div>
  );
}
