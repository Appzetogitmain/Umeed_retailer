import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getDeliveryProfile } from '../../../services/api/delivery/deliveryService';
import { getPolicyByType } from '../../../services/api/policyService';
import { Policy } from '../../../services/api/admin/adminPolicyService';

export default function DeliveryAbout() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [aboutContent, setAboutContent] = useState<Policy | null>(null);
  const [aboutLoading, setAboutLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getDeliveryProfile();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setProfileLoading(false);
      }
    };

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

    fetchProfile();
    fetchAbout();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <div className="px-4 py-4">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 bg-white shadow-sm border border-neutral-200 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-bold tracking-tight">Delivery Partner</h2>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100/50 rounded-full blur-2xl -mr-12 -mt-12" />
          
          {profileLoading ? (
            <div className="text-center text-neutral-500 text-sm py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
              Loading profile...
            </div>
          ) : profile ? (
            <div className="flex flex-col items-center relative z-10">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 p-1 mb-4 shadow-lg">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-orange-600 font-bold text-3xl border-2 border-white">
                  {profile.name?.charAt(0).toUpperCase()}
                </div>
              </div>
              <h3 className="text-neutral-900 text-xl font-bold">{profile.name}</h3>
              <p className="text-neutral-500 text-sm mb-1 font-medium">+91 {profile.mobile}</p>
              
              <div className="mt-4 flex items-center gap-3">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  profile.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {profile.status}
                </span>
                <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                  <span className="text-xs font-bold">4.8</span>
                </div>
              </div>

              <div className="w-full mt-6 pt-6 border-t border-neutral-100 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest mb-1">City</p>
                  <p className="text-neutral-800 text-sm font-bold">{profile.city}</p>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest mb-1">Joined</p>
                  <p className="text-neutral-800 text-sm font-bold">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-red-500 text-sm py-4">Failed to load profile</div>
          )}
        </div>

        {/* Dynamic Partner Content */}
        <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 mb-6 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-20 h-20 bg-orange-200/30 rounded-full blur-2xl -ml-10 -mt-10" />
           <h3 className="text-lg font-bold text-neutral-900 mb-4 relative z-10 flex items-center gap-2">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-orange-600">
               <path d="M12 2L2 7l10 5 10-5-10-5z" />
               <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
             </svg>
             {aboutLoading ? "Our Community" : aboutContent?.title || "Partner Program"}
           </h3>
           
           {aboutLoading ? (
             <div className="flex justify-center py-4">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
             </div>
           ) : aboutContent ? (
             <div className="text-neutral-700 text-sm leading-relaxed whitespace-pre-wrap relative z-10">
               {aboutContent.content}
             </div>
           ) : (
             <p className="text-neutral-600 text-sm leading-relaxed relative z-10">
               Join the fastest-growing delivery network and earn more with Speedoo. We provide best-in-class support, flexible timings, and instant payouts to all our delivery partners.
             </p>
           )}
        </div>

        {/* Legal Links */}
        <div className="mb-6">
          <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-4 px-1">Legal & Support</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/privacy-policy")}
              className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col items-center gap-3 hover:border-purple-500 transition-all hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-neutral-900">Privacy Policy</span>
            </button>
            <button
              onClick={() => navigate("/terms")}
              className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col items-center gap-3 hover:border-orange-500 transition-all hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <span className="text-sm font-bold text-neutral-900">Terms of Use</span>
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50/50">
            <h3 className="text-neutral-900 font-bold text-sm">App Information</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            <div className="px-5 py-4 flex justify-between items-center">
              <p className="text-neutral-500 text-xs font-medium">Version</p>
              <p className="text-neutral-900 text-xs font-bold">1.4.0</p>
            </div>
            <div className="px-5 py-4 flex justify-between items-center">
              <p className="text-neutral-500 text-xs font-medium">Last Updated</p>
              <p className="text-neutral-900 text-xs font-bold">April 2026</p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 text-center pb-4">
          <p className="text-neutral-400 text-[10px] font-medium tracking-widest uppercase">© 2026 Speedoo Tech Solutions</p>
        </div>
      </div>
      <DeliveryBottomNav />
    </div>
  );
}
