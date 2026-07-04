import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPolicyByType } from "../../services/api/policyService";
import { Policy } from "../../services/api/admin/adminPolicyService";

export default function AboutUs() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const response = await getPolicyByType("about_us");
        if (response.success) {
          setPolicy(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch about us content:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-50 to-white pb-6 pt-4 sticky top-0 z-10 border-b border-neutral-100">
        <div className="px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-neutral-900"
              aria-label="Back">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-neutral-900">About Us</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-4xl mx-auto">
        {/* Logo/Brand Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">Speedoo</h2>
          <p className="text-sm text-neutral-600 font-medium tracking-wide">
            Your Trusted 10-Minute Delivery Partner
          </p>
        </div>

        {/* Dynamic Mission Section */}
        <div className="bg-purple-50 rounded-3xl p-8 mb-12 border border-purple-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/20 rounded-full blur-2xl -mr-16 -mt-16" />
          
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : policy ? (
            <div className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {policy.content}
            </div>
          ) : (
            <>
              <p className="text-neutral-700 leading-relaxed">
                At Speedoo, we're committed to revolutionizing the way you shop and
                receive your products. Our mission is to provide lightning-fast
                delivery services while maintaining the highest standards of quality
                and customer satisfaction.
              </p>
              <p className="text-neutral-700 mt-4 leading-relaxed">
                We leverage cutting-edge technology and a hyper-local network to ensure that your daily essentials are delivered to your doorstep in just 10 minutes.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
