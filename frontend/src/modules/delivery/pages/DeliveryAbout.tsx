import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getPolicyByType } from '../../../services/api/policyService';
import { Policy } from '../../../services/api/admin/adminPolicyService';

export default function DeliveryAbout() {
  const navigate = useNavigate();
  const [aboutContent, setAboutContent] = useState<Policy | null>(null);
  const [aboutLoading, setAboutLoading] = useState(true);

  useEffect(() => {
    const fetchAbout = async () => {
      try {
        const response = await getPolicyByType('rider_about_us');
        if (response.success) {
          setAboutContent(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch rider about content:", err);
      } finally {
        setAboutLoading(false);
      }
    };

    fetchAbout();
  }, []);

  return (
    <div className="bg-[#F8F9FA] min-h-screen pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-full transition-all text-neutral-600 hover:text-orange-600"
              aria-label="Go back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">
                {aboutLoading ? "About Us" : aboutContent?.title || "About Us"}
              </h1>
            </div>
          </div>
          {aboutContent && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-tighter">Version</span>
              <span className="text-xs font-bold text-orange-600">{aboutContent.version}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        {aboutLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-sm text-neutral-400 font-medium animate-pulse">Loading content...</p>
          </div>
        ) : aboutContent ? (
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-neutral-200 p-6 sm:p-10">
            <div className="prose prose-neutral max-w-none">
              <div className="text-neutral-700 leading-relaxed text-base sm:text-lg whitespace-pre-wrap font-medium">
                {aboutContent.content}
              </div>

              <div className="mt-16 pt-8 border-t border-neutral-100 flex justify-center">
                <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 inline-block text-center">
                  <span className="text-xs text-neutral-500 block mb-0.5">Last Revised</span>
                  <span className="text-sm font-bold text-orange-600">
                    {new Date(aboutContent.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-300">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <p className="text-neutral-500 font-medium">About content is currently unavailable.</p>
          </div>
        )}
      </div>

      <DeliveryBottomNav />
    </div>
  );
}
