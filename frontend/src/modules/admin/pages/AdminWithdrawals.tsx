import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../context/ToastContext';
import {
    getWithdrawalRequests,
    getWithdrawalStats,
    approveWithdrawal,
    rejectWithdrawal,
    WithdrawalRequest,
    WithdrawalStats
} from '../../../services/api/admin/adminWalletService';

// --- UI COMPONENTS ---

const Badge = ({ children, color }: { children: React.ReactNode, color: 'blue' | 'orange' | 'green' | 'red' | 'yellow' | 'gray' }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        orange: 'bg-orange-50 text-orange-700 border-orange-100',
        green: 'bg-green-50 text-green-700 border-green-100',
        red: 'bg-red-50 text-red-700 border-red-100',
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
        gray: 'bg-gray-50 text-gray-700 border-gray-100'
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[color]}`}>
            {children}
        </span>
    );
};

const StatCard = ({ title, value, subtitle, icon, color }: { title: string, value: string | number, subtitle?: string, icon: React.ReactNode, color: string }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-xl ${color}`}>
                {icon}
            </div>
        </div>
    </div>
);

// --- MAIN PAGE ---

export default function AdminWithdrawals() {
    const { showToast } = useToast();
    
    // State
    const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
    const [stats, setStats] = useState<WithdrawalStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'Pending' | 'Completed' | 'Rejected'>('all');
    const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'SELLER' | 'DELIVERY_BOY'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals
    const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    
    // Form State
    const [transactionRef, setTransactionRef] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab, userTypeFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [requestsRes, statsRes] = await Promise.all([
                getWithdrawalRequests({
                    status: activeTab === 'all' ? undefined : activeTab,
                    userType: userTypeFilter === 'all' ? undefined : userTypeFilter,
                    search: searchQuery || undefined
                }),
                getWithdrawalStats()
            ]);

            if (requestsRes.success) {
                setRequests(requestsRes.data.requests || []);
            }
            if (statsRes.success) {
                setStats(statsRes.data);
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;
        if (!transactionRef) {
            showToast('Transaction Reference ID is required', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            const response = await approveWithdrawal(selectedRequest.id || (selectedRequest as any)._id, {
                transactionReference: transactionRef,
                remarks: adminNotes
            });

            if (response.success) {
                showToast('Withdrawal approved and processed', 'success');
                setShowApproveModal(false);
                setSelectedRequest(null);
                setTransactionRef('');
                setAdminNotes('');
                fetchData();
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to approve withdrawal', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest || !rejectReason) {
            showToast('Rejection reason is required', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            const response = await rejectWithdrawal(selectedRequest.id || (selectedRequest as any)._id, rejectReason);
            if (response.success) {
                showToast('Withdrawal request rejected', 'success');
                setShowRejectModal(false);
                setSelectedRequest(null);
                setRejectReason('');
                fetchData();
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to reject request', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Filtered requests based on search
    const filteredRequests = requests.filter(r => 
        (r.userName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.id?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((r as any)._id?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading && !requests.length) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Withdrawal Requests</h1>
          </div>
                    <p className="text-gray-500 mt-1 text-sm">Manage payout requests from sellers and riders</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    
                    <select 
                        value={userTypeFilter}
                        onChange={(e) => setUserTypeFilter(e.target.value as any)}
                        className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="all">All Users</option>
                        <option value="SELLER">Sellers Only</option>
                        <option value="DELIVERY_BOY">Riders Only</option>
                    </select>
                </div>
            </div>

            {/* Withdrawal Payout Guide Banner */}
            <div className="bg-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-teal-100 flex items-center justify-between overflow-hidden relative group">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Withdrawal Payout Guide</h4>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#ccfbf1' }}>
                            Sellers and Riders have requested their earnings. <span className="font-bold text-white underline">Step 1:</span> Transfer the money to them externally (Bank/UPI). <span className="font-bold text-white underline">Step 2:</span> Click 'Approve' and enter the <span className="font-bold text-white">Transaction ID</span> to complete the request and update their wallet.
                        </p>
                    </div>
                </div>
                <div className="hidden sm:block absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Requests" 
                    value={stats?.totalRequests || 0} 
                    icon={<svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    color="bg-blue-50"
                />
                <StatCard 
                    title="Pending Requests" 
                    value={stats?.pendingRequests || 0} 
                    icon={<svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    color="bg-red-50"
                />
                <StatCard 
                    title="Approved Amount" 
                    value={`₹${(stats?.approvedAmount || 0).toLocaleString()}`} 
                    icon={<svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    color="bg-green-50"
                />
                <StatCard 
                    title="Rejected Requests" 
                    value={stats?.rejectedRequests || 0} 
                    icon={<svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    color="bg-gray-50"
                />
            </div>

            {/* Main Table Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-4">
                    {['all', 'Pending', 'Completed', 'Rejected'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setActiveTab(status as any)}
                            className={`px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                                activeTab === status 
                                ? 'text-blue-600 border-blue-600' 
                                : 'text-gray-500 border-transparent hover:text-gray-700'
                            }`}
                        >
                            {status === 'all' ? 'All Requests' : status}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                <th className="px-6 py-4">Request ID</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4 text-right">Requested Amount</th>
                                <th className="px-6 py-4 text-right">Available Balance</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        No requests found for the selected filters
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((r) => (
                                    <tr key={r.id || (r as any)._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                                            {(r.id || (r as any)._id).substring(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900">{r.userName}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {r.userType === 'SELLER' ? (
                                                        <Badge color="blue">Seller</Badge>
                                                    ) : (
                                                        <Badge color="orange">Rider</Badge>
                                                    )}
                                                    <span className="text-xs text-gray-400">{(r as any).userId?.mobile || 'No Phone'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(r.createdAt || r.requestDate).toLocaleDateString('en-IN', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}<br/>
                                            <span className="text-xs opacity-60">
                                                {new Date(r.createdAt || r.requestDate).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                            ₹{r.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-500">
                                            ₹{r.availableBalance?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${r.paymentMethod === 'UPI' ? 'bg-purple-400' : 'bg-blue-400'}`}></span>
                                                <span className="text-gray-600 font-medium">{r.paymentMethod}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge color={
                                                r.status === 'Completed' ? 'green' : 
                                                r.status === 'Approved' ? 'blue' : 
                                                r.status === 'Rejected' ? 'red' : 'yellow'
                                            }>
                                                {r.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {r.status === 'Pending' ? (
                                                    <>
                                                        <button 
                                                            onClick={() => { setSelectedRequest(r); setShowApproveModal(true); }}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Approve"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => { setSelectedRequest(r); setShowRejectModal(true); }}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button 
                                                        onClick={() => { setSelectedRequest(r); setShowDetailsModal(true); }}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODALS --- */}

            <AnimatePresence>
                {/* Approve Modal */}
                {showApproveModal && selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
                        >
                            <div className="bg-green-600 p-6 text-white">
                                <h2 className="text-xl font-bold">Approve Withdrawal</h2>
                                <p className="text-green-100 text-sm mt-1">Submit payment details to process the payout</p>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">User Name</p>
                                        <p className="text-sm font-semibold text-gray-900">{selectedRequest.userName}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Method</p>
                                        <p className="text-sm font-semibold text-gray-900">{selectedRequest.paymentMethod}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Requested Amount</p>
                                        <p className="text-sm font-bold text-green-600">₹{selectedRequest.amount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Available Balance</p>
                                        <p className="text-sm font-semibold text-gray-900">₹{selectedRequest.availableBalance?.toLocaleString() || '0'}</p>
                                    </div>
                                </div>

                                {selectedRequest.availableBalance !== undefined && selectedRequest.amount > selectedRequest.availableBalance && (
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3 items-center text-red-700">
                                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <p className="text-xs font-medium">Requested amount exceeds available balance. Approval might fail.</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Transaction Reference ID *</label>
                                        <input 
                                            type="text" 
                                            value={transactionRef}
                                            onChange={(e) => setTransactionRef(e.target.value)}
                                            placeholder="e.g. UPI-1234567890 or Bank TRN"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Admin Notes (Optional)</label>
                                        <textarea 
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Add internal notes or payment remarks..."
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 flex gap-3 border-t border-gray-100">
                                <button 
                                    onClick={() => { setShowApproveModal(false); setSelectedRequest(null); }}
                                    className="flex-1 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900"
                                    disabled={isProcessing}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleApprove}
                                    disabled={isProcessing || !transactionRef}
                                    className="flex-[2] bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-all disabled:opacity-50"
                                >
                                    {isProcessing ? 'Processing...' : 'Confirm Payout'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Reject Modal */}
                {showRejectModal && selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
                        >
                            <div className="bg-red-600 p-6 text-white">
                                <h2 className="text-xl font-bold">Reject Request</h2>
                                <p className="text-red-100 text-sm mt-1">Please provide a valid reason for rejection</p>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                    <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Impact</p>
                                    <p className="text-sm text-red-800">Rejecting this will notify the user. No funds will be deducted.</p>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rejection Reason *</label>
                                    <textarea 
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        rows={4}
                                        placeholder="e.g. Invalid account details, Insufficient actual earnings..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 flex gap-3 border-t border-gray-100">
                                <button 
                                    onClick={() => { setShowRejectModal(false); setSelectedRequest(null); }}
                                    className="flex-1 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900"
                                    disabled={isProcessing}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleReject}
                                    disabled={isProcessing || !rejectReason}
                                    className="flex-[2] bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50"
                                >
                                    {isProcessing ? 'Processing...' : 'Reject Request'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Details Modal */}
                {showDetailsModal && selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
                        >
                            <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold">Request Details</h2>
                                    <p className="text-gray-400 text-xs mt-1">Full audit trail for this payout</p>
                                </div>
                                <button onClick={() => { setShowDetailsModal(false); setSelectedRequest(null); }} className="p-2 hover:bg-white/10 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                <section>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Payout Info</h4>
                                    <div className="grid grid-cols-2 gap-y-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-medium">Status</p>
                                            <Badge color={selectedRequest.status === 'Completed' ? 'green' : 'gray'}>{selectedRequest.status}</Badge>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-medium">Requested On</p>
                                            <p className="text-sm font-semibold">{new Date(selectedRequest.createdAt || (selectedRequest as any).requestDate).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-medium">Transaction ID</p>
                                            <p className="text-sm font-mono">{selectedRequest.transactionReference || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-medium">Amount</p>
                                            <p className="text-sm font-bold text-gray-900">₹{selectedRequest.amount.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-gray-100"></div>

                                <section>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Payment Destination</h4>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-white rounded-lg border border-gray-200">
                                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            </div>
                                            <p className="text-sm font-bold text-gray-900">{selectedRequest.paymentMethod}</p>
                                        </div>
                                        <p className="text-sm text-gray-600 break-all">{selectedRequest.accountDetails}</p>
                                    </div>
                                </section>

                                {selectedRequest.remark && (
                                    <section>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Admin Notes</h4>
                                        <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-xl border border-yellow-100 italic">
                                            "{selectedRequest.remark}"
                                        </p>
                                    </section>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
