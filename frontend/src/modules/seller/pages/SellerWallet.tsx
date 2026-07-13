import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../context/ToastContext';
import {
  getSellerWalletBalance,
  getSellerWalletTransactions,
  requestSellerWithdrawal,
  getSellerWithdrawals,
  getSellerCommissions,
  getSellerPaymentDetails
} from '../../../services/api/sellerWalletService';

type Tab = 'transactions' | 'withdrawals' | 'commissions';

export default function SellerWallet() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any>({ commissions: [], total: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'UPI'>('Bank Transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [savedPaymentDetails, setSavedPaymentDetails] = useState<any>(null);
  const [useSavedDetails, setUseSavedDetails] = useState(true);

  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    bankName: '',
    branch: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: ''
  });

  const [upiDetails, setUpiDetails] = useState({
    upiId: '',
    confirmUpiId: ''
  });

  // Lock ALL scroll containers when modal is open
  useEffect(() => {
    const mainEl = document.getElementById('seller-main-content');
    const htmlEl = document.documentElement;
    if (showWithdrawModal) {
      // Use setProperty with 'important' to forcefully override Tailwind classes
      document.body.style.setProperty('overflow', 'hidden', 'important');
      htmlEl.style.setProperty('overflow', 'hidden', 'important');
      if (mainEl) mainEl.style.setProperty('overflow', 'hidden', 'important');
    } else {
      document.body.style.removeProperty('overflow');
      htmlEl.style.removeProperty('overflow');
      if (mainEl) mainEl.style.removeProperty('overflow');
    }
    return () => {
      document.body.style.removeProperty('overflow');
      htmlEl.style.removeProperty('overflow');
      if (mainEl) mainEl.style.removeProperty('overflow');
    };
  }, [showWithdrawModal]);


  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [balanceRes, transactionsRes, withdrawalsRes, commissionsRes, paymentDetailsRes] = await Promise.all([
        getSellerWalletBalance(),
        getSellerWalletTransactions(),
        getSellerWithdrawals(),
        getSellerCommissions(),
        getSellerPaymentDetails()
      ]);

      if (balanceRes.success) setBalance(balanceRes.data.balance);
      if (transactionsRes.success) setTransactions(transactionsRes.data.transactions || []);
      if (withdrawalsRes.success) setWithdrawals(withdrawalsRes.data || []);
      if (commissionsRes.success) setCommissions(commissionsRes.data);
      if (paymentDetailsRes.success) setSavedPaymentDetails(paymentDetailsRes.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      if (amount > balance) {
        showToast('Insufficient balance', 'error');
        return;
      }

      let payloadBankDetails = undefined;
      let payloadUpiDetails = undefined;

      if (paymentMethod === 'Bank Transfer') {
        if (!useSavedDetails || !savedPaymentDetails?.bankDetails) {
          if (!bankDetails.accountName || !bankDetails.bankName || !bankDetails.branch || !bankDetails.accountNumber || !bankDetails.ifsc) {
            showToast('Please fill all bank details', 'error');
            return;
          }
          if (!/^\d{9,18}$/.test(bankDetails.accountNumber)) {
            showToast('Account number must be between 9 and 18 digits', 'error');
            return;
          }
          if (bankDetails.accountNumber !== bankDetails.confirmAccountNumber) {
            showToast('Account numbers do not match', 'error');
            return;
          }
          if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifsc)) {
            showToast('Invalid IFSC code format (e.g., HDFC0001234)', 'error');
            return;
          }
          payloadBankDetails = bankDetails;
        }
      } else if (paymentMethod === 'UPI') {
        if (!useSavedDetails || !savedPaymentDetails?.upiDetails) {
          if (!upiDetails.upiId) {
            showToast('Please enter UPI ID', 'error');
            return;
          }
          if (upiDetails.upiId !== upiDetails.confirmUpiId) {
            showToast('UPI IDs do not match', 'error');
            return;
          }
          if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiDetails.upiId)) {
            showToast('Invalid UPI ID format (e.g., name@bank)', 'error');
            return;
          }
          payloadUpiDetails = upiDetails;
        }
      }

      setIsSubmitting(true);
      const response = await requestSellerWithdrawal(amount, paymentMethod, payloadBankDetails, payloadUpiDetails);
      if (response.success) {
        showToast('Withdrawal request submitted successfully', 'success');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        // Reset form
        setBankDetails({ accountName: '', bankName: '', branch: '', accountNumber: '', confirmAccountNumber: '', ifsc: '' });
        setUpiDetails({ upiId: '', confirmUpiId: '' });
        setUseSavedDetails(true);
        fetchWalletData();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to request withdrawal', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Wallet</h1>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 m-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between"
        >
          <div>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">Withdrawable Balance</p>
            <h1 className="text-4xl font-bold mb-4">₹{balance.toFixed(2)}</h1>
          </div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-md mt-auto"
          >
            Request Withdrawal
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col"
        >
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Settlement</p>
            <div className="group relative">
              <svg className="w-4 h-4 text-gray-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                Earnings from COD orders currently being held by delivery partners. Will move to balance once settled with Admin.
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">₹{(commissions.pending || 0).toFixed(2)}</h2>
          <div className="mt-auto">
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <p className="text-xs font-semibold uppercase tracking-tight">Held by Riders</p>
            </div>
          </div>
        </motion.div>
      </div>


      {/* Tabs */}
      <div className="bg-white mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'transactions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600'
              }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'withdrawals'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600'
              }`}
          >
            Withdrawals
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'commissions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600'
              }`}
          >
            Commissions
          </button>
        </div>

        <div className="p-4">
          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-3">
              {(() => {
                // Combine transactions and pending commissions
                const allItems = [
                  ...transactions.map((t: any) => ({ ...t, source: 'transaction' })),
                  ...(commissions.commissions || [])
                    .filter((c: any) => c.status === 'Pending')
                    .map((c: any) => ({
                      _id: c.id || c._id,
                      description: `Order #${c.orderId?.substring(0, 8) || 'Unknown'} (Pending)`,
                      amount: c.orderAmount - c.amount, // Calculate Net Earning: Order Amount - Commission Fee
                      type: 'Credit',
                      createdAt: c.createdAt,
                      status: 'Pending',
                      source: 'commission'
                    }))
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                if (allItems.length === 0) {
                  return <p className="text-center text-gray-500 py-8">No transactions yet</p>;
                }

                return allItems.map((item: any) => (
                  <div key={item._id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.status === 'Pending' && (
                          <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            Pending
                          </span>
                        )}
                        {item.status === 'Completed' && (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            Success
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <p className={`font-bold text-lg ${item.type === 'Credit' ? 'text-green-600' : 'text-red-600'} ${item.status === 'Pending' ? 'opacity-60' : ''}`}>
                      {item.type === 'Credit' ? '+' : '-'}₹{item.amount.toFixed(2)}
                    </p>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-3">
              {withdrawals.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No withdrawal requests yet</p>
              ) : (
                withdrawals.map((withdrawal: any) => (
                  <div key={withdrawal._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-900">₹{withdrawal.amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-600">{withdrawal.paymentMethod}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${withdrawal.status === 'Completed'
                          ? 'bg-green-100 text-green-700'
                          : withdrawal.status === 'Approved'
                            ? 'bg-blue-100 text-blue-700'
                            : withdrawal.status === 'Rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                      >
                        {withdrawal.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(withdrawal.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    {withdrawal.remarks && (
                      <p className="text-xs text-gray-600 mt-2 italic">{withdrawal.remarks}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Commissions Tab */}
          {activeTab === 'commissions' && (
            <div className="space-y-3">
              {commissions.commissions?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No commissions yet</p>
              ) : (
                commissions.commissions?.map((comm: any) => (
                  <div key={comm.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">Order Commission</p>
                        <p className="text-xs text-gray-600">Rate: {comm.rate}%</p>
                      </div>
                      <p className="font-bold text-green-600">₹{comm.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Order Amount: ₹{comm.orderAmount.toFixed(2)}</span>
                      <span>{new Date(comm.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Withdrawal Modal - rendered via Portal to escape the scrollable main container */}
      {showWithdrawModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full"
          >
            <h2 className="text-2xl font-bold mb-4">Request Withdrawal</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Available: ₹{balance.toFixed(2)}</p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as any);
                  setUseSavedDetails(true);
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            {/* Dynamic Payment Details Area */}
            <div className="mb-6 max-h-[40vh] overflow-y-auto px-1 pb-1">
              {paymentMethod === 'Bank Transfer' && (
                <>
                  {savedPaymentDetails?.bankDetails && useSavedDetails ? (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Saved Bank Account</p>
                      <p className="text-sm text-blue-800">{savedPaymentDetails.bankDetails.bankName}</p>
                      <p className="text-sm font-mono text-blue-800 mt-1">{savedPaymentDetails.bankDetails.accountNumber}</p>
                      <p className="text-xs text-blue-600 mt-1">IFSC: {savedPaymentDetails.bankDetails.ifsc}</p>
                      <button 
                        onClick={() => setUseSavedDetails(false)}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900 underline mt-3 inline-block"
                      >
                        Use a different bank account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-gray-800 border-b pb-2">Enter Bank Details</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                        <input
                          type="text"
                          value={bankDetails.accountName}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={bankDetails.bankName}
                            onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                          <input
                            type="text"
                            value={bankDetails.branch}
                            onChange={(e) => setBankDetails({ ...bankDetails, branch: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Account Number</label>
                        <input
                          type="password" // obfuscate for security feeling
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Account Number</label>
                        <input
                          type="text"
                          value={bankDetails.confirmAccountNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, confirmAccountNumber: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          value={bankDetails.ifsc}
                          onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                        />
                      </div>
                      {savedPaymentDetails?.bankDetails && (
                        <button 
                          onClick={() => setUseSavedDetails(true)}
                          className="text-xs font-bold text-gray-500 hover:text-gray-700 underline mt-2"
                        >
                          Cancel and use saved details
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {paymentMethod === 'UPI' && (
                <>
                  {savedPaymentDetails?.upiDetails && useSavedDetails ? (
                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                      <p className="text-sm font-semibold text-purple-900 mb-1">Saved UPI ID</p>
                      <p className="text-sm font-mono text-purple-800">{savedPaymentDetails.upiDetails.upiId}</p>
                      <button 
                        onClick={() => setUseSavedDetails(false)}
                        className="text-xs font-bold text-purple-700 hover:text-purple-900 underline mt-3 inline-block"
                      >
                        Use a different UPI ID
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-gray-800 border-b pb-2">Enter UPI Details</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">UPI ID</label>
                        <input
                          type="password"
                          value={upiDetails.upiId}
                          onChange={(e) => setUpiDetails({ ...upiDetails, upiId: e.target.value.toLowerCase() })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Confirm UPI ID</label>
                        <input
                          type="text"
                          value={upiDetails.confirmUpiId}
                          onChange={(e) => setUpiDetails({ ...upiDetails, confirmUpiId: e.target.value.toLowerCase() })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      {savedPaymentDetails?.upiDetails && (
                        <button 
                          onClick={() => setUseSavedDetails(true)}
                          className="text-xs font-bold text-gray-500 hover:text-gray-700 underline mt-2"
                        >
                          Cancel and use saved details
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 font-semibold hover:bg-gray-50 transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawRequest}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div >
  );
}
