import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPolicyByType } from '../../services/api/policyService';
import { Policy } from '../../services/api/admin/adminPolicyService';

export default function TermsOfService() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const response = await getPolicyByType('terms_and_conditions');
        if (response.success) {
          setPolicy(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch terms and conditions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  return (
    <div className="bg-[#FDF9F6] min-h-screen pb-20">
      {/* Professional Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-full transition-all text-neutral-600 hover:text-[#B95F15]"
              aria-label="Go back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">Terms of Service</h1>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Legal Documents</p>
            </div>
          </div>
          {policy && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-tighter">Version</span>
              <span className="text-xs font-bold text-[#B95F15]">{policy.version}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#B95F15] mb-4"></div>
            <p className="text-sm text-neutral-400 font-medium animate-pulse">Fetching latest terms...</p>
          </div>
        ) : policy ? (
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-neutral-200 p-6 sm:p-10">
            <div className="prose prose-neutral max-w-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-end mb-8 pb-6 border-b border-neutral-100 gap-4">
                <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100">
                  <span className="text-xs text-neutral-500 block mb-0.5">Last Revised</span>
                  <span className="text-sm font-bold text-[#B95F15]">
                    {new Date(policy.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              
              <div className="text-neutral-700 leading-relaxed text-base sm:text-lg whitespace-pre-wrap font-medium">
                {policy.content}
              </div>

              <div className="mt-16 pt-8 border-t border-neutral-100">
                <div className="bg-neutral-50 rounded-2xl p-6 text-center">
                  <p className="text-sm text-neutral-500 italic mb-4">
                    By using our platform, you agree to these terms. If you have any questions, contact us at support@speedoo.com
                  </p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.3em]">
                    © 2026 Speedoo Tech Solutions. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-neutral-500 font-medium">Terms content is currently unavailable.</p>
          </div>
        )}
      </div>
    </div>
  );
}
