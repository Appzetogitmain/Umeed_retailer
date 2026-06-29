import { useState, useEffect } from 'react';
import { getPolicies, upsertPolicy, type Policy } from '../../../services/api/admin/adminPolicyService';
import { useToast } from '../../../context/ToastContext';

type PolicyType = "about_us" | "privacy_policy" | "terms_and_conditions";

export default function AdminCustomerAppPolicy() {
  const [activeTab, setActiveTab] = useState<PolicyType>("about_us");
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { showToast } = useToast();

  const fetchPolicy = async (type: PolicyType) => {
    setFetching(true);
    try {
      const response = await getPolicies({ type });
      if (response.success && response.data && response.data.length > 0) {
        const policy = response.data[0];
        setContent(policy.content);
        setTitle(policy.title);
        setVersion(policy.version);
      } else {
        // Defaults if not found
        setContent('');
        setTitle(getDefaultTitle(type));
        setVersion('1.0.0');
      }
    } catch (err) {
      console.error('Failed to fetch policy:', err);
    } finally {
      setFetching(false);
    }
  };

  const getDefaultTitle = (type: PolicyType) => {
    switch (type) {
      case 'about_us': return 'About Us (Mission)';
      case 'privacy_policy': return 'Privacy Policy';
      case 'terms_and_conditions': return 'Terms and Conditions';
      default: return '';
    }
  };

  useEffect(() => {
    fetchPolicy(activeTab);
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await upsertPolicy({
        type: activeTab,
        title,
        content,
        version,
        isActive: true
      });
      if (response.success) {
        showToast(`${getDefaultTitle(activeTab)} updated successfully!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update policy', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">App Content & Policies</h1>
          </div>
            <p className="text-sm text-neutral-500 mt-1">Manage what users see in the About and Legal sections</p>
          </div>
          <div className="text-sm">
            <span className="text-[#9048A5] font-medium">Admin</span> / <span className="text-neutral-400">Content</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 sm:px-6 border-b border-neutral-200">
        <div className="flex space-x-8 overflow-x-auto no-scrollbar">
          {(['about_us', 'privacy_policy', 'terms_and_conditions'] as PolicyType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`py-4 px-1 border-b-2 font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === type
                  ? 'border-[#9048A5] text-[#9048A5]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              {getDefaultTitle(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {fetching ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9048A5]"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="p-6 border-b border-neutral-100">
                <h3 className="text-lg font-bold text-neutral-900 mb-4">Edit {getDefaultTitle(activeTab)}</h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-neutral-800 mb-2">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#9048A5]/20 focus:border-[#9048A5]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-800 mb-2">
                        Version <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#9048A5]/20 focus:border-[#9048A5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-neutral-800 mb-2">
                      Content Text <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={`Enter ${getDefaultTitle(activeTab)} content...`}
                      rows={15}
                      required
                      className="w-full px-4 py-3 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#9048A5]/20 focus:border-[#9048A5] resize-y font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-neutral-50 px-6 py-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-[#9048A5] text-white rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-[#7b3a8d] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save {getDefaultTitle(activeTab)}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
