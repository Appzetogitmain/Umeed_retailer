import React, { useState, useEffect } from 'react';
import { addReview } from '../../../services/api/customerReviewService';
import { useToast } from '../../../context/ToastContext';

interface ReviewModalProps {
  productId: string;
  orderId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({ productId, orderId, productName, onClose, onSuccess }: ReviewModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    // Lock body and html
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Lock the actual scroll container in AppLayout (main element with overflow-y-auto)
    const mainElements = document.getElementsByTagName('main');
    const originalStyles = Array.from(mainElements).map(el => el.style.overflow);
    Array.from(mainElements).forEach(el => {
      el.style.overflow = 'hidden';
    });
    
    return () => {
      // Restore all
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      Array.from(mainElements).forEach((el, index) => {
        el.style.overflow = originalStyles[index];
      });
    };
  }, []);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await addReview(productId, orderId, rating, comment);
      if (response.success) {
        showToast(response.message || 'Review submitted successfully!');
        onSuccess();
      } else {
        showToast(response.message || 'Failed to submit review', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit review', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[70] animate-in slide-in-from-bottom duration-500 ease-out p-4">
        <div className="bg-white rounded-[32px] shadow-2xl max-w-lg mx-auto p-8 relative">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-black text-neutral-900">
                Write a Review
              </h3>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{productName}</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-4">Rate this product</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill={(hoverRating || rating) >= star ? "#EAB308" : "none"}
                      stroke={(hoverRating || rating) >= star ? "#EAB308" : "#CBD5E1"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Comment (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share details of your own experience at this place"
                className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl px-5 py-4 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all resize-none h-32"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className="w-full rounded-2xl bg-[#9048A5] text-white font-black py-4 hover:bg-[#7b3a8d] transition-all shadow-xl shadow-purple-500/20 uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Submit Review"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
