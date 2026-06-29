import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  sendOTP,
  verifyOTP,
} from "../../../services/api/auth/adminAuthService";
import OTPInput from "../../../components/OTPInput";
import { useAuth } from "../../../context/AuthContext";
import speedooLogo from "@assets/Speedoo_logo.png";
import videoSrc from "@assets/login/loginvideo.mp4";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showOTP && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showOTP, resendTimer]);

  const handleMobileLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mobileNumber.length !== 10 && mobileNumber.length !== 12) return;

    setLoading(true);
    setError("");

    try {
      await sendOTP(mobileNumber);
      setShowOTP(true);
      setResendTimer(30);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(mobileNumber, otp);
      if (response.success && response.data) {
        login(response.data.token, {
          ...response.data.user,
          userType: "Admin",
        });
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface selection:bg-primary selection:text-on-primary-fixed overflow-x-hidden relative">
      {/* Background Layer with Atmosphere */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-30 mix-blend-overlay scale-110"
        />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 z-20 p-2.5 rounded-full glass-card hover:bg-surface-variant transition-all hover:scale-110 group"
        aria-label="Back"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-[#f57c00]"
        >
          <path
            d="M15 19l-7-7 7-7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Main Content Shell */}
      <main className="relative z-10 flex flex-col min-h-screen items-center justify-center p-6 sm:p-8">
        {/* Logo Section - Now outside for a clean header look */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-32 h-32 mb-2 flex items-center justify-center">
            <img
              src={speedooLogo}
              alt="Speedoo Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter italic text-[#f57c00] drop-shadow-md">
            Speedoo
          </h1>
          <p className="font-body text-sm text-white/80 mt-1 tracking-wide font-medium drop-shadow-md">
            Admin Portal
          </p>
        </div>

        <div className="glass-card w-full max-w-[420px] rounded-3xl p-8 md:p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] border border-white/10 animate-slide-left">

          {!showOTP ? (
            <form onSubmit={handleMobileLogin} className="space-y-6">
              <div className="space-y-2">
                <label
                  className="font-label text-xs uppercase tracking-[0.15em] font-bold text-on-surface-variant ml-1"
                  htmlFor="phone"
                >
                  Phone Number
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none group-focus-within:text-[#f57c00] transition-colors">
                    <div className="flex items-center bg-[#f57c00] rounded-xl px-3 py-2 ml-1 shadow-sm">
                      <span className="text-sm font-extrabold text-black">
                        +91
                      </span>
                    </div>
                  </div>
                  <input
                    className="w-full bg-surface-container-lowest border border-white/10 rounded-2xl py-4 pl-20 pr-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-primary/50 focus:bg-surface-container-low transition-all duration-300 font-medium tracking-wide"
                    id="phone"
                    placeholder="Enter phone number"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length === 12 && val.startsWith("91")) {
                        setMobileNumber(val.slice(2));
                      } else {
                        setMobileNumber(val.slice(0, 12));
                      }
                    }}
                    maxLength={12}
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-error font-bold bg-error-container/20 p-3 rounded-xl border border-error/30 text-center animate-fadeIn">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  className="w-full bg-[#f57c00] text-white border-2 border-[#d66a00] font-headline font-extrabold text-lg py-4 rounded-2xl shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                  type="submit"
                  disabled={(mobileNumber.length !== 10 && mobileNumber.length !== 12) || loading}
                >
                  {loading ? "Sending..." : "Continue"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="font-body text-sm text-on-surface-variant mb-2">
                  Enter 4-digit OTP sent to
                </p>
                <p className="font-headline font-bold text-on-surface tracking-widest">
                  +91 {mobileNumber}
                </p>
              </div>

              <OTPInput
                onComplete={handleOTPComplete}
                disabled={loading}
                variant="dark"
              />

              {error && (
                <div className="text-xs text-error font-bold bg-error-container/20 p-3 rounded-xl border border-error/30 text-center animate-fadeIn">
                  {error}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="flex-1 py-4 rounded-full font-headline font-bold text-sm bg-surface-variant text-on-surface-variant hover:bg-surface-bright transition-colors border border-outline-variant/30"
                >
                  Back
                </button>
                <button
                  onClick={() => handleMobileLogin()}
                  disabled={loading || resendTimer > 0}
                  className={`flex-1 py-4 rounded-full font-headline font-bold text-sm transition-colors ${
                    resendTimer > 0
                      ? "bg-secondary-container/50 text-on-secondary-container/50 cursor-not-allowed"
                      : "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80"
                  }`}
                >
                  {loading ? "..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend"}
                </button>
              </div>
            </div>
          )}

          {/* Footer separator */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 w-full">
              <div className="h-px bg-outline-variant/15 flex-grow"></div>
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/50 font-bold">
                Authorized Access Only
              </span>
              <div className="h-px bg-outline-variant/15 flex-grow"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative Corner Element */}
      <div className="fixed bottom-10 right-10 z-10 hidden lg:block opacity-60">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/20 bg-surface-container/30 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse shadow-[0_0_8px_rgba(255,110,132,0.8)]"></span>
          <span className="font-label text-[10px] uppercase tracking-widest font-bold">
            System Online: Admin Control
          </span>
        </div>
      </div>
    </div>
  );
}
