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

              <div className="mt-16 pt-8 border-t border-neutral-100 flex justify-center">
                <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 inline-block text-center">
                  <span className="text-xs text-neutral-500 block mb-0.5">Last Revised</span>
                  <span className="text-sm font-bold text-blue-600">
                    {new Date(policy.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <div className="bg-neutral-50 rounded-2xl p-6 text-center">
                  <p className="text-sm text-neutral-500 italic mb-4">
                    If you have any questions regarding this policy, please contact our delivery support team at:
                    <br />
                    <strong>Email:</strong> {settings?.supportEmail || settings?.contactEmail || 'support@speedoo.com'}
                    <br />
                    <strong>Phone:</strong> {settings?.supportPhone || settings?.contactPhone || 'N/A'}
                  </p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.3em]">
                    © 2026 Speedoo Your order our priority. All rights reserved.
                  </p>
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
