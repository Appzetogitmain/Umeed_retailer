import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { getHelpSupport } from "../../../services/api/delivery/deliveryService";
import { FAQItem } from "../../../services/api/customer/customerContentService";

export default function DeliveryFAQ() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getHelpSupport();
        if (response && response.faqs) {
          setFaqs(response.faqs);
        }
      } catch (error) {
        console.error("Error fetching delivery FAQs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="pb-24 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#FFF3E0] via-[#FFE0B2] to-white pb-6 pt-12">
        <div className="px-4">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-neutral-900 hover:bg-neutral-100/50 p-2 rounded-full transition-colors"
            aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-3 border-2 border-white shadow-sm">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                className="text-orange-600">
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-neutral-900 mb-2">
              Delivery Partner FAQs
            </h1>
            <p className="text-sm text-neutral-600 text-center px-4">
              Find answers to common questions about delivery guidelines & payouts
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-neutral-500 font-medium">Loading questions...</p>
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-400 italic">No questions found at the moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map((item) => {
                const itemId = item.id || (item as any)._id;
                const isOpen = openItems.has(itemId);
                return (
                  <div
                    key={itemId}
                    className="bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all shadow-sm">
                    <button
                      onClick={() => toggleItem(itemId)}
                      className="w-full flex items-center justify-between px-4 py-4 hover:bg-neutral-50 transition-colors text-left">
                      <span className="text-sm font-bold text-neutral-900 pr-4">
                        {item.question}
                      </span>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`flex-shrink-0 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""
                          }`}>
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0">
                        <p className="text-sm text-neutral-600 leading-relaxed font-medium">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <DeliveryBottomNav />
    </div>
  );
}
