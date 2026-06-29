import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  register,
  sendOTP,
  verifyOTP,
} from "../../../services/api/auth/deliveryAuthService";
import { uploadDocument } from "../../../services/api/uploadService";
import { validateDocumentFile } from "../../../utils/imageUpload";
import OTPInput from "../../../components/OTPInput";
import { useAuth } from "../../../context/AuthContext";
import speedooLogo from "@assets/Speedoo_logo.png";

export default function DeliverySignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    dateOfBirth: "",
    address: "",
    city: "",
    pincode: "",
    drivingLicenseUrl: "",
    nationalIdentityCardUrl: "",
    accountName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    bonusType: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // File state for UI
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(
    null
  );
  const [nationalIdentityCardFile, setNationalIdentityCardFile] =
    useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCityLoading, setIsCityLoading] = useState(false);

  const bonusTypes = [
    "Select Bonus Type",
    "Fixed or Salaried",
    "Fixed",
    "Salaried",
    "Commission Based",
  ];

  const validateAge = (dob: string) => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let newValue = value;
    let errorMsg = "";

    switch (name) {
      case "mobile":
        newValue = value.replace(/\D/g, "").slice(0, 10);
        if (value && !/^\d*$/.test(value)) {
          errorMsg = "Mobile number can only contain numbers";
        }
        break;
      case "name":
      case "accountName":
      case "bankName":
        if (/[^a-zA-Z\s]/.test(value)) {
          errorMsg = "Only alphabetic characters are allowed";
        }
        newValue = value.replace(/[^a-zA-Z\s]/g, "");
        break;
      case "city":
        if (/[0-9]/.test(value)) {
          errorMsg = "City name cannot contain numbers";
        }
        newValue = value.replace(/[0-9]/g, "");
        break;
      case "accountNumber":
        if (/[^0-9]/.test(value)) {
          errorMsg = "Account number can only contain numbers";
        }
        newValue = value.replace(/[^0-9]/g, "");
        break;
      case "ifscCode":
        newValue = value.toUpperCase();
        if (newValue && !/^[A-Z]{0,4}0?[A-Z0-9]{0,6}$/.test(newValue)) {
          errorMsg = "Invalid IFSC Code format";
        }
        break;
      case "pincode":
        if (/[^0-9]/.test(value)) {
          errorMsg = "Pincode can only contain numbers";
        }
        newValue = value.replace(/[^0-9]/g, "").slice(0, 6);
        break;
      case "address":
        if (/[^a-zA-Z0-9\s,.\-/#]/.test(value)) {
          errorMsg = "Address contains invalid special characters";
        }
        newValue = value.replace(/[^a-zA-Z0-9\s,.\-/#]/g, "");
        break;
      case "dateOfBirth":
        newValue = value;
        if (newValue && !validateAge(newValue)) {
          errorMsg = "You must be at least 18 years old";
        }
        break;
      default:
        newValue = value;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [name]: errorMsg,
    }));
  };

  const fetchCityFromLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsCityLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY
            }`
          );
          const data = await response.json();
          if (data.status === "OK") {
            const addressComponents = data.results[0].address_components;
            const cityComponent = addressComponents.find(
              (c: any) =>
                c.types.includes("locality") ||
                c.types.includes("administrative_area_level_2")
            );
            if (cityComponent) {
              setFormData((prev) => ({
                ...prev,
                city: cityComponent.long_name,
              }));
            }
          } else {
            setError("Could not fetch city from your location");
          }
        } catch (err) {
          setError("Failed to fetch city details");
        } finally {
          setIsCityLoading(false);
        }
      },
      (err) => {
        setError("Location access denied. Please type your city manually.");
        setIsCityLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (!files || !files[0]) return;

    const file = files[0];
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid document file");
      return;
    }

    if (name === "drivingLicense") {
      setDrivingLicenseFile(file);
    } else if (name === "nationalIdentityCard") {
      setNationalIdentityCardFile(file);
    }
    setError("");
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.name ||
      !formData.mobile ||
      !formData.email ||
      !formData.address ||
      !formData.city
    ) {
      setError("Please fill all required fields");
      return;
    }

    if (formData.mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!formData.dateOfBirth) {
      setError("Please enter your Date of Birth");
      return;
    }

    if (!validateAge(formData.dateOfBirth)) {
      setError("You must be at least 18 years old to register as a rider.");
      return;
    }

    // Make documents mandatory
    if (!drivingLicenseFile) {
      setError("Driving License is mandatory.");
      return;
    }

    if (!nationalIdentityCardFile) {
      setError("National Identity Card is mandatory.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload documents
      let drivingLicenseUrl = "";
      let nationalIdentityCardUrl = "";

      setUploadingDocs(true);

      const drivingLicenseResult = await uploadDocument(
        drivingLicenseFile,
        "Speedoo/delivery/documents"
      );
      drivingLicenseUrl = drivingLicenseResult.secureUrl;

      const nationalIdResult = await uploadDocument(
        nationalIdentityCardFile,
        "Speedoo/delivery/documents"
      );
      nationalIdentityCardUrl = nationalIdResult.secureUrl;

      setUploadingDocs(false);

      const response = await register({
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth || undefined,
        password: "DefaultPassword123", // Send a default password as it's optional in backend but good to have a placeholder
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode || undefined,
        drivingLicense: drivingLicenseUrl,
        nationalIdentityCard: nationalIdentityCardUrl,
        accountName: formData.accountName || undefined,
        bankName: formData.bankName || undefined,
        accountNumber: formData.accountNumber || undefined,
        ifscCode: formData.ifscCode || undefined,
        bonusType: formData.bonusType || undefined,
      });

      if (response.success && response.data && response.data.user) {
        // Automatic Login after registration
        login(response.data.token || "", {
          id: response.data.user.id,
          name: response.data.user.name,
          mobile: response.data.user.mobile,
          email: response.data.user.email,
          city: response.data.user.city,
          status: response.data.user.status,
          userType: "Delivery",
        });

        // Navigate to delivery dashboard
        navigate("/delivery");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
      setUploadingDocs(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(formData.mobile, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context
        login(response.data.token, {
          ...response.data.user,
          userType: "Delivery",
        });

        // FCM token registration is handled globally by App.tsx when auth state changes
        // No need to call registerFCMToken here - it would cause duplicate notifications

        navigate("/delivery");
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-purple-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-neutral-50 transition-colors"
        aria-label="Back">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path
            d="M15 18L9 12L15 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "black" }}
          />
        </svg>
      </button>

      {/* Sign Up Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header Section */}
        <div
          className="px-6 py-6 text-center border-b border-orange-500"
          style={{
            backgroundColor: "#FFC107",
          }}>
          <div className="mb-4">
            <img
              src={speedooLogo}
              alt="Speedoo"
              className="h-32 w-full max-w-xs mx-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Delivery Sign Up
          </h1>
          <p className="text-purple-900 font-bold text-sm tracking-wide">
            Create your delivery partner account
          </p>
        </div>

        {/* Sign Up Form */}
        <div
          className="p-6 space-y-4 delivery-signup-form"
          style={{
            maxHeight: "70vh",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
          <style>{`
            .delivery-signup-form::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {!showOTP ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">
                  Personal Information
                </h3>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.name
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200">
                    <div className="px-3 py-2.5 text-sm font-medium text-neutral-600 border-r border-neutral-300 bg-neutral-50">
                      +91
                    </div>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      placeholder="Enter mobile number"
                      required
                      maxLength={10}
                      className="flex-1 px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                  {fieldErrors.mobile && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.dateOfBirth
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {fieldErrors.dateOfBirth && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your address"
                    required
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.address
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.address && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Enter your city"
                      required
                      className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 pr-10 ${
                        fieldErrors.city
                          ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                          : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                      }`}
                      disabled={loading || isCityLoading}
                    />
                    <button
                      type="button"
                      onClick={fetchCityFromLocation}
                      disabled={isCityLoading || loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-600 hover:bg-teal-50 rounded-md transition-colors disabled:text-neutral-400"
                      title="Fetch current location">
                      {isCityLoading ? (
                        <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldErrors.city && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    placeholder="Enter pincode"
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.pincode
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.pincode && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.pincode}</p>
                  )}
                </div>
              </div>

              {/* Bank Information */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">
                  Bank Account Information (Optional)
                </h3>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    name="accountName"
                    value={formData.accountName}
                    onChange={handleInputChange}
                    placeholder="Account holder name"
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.accountName
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.accountName && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.accountName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    placeholder="Bank name"
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.bankName
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.bankName && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.bankName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleInputChange}
                    placeholder="Account number"
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.accountNumber
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.accountNumber && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.accountNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleInputChange}
                    placeholder="IFSC code"
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.ifscCode
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:border-purple-500 focus:ring-purple-200"
                    }`}
                    disabled={loading}
                  />
                  {fieldErrors.ifscCode && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.ifscCode}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Bonus Type
                  </label>
                  <select
                    name="bonusType"
                    value={formData.bonusType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    disabled={loading}>
                    {bonusTypes.map((type) => (
                      <option
                        key={type}
                        value={type === "Select Bonus Type" ? "" : type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Documents Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">
                  Documents <span className="text-red-500">*</span>
                </h3>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Driving License <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      name="drivingLicense"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      disabled={loading || uploadingDocs}
                    />
                    {drivingLicenseFile && (
                      <p className="text-xs text-neutral-600">
                        {drivingLicenseFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    National Identity Card <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      name="nationalIdentityCard"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      disabled={loading || uploadingDocs}
                    />
                    {nationalIdentityCardFile && (
                      <p className="text-xs text-neutral-600">
                        {nationalIdentityCardFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || uploadingDocs}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${!loading && !uploadingDocs
                  ? "bg-purple-600 text-white hover:bg-purple-700 shadow-md"
                  : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                  }`}>
                {uploadingDocs
                  ? "Uploading Documents..."
                  : loading
                    ? "Creating Account..."
                    : "Sign Up"}
              </button>

              {/* Login Link */}
              <div className="text-center pt-2 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  Already have a delivery partner account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/delivery/login")}
                    className="text-purple-600 hover:text-purple-700 font-semibold">
                    Login
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* OTP Verification Form */
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-neutral-600 mb-2">
                  Enter the 4-digit OTP sent via voice call to
                </p>
                <p className="text-sm font-semibold text-neutral-800">
                  +91 {formData.mobile}
                </p>
              </div>

              <OTPInput 
                onComplete={handleOTPComplete} 
                disabled={loading} 
                variant="light" 
              />

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300">
                  Back
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError("");
                    try {
                      const res = await sendOTP(formData.mobile);
                      if (res.sessionId) setSessionId(res.sessionId);
                    } catch (err: any) {
                      setError(err.message || "Failed to resend OTP.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                  {loading ? "Calling..." : "Resend OTP"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Text */}
      <p className="mt-6 text-xs text-neutral-500 text-center max-w-md">
        By continuing, you agree to Speedoo's{" "}
        <Link 
          to="/delivery/terms-and-conditions" 
          className="text-purple-600 hover:underline font-bold"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link 
          to="/delivery/privacy-policy" 
          className="text-purple-600 hover:underline font-bold"
        >
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
