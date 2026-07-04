import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getProfile,
  CustomerProfile,
  deleteAccountDirect,
  updateProfile,
} from "../../services/api/customerService";
import AuthPrompt from "../../components/AuthPrompt";


export default function Account() {
  const navigate = useNavigate();
  const { user, logout: authLogout } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDob, setEditDob] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await getProfile();
        if (response.success) {
          setProfile(response.data);
        } else {
          setError("Failed to load profile");
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load profile");
        if (err.response?.status === 401 || err.response?.status === 404) {
          authLogout();
        }
      } finally {

        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user, navigate, authLogout]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = showEditModal || showDeleteModal;
    if (isAnyModalOpen) {
      // Lock body and html
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      // Lock the AppLayout main scroll container
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.style.overflow = '';
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.style.overflow = '';
      }
    };
  }, [showEditModal, showDeleteModal]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleLogout = () => {
    authLogout();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      const response = await deleteAccountDirect();
      if (response.success) {
        setShowDeleteModal(false);
        authLogout();
        navigate("/login", { state: { message: "Account deleted successfully." } });
      } else {
        setDeleteError(response.message || "Failed to delete account");
      }
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditProfile = () => {
    setEditName(profile?.name || user?.name || "");
    setEditEmail(profile?.email || user?.email || "");
    setEditDob(profile?.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : "");
    setShowEditModal(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateError("");
    
    // Validate name (only alphabets and spaces)
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(editName)) {
      setUpdateError("Name should only contain alphabets and spaces");
      setIsUpdating(false);
      return;
    }

    // Validate email stricter
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      setUpdateError("Please enter a valid email address");
      setIsUpdating(false);
      return;
    }

    // Validate age (min 18)
    if (editDob) {
      const today = new Date();
      const birthDate = new Date(editDob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        setUpdateError("You must be at least 18 years old");
        setIsUpdating(false);
        return;
      }
    }
    try {
      const response = await updateProfile({
        name: editName,
        email: editEmail,
        dateOfBirth: editDob,
      });
      if (response.success) {
        setProfile(response.data);
        setShowEditModal(false);
      } else {
        setUpdateError(response.message || "Failed to update profile");
      }
    } catch (err: any) {
      setUpdateError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  // Show login/signup prompt for unregistered users
  if (!user) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen">
        <div className="bg-gradient-to-b from-purple-50 to-white pb-6 md:pb-8 pt-8 px-4">
          <AuthPrompt 
            title="Your Profile" 
            description="Login to view your profile."
            icon="👤"
          />


        </div>
      </div>
    );
  }


  if (loading) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gradient-to-r from-[#FFC107] to-[#B95F15] text-white rounded-full font-bold uppercase tracking-wide">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || "User";
  const displayPhone = profile?.phone || user?.phone || "";
  const displayDateOfBirth = profile?.dateOfBirth;

  return (
    <div className="pb-24 md:pb-8 bg-gradient-to-br from-white via-yellow-50/30 to-purple-50/30 min-h-screen">
      {/* Top Header & Profile Section */}
      <div className="bg-[#9048A5] sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-4 max-w-7xl mx-auto w-full">
          <button
            onClick={() => navigate(-1)}
            className="text-white p-1 rounded-full hover:bg-black/10 transition-colors"
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
          <h1 className="text-lg font-bold text-white tracking-tight">Account</h1>
        </div>
      </div>
      {/* Profile Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-100/30 via-transparent to-transparent pb-12 pt-6">
        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[0%] left-[-5%] w-48 h-48 bg-yellow-200/20 rounded-full blur-3xl pointer-events-none" />

        <div className="px-4 md:px-6 lg:px-8 max-w-2xl mx-auto relative z-10">

          {/* Profile Card */}
          <div className="bg-white rounded-[24px] shadow-[0_10px_40px_-10px_rgba(123,31,162,0.15)] p-6 relative">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 p-1 shadow-inner">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center border-2 border-white shadow-lg overflow-hidden">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-purple-600 md:w-14 md:h-14">
                      <path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="7"
                        r="4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <button 
                  onClick={handleEditProfile}
                  className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-purple-600 border-2 border-white flex items-center justify-center text-white shadow-md hover:scale-110 active:scale-90 transition-all">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>

              <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mb-1">
                {displayName}
              </h2>
              
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {displayPhone && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-100 text-[13px] text-neutral-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>{displayPhone}</span>
                  </div>
                )}
                {displayDateOfBirth && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-100 text-[13px] text-neutral-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{formatDate(displayDateOfBirth)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards (Orders / Help) */}
      <div className="px-4 md:px-6 lg:px-8 -mt-6 mb-8 relative z-20">
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/orders")}
            className="group bg-white rounded-2xl p-4 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] border border-neutral-100 hover:border-yellow-200 transition-all duration-300 hover:shadow-[0_12px_24px_-8px_rgba(255,193,7,0.25)] hover:-translate-y-1 outline-none">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-yellow-600">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-sm font-bold text-neutral-900 mb-0.5">Your Orders</div>
            <div className="text-[11px] text-neutral-500 font-medium">History & status</div>
          </button>
          
          <button
            onClick={() => navigate("/faq")}
            className="group bg-white rounded-2xl p-4 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] border border-neutral-100 hover:border-purple-200 transition-all duration-300 hover:shadow-[0_12px_24px_-8px_rgba(123,31,162,0.15)] hover:-translate-y-1 outline-none">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-purple-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-sm font-bold text-neutral-900 mb-0.5">Need Help?</div>
            <div className="text-[11px] text-neutral-500 font-medium">Support & FAQs</div>
          </button>
        </div>
      </div>

      {/* Your Information List */}
      <div className="px-4 md:px-6 lg:px-8 pb-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.1em]">
              Your Information
            </h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            {[
              { id: 'address', label: 'Address Book', icon: (
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ), onClick: () => navigate("/address-book") },
              { id: 'wishlist', label: 'Your Wishlist', icon: (
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ), onClick: () => navigate("/wishlist") },
              { id: 'support', label: 'Speedoo Support', icon: (
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ), onClick: () => navigate("/support") },
            ].map((item, index, array) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full group flex items-center justify-between px-4 py-3.5 hover:bg-neutral-50 transition-all duration-200 outline-none ${
                  index !== array.length - 1 ? 'border-b border-neutral-50' : ''
                }`}>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      {item.icon}
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{item.label}</span>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 group-hover:text-purple-600 group-hover:bg-purple-50 transition-all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}

            {/* Logout button separate */}
            <div className="pt-6">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50/50 rounded-2xl border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all duration-300 group outline-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 group-hover:translate-x-1 transition-transform">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="text-sm font-bold text-red-600">Log Out</span>
              </button>
            </div>

            {/* Delete Account button */}
            <div className="pt-2 pb-6">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50/50 rounded-2xl border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all duration-300 group outline-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 group-hover:scale-110 transition-transform">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="text-sm font-bold text-red-600">Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Warning Modal */}
      {showDeleteModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] animate-in slide-in-from-bottom duration-500 ease-out p-4">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-lg mx-auto p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
              
              <div className="text-center">
                <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                
                <h3 className="text-2xl font-black text-neutral-900 mb-3">
                  Delete Account
                </h3>
                <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
                  Are you sure you want to permanently delete your account?<br /><br />
                  This action cannot be undone.<br />
                  All your data will be permanently removed.
                </p>

                {deleteError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-shake">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                    className="flex-1 rounded-2xl bg-neutral-100 text-neutral-900 font-bold py-4 hover:bg-neutral-200 transition-all uppercase tracking-widest text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="flex-1 rounded-2xl bg-red-600 text-white font-black py-4 hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => !isUpdating && setShowEditModal(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] animate-in slide-in-from-bottom duration-500 ease-out p-4">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-lg mx-auto p-8 relative">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-neutral-900">
                  Edit Profile
                </h3>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {updateError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold">
                  {updateError}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl px-5 py-4 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl px-5 py-4 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Date of Birth</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl px-5 py-4 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full rounded-2xl bg-[#9048A5] text-white font-black py-4 hover:bg-[#7b3a8d] transition-all shadow-xl shadow-purple-500/20 uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                    {isUpdating ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
