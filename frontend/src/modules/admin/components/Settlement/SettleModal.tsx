import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useScrollLock from '../../../../hooks/useScrollLock';

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
  balance: number;
}

interface SettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellers: Seller[];
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}

const SettleModal: React.FC<SettleModalProps> = ({ 
  isOpen, 
  onClose, 
  sellers, 
  onSubmit, 
  submitting 
}) => {
  useScrollLock(isOpen);
  const [formData, setFormData] = useState({
    sellerId: '',
    amount: '',
    paymentMethod: 'UPI',
    referenceId: '',
    notes: ''
  });

  const selectedSeller = sellers.find(s => s._id === formData.sellerId);
  const availableAmount = selectedSeller?.balance || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sellerId || !formData.amount || Number(formData.amount) <= 0) return;
    if (Number(formData.amount) > availableAmount) return;
    
    onSubmit({
      ...formData,
      amount: Number(formData.amount),
      type: 'Debit', // Payout is a debit
      description: `Settlement via ${formData.paymentMethod}. Ref: ${formData.referenceId || 'N/A'}`
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-neutral-900 p-8 text-white">
            <h3 className="text-2xl font-bold">Settle Payment</h3>
            <p className="text-neutral-400 text-sm mt-1">Transfer funds to seller bank/wallet account.</p>
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Seller Selection */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Select Seller</label>
              <select
                value={formData.sellerId}
                onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              >
                <option value="">Choose a seller...</option>
                {sellers.map(s => (
                  <option key={s._id} value={s._id}>{s.storeName} ({s.sellerName})</option>
                ))}
              </select>
            </div>

            {/* Amount Section */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Available</label>
                <div className="px-4 py-3 bg-green-50 border border-green-100 rounded-2xl text-sm font-bold text-green-700">
                  ₹{availableAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Amount to Pay</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (parseFloat(val) < 0) return;
                      setFormData({ ...formData, amount: val });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="0.00"
                    max={availableAmount}
                    min={0.01}
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                {Number(formData.amount) > availableAmount && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">Exceeds available balance!</p>
                )}
              </div>
            </div>

            {/* Payment Method & Reference */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Reference ID</label>
                <input
                  type="text"
                  value={formData.referenceId}
                  onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                  placeholder="TXN123456"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add settlement notes..."
                rows={2}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
              />
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || !formData.sellerId || !formData.amount || Number(formData.amount) > availableAmount}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
              >
                {submitting ? 'Processing Payout...' : 'Confirm Settlement'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SettleModal;
