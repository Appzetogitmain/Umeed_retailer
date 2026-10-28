import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getDeliveryProfile } from "../../../services/api/delivery/deliveryService";
import speedooLogo from "@assets/Speedoo_logo.png";

export default function DeliveryUnderReview() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage("");
    try {
      const profile = await getDeliveryProfile();
      if (profile?.status === "Active") {
        navigate("/delivery", { replace: true });
      } else if (profile?.status === "Rejected") {
        setMessage(
          profile.rejectionReason
            ? `Your application was rejected. Reason: ${profile.rejectionReason}`
            : "Your application was rejected. Please contact support."
        );
      } else {
        setMessage("Your application is still under review. Please check again later.");
      }
    } catch {
      setMessage("Could not check status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/delivery/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
        <img src={speedooLogo} alt="Speedoo" className="h-12 mx-auto mb-4" />

        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-neutral-900 mb-2">Registration Successful!</h1>
        <p className="text-sm text-neutral-600 mb-4">
          Thank you{user?.name ? `, ${user.name}` : ""}. Your application has been submitted and is
          now <span className="font-semibold text-amber-600">under review</span>.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left text-sm text-amber-800 mb-5">
          <p className="font-semibold mb-1">What happens next?</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Our team will verify your documents.</li>
            <li>Once approved, you can start accepting deliveries.</li>
            <li>Log in again anytime with your mobile number to check your status.</li>
          </ul>
        </div>

        {message && <p className="text-sm text-neutral-700 mb-4">{message}</p>}

        <button
          onClick={handleCheckStatus}
          disabled={checking}
          className="w-full py-2.5 rounded-lg font-semibold text-sm bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 mb-3">
          {checking ? "Checking..." : "Check Approval Status"}
        </button>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-lg font-semibold text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50">
          Logout
        </button>
      </div>
    </div>
  );
}
