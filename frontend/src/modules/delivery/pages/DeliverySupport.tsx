import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { getPublicSettings, PublicSettings } from "../../../services/api/policyService";

export default function DeliverySupport() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getPublicSettings();
        if (response.success) {
          setSettings(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch public settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const supportOptions = [
    {
      id: "about",
      label: "About Us",
      description: "Learn more about our mission and story.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <line x1="12" y1="16" x2="12" y2="12" strokeWidth="2" />
          <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2" />
        </svg>
      ),
      onClick: () => navigate("/delivery/about"),
    },
    {
      id: "privacy",
      label: "Privacy Policy",
      description: "How we protect and manage your personal data.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      onClick: () => navigate("/delivery/privacy-policy"),
    },
    {
      id: "terms",
      label: "Terms & Conditions",
      description: "Read the rules for using our platform.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      onClick: () => navigate("/delivery/terms-and-conditions"),
    },
    {
      id: "faq",
      label: "FAQs & Help",
      description: "Find answers to frequently asked questions.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      onClick: () => navigate("/delivery/faq"),
    },
  ];

  return (
    <div className="bg-[#FDF9F6] min-h-screen pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-full transition-all text-neutral-600 hover:text-purple-600"
              aria-label="Go back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 leading-tight">Speedoo Support</h1>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Help & Legal</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
          {supportOptions.map((item, index, array) => (
            <motion.button
              key={item.id}
              onClick={item.onClick}
              whileTap={{ scale: 0.995 }}
              className={`w-full group flex items-center justify-between px-6 py-5 hover:bg-neutral-50/60 transition-all duration-200 outline-none text-left ${
                index !== array.length - 1 ? "border-b border-neutral-100/60" : ""
              }`}
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-purple-50/80 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform shadow-sm">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                    {item.label}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 font-medium leading-none">
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 group-hover:text-purple-600 group-hover:bg-purple-50 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Contact support info card */}
        <div className="mt-8 bg-[#FAF6F3]/60 rounded-3xl border border-[#F3ECE6] p-8 text-center flex flex-col items-center shadow-[0_4px_24px_-6px_rgba(0,0,0,0.02)]">
          <p className="text-lg font-black text-neutral-900 mb-2">
            Still need help?
          </p>
          <p className="text-xs text-neutral-500 font-medium mb-6 max-w-sm leading-relaxed">
            Reach out to our customer support team directly through email or phone.
          </p>

          <div className="flex flex-col gap-3.5 w-full max-w-md mx-auto">
            {/* Email Support */}
            <a
              href={`mailto:${(settings?.supportEmail || settings?.contactEmail || "speedo@gmail.com").toLowerCase()}`}
              className="w-full inline-flex items-center justify-center gap-3 bg-[#f57c00] hover:bg-[#e65100] text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(245,124,0,0.15)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              {settings?.supportEmail || settings?.contactEmail || "speedo@gmail.com"}
            </a>

            {/* Phone Support */}
            <a
              href={`tel:${settings?.supportPhone || settings?.contactPhone || "9876586522"}`}
              className="w-full inline-flex items-center justify-center gap-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-all shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-neutral-700">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-2.2 2.2a15.045 15.045 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
              </svg>
              {settings?.supportPhone || settings?.contactPhone || "9876586522"}
            </a>
          </div>
        </div>
      </div>

      <DeliveryBottomNav />
    </div>
  );
}
