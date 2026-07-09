import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPolicyByType, getPublicSettings, PublicSettings } from '../../../services/api/policyService';
import { Policy } from '../../../services/api/admin/adminPolicyService';

export default function DeliveryPrivacyPolicy() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policyRes, settingsRes] = await Promise.all([
          getPolicyByType('delivery_privacy_policy'),
          getPublicSettings()
        ]);
        if (policyRes.success) setPolicy(policyRes.data);
        if (settingsRes.success) setSettings(settingsRes.data);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pb-20">
      {/* Professional Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-full transition-all text-neutral-600 hover:text-blue-600"
              aria-label="Go back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">Delivery Partner Privacy Policy</h1>
            </div>
          </div>
          {policy && (
            <div className="hidden sm:flex flex-col items-end">
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-sm text-neutral-400 font-medium animate-pulse">Fetching latest policy...</p>
          </div>
        ) : policy ? (
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-neutral-200 p-6 sm:p-10">
            <div className="prose prose-neutral max-w-none">

              <div className="text-neutral-700 leading-relaxed text-base sm:text-lg whitespace-pre-wrap font-medium">
                {policy.content}
              </div>



              <div className="mt-8">
                <div className="bg-blue-50 rounded-2xl p-6 text-center border border-blue-100 shadow-sm">
                  <h4 className="text-blue-900 font-bold mb-2">Need Help?</h4>
                  <p className="text-sm text-blue-700 mb-6">
                    If you have any questions regarding this policy, please contact our delivery support team.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm font-bold text-blue-900 mb-8">
                    <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl shadow-[0_2px_10px_-4px_rgba(37,99,235,0.2)] border border-blue-50 w-full sm:w-auto transition-transform hover:scale-105">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      {settings?.supportEmail || settings?.contactEmail || 'support@speedoo.com'}
                    </div>
                    <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-xl shadow-[0_2px_10px_-4px_rgba(37,99,235,0.2)] border border-blue-50 w-full sm:w-auto transition-transform hover:scale-105">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      {settings?.supportPhone || settings?.contactPhone || 'N/A'}
                    </div>
                  </div>
                  <div className="pt-6 border-t border-blue-200/50">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em]">
                      © 2026 Speedoo Your order our priority. All rights reserved.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <p className="text-neutral-500 font-medium">Policy content is currently unavailable.</p>
          </div>
        )}
      </div>
    </div>
  );
}
