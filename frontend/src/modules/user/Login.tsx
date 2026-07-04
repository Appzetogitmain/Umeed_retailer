import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import speedooLogo from "@assets/Speedoo_logo.png";
import videoSrc from "@assets/login/loginvideo.mp4";
import {
  sendOTP,
  verifyOTP,
} from "../../services/api/auth/customerAuthService";
import { useAuth } from "../../context/AuthContext";
import OTPInput from "../../components/OTPInput";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showOTP && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showOTP, resendTimer]);

  const handleContinue = async () => {
    if (mobileNumber.length !== 10 && mobileNumber.length !== 12) return;

    setLoading(true);
    setError("");

    try {
      const response = await sendOTP(mobileNumber);
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }
      setShowOTP(true);
      setResendTimer(30); // Start 30s timer
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        "Failed to initiate call. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(mobileNumber, otp, sessionId);
      if (response.success && response.data) {
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.name,
          phone: response.data.user.phone,
          email: response.data.user.email,
          walletAmount: response.data.user.walletAmount,
          refCode: response.data.user.refCode,
          status: response.data.user.status,
        });

        const redirectPath = searchParams.get("redirect") || "/";
        navigate(redirectPath);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full relative overflow-hidden flex flex-col justify-end p-8 pb-16 bg-neutral-950">
      {/* Full-screen Background Video */}
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-0 transition-opacity duration-1000"
        onCanPlay={(e) => (e.currentTarget.style.opacity = "1")}
      />

      {/* Subtle Bottom Gradient for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center hover:bg-white/20 transition-all group"
        aria-label="Back">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white group-hover:scale-110 transition-transform">
          <path
            d="M15 18L9 12L15 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Bottom Login Elements (No Card Background) */}
      <div className="w-full max-w-[340px] mx-auto z-20 space-y-3.5">
        
        {!showOTP ? (
          <div className="w-full space-y-4">
            {/* Crystal Clear Glass Mobile Input */}
            <div className="flex items-center bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden focus-within:border-[#f57c00]/60 focus-within:ring-4 focus-within:ring-[#f57c00]/10 transition-all h-12 shadow-[0_10px_30px_rgba(0,0,0,0.3)] group" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div className="px-4 text-base font-extrabold text-[#f57c00] border-r border-white/10 group-focus-within:text-[#f57c00] transition-colors">
                +91
              </div>
              <input
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
                placeholder="00000 00000"
                className="flex-1 px-4 text-base bg-transparent text-white placeholder:text-white/20 focus:outline-none font-bold tracking-[0.05em]"
                maxLength={12}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-[11px] text-red-200 font-bold bg-red-950/70 backdrop-blur-xl border border-red-500/40 p-3 rounded-xl text-center shadow-lg animate-pulse">
                {error}
              </div>
            )}

            {/* Vibrant Speedoo Brand Button */}
            <button
              onClick={handleContinue}
              disabled={(mobileNumber.length !== 10 && mobileNumber.length !== 12) || loading}
              className={`w-full h-12 rounded-xl font-black text-xs tracking-[0.1em] uppercase transition-all transform active:scale-95 shadow-[0_15px_35px_rgba(245,124,0,0.35)] flex items-center justify-center border-b-4 ${
                (mobileNumber.length === 10 || mobileNumber.length === 12) && !loading
                  ? "bg-[#f57c00] text-white border-[#d66a00] hover:bg-[#ff8a00] hover:scale-[1.02]"
                  : "bg-white/5 text-white/20 cursor-not-allowed border-white/10 backdrop-blur-md"
              }`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {loading ? "..." : "Proceed to Login"}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-4 flex flex-col items-center">
            <div className="text-center">
                <p className="text-sm font-black text-white/50 tracking-[0.25em] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  ENTER OTP
                </p>
            </div>

            <div className="w-full flex justify-center py-0.5 animate-fadeInScale">
              <OTPInput onComplete={handleOTPComplete} disabled={loading} size="compact" />
            </div>

            {error && (
              <div className="w-full text-[10px] text-red-200 bg-red-950/70 border border-red-500/30 p-2 rounded-xl text-center font-black shadow-xl">
                {error}
              </div>
            )}

            <div className="w-full flex gap-3">
              <button
                onClick={() => {
                  setShowOTP(false);
                  setError("");
                }}
                disabled={loading}
                className="flex-1 h-11 rounded-xl font-bold text-[10px] bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-xl transition-all shadow-xl tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                CHANGE
              </button>
              <button
                onClick={handleContinue}
                disabled={loading || resendTimer > 0}
                className={`flex-1 h-11 rounded-xl font-black text-[10px] text-white transition-all shadow-2xl tracking-widest ${
                  resendTimer > 0 
                    ? "bg-white/5 border-white/10 cursor-not-allowed text-white/50" 
                    : "bg-[#f57c00] border-b-4 border-[#d66a00] hover:bg-[#ff8a00]"
                }`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {loading ? "..." : resendTimer > 0 ? `RESEND IN ${resendTimer}S` : "RESEND"}
              </button>
            </div>
          </div>
        )}

        {/* Minimal Privacy Text */}
        <p className="text-[11px] text-white/50 text-center font-medium drop-shadow-md pb-4">
           By continuing, you agree to our 
           <span onClick={() => navigate("/terms-and-conditions")} className="text-white/80 underline cursor-pointer hover:text-white transition-colors ml-1">Terms</span> & <span onClick={() => navigate("/privacy-policy")} className="text-white/80 underline cursor-pointer hover:text-white transition-colors">Privacy Policy</span>
        </p>

      </div>
    </div>
  );
}
