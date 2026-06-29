import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { useDeliveryUser } from '../context/DeliveryUserContext';
import { getDeliveryProfile, updateProfile } from '../../../services/api/delivery/deliveryService';

export default function DeliveryProfile() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const { userName, setUserName } = useDeliveryUser();

  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    pincode: '',
    city: '',
    dateOfBirth: '',
    vehicleNumber: '',
    vehicleType: 'Bike',
    joinDate: '',
    totalDeliveries: 0,
    rating: 0,
    accountName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getDeliveryProfile();
        setProfileData({
          name: data.name || '',
          phone: data.mobile || '',
          email: data.email || '',
          address: data.address || '',
          pincode: data.pincode || '',
          city: data.city || '',
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
          vehicleNumber: data.vehicleNumber || '',
          vehicleType: data.vehicleType || 'Bike',
          joinDate: new Date(data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          totalDeliveries: data.totalDeliveredCount || 0, // Assuming backend sends this or we need to fetch dashboard stats
          rating: 4.8, // Mock for now
          accountName: data.accountName || '',
          bankName: data.bankName || '',
          accountNumber: data.accountNumber || '',
          ifscCode: data.ifscCode || '',
        });
        setUserName(data.name);
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };
    fetchProfile();
  }, [setUserName]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Re-fetch or reset to previous state
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        name: profileData.name,
        email: profileData.email,
        address: profileData.address,
        pincode: profileData.pincode,
        city: profileData.city,
        dateOfBirth: profileData.dateOfBirth,
        vehicleNumber: profileData.vehicleNumber,
        vehicleType: profileData.vehicleType,
        accountName: profileData.accountName,
        bankName: profileData.bankName,
        accountNumber: profileData.accountNumber,
        ifscCode: profileData.ifscCode,
      });
      setUserName(profileData.name);
      setIsEditing(false);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Failed to update profile");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    let newValue = value;
    let errorMsg = '';

    switch (field) {
      case "phone":
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
      case "vehicleNumber":
        newValue = value.toUpperCase();
        if (/[^A-Z0-9\s-]/g.test(newValue)) {
          errorMsg = "Vehicle number can only contain letters, numbers, spaces, and hyphens";
        }
        newValue = newValue.replace(/[^A-Z0-9\s-]/g, "");
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

    setProfileData((prev) => ({
      ...prev,
      [field]: newValue,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [field]: errorMsg,
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors"
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
          <h2 className="text-neutral-900 text-xl font-semibold">Profile</h2>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200 mb-4">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-4">
              <span className="text-white text-3xl font-bold">
                {profileData.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full text-center text-neutral-900 text-xl font-semibold mb-2 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.name
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-red-500 text-center mb-2">{fieldErrors.name}</p>
                  )}
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full text-center text-neutral-600 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.phone
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-red-500 text-center mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
            ) : (
              <>
                <h3 className="text-neutral-900 text-xl font-semibold mb-1">{profileData.name}</h3>
                <p className="text-neutral-600 text-sm">{profileData.phone}</p>
              </>
            )}
            <div className="flex items-center gap-1 mt-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  fill="#22c55e"
                />
              </svg>
              <span className="text-neutral-900 font-semibold">{profileData.rating}</span>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">Personal Information</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Email</p>
              {isEditing ? (
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full text-neutral-900 text-sm px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.email}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Date of Birth</p>
              {isEditing ? (
                <div>
                  <input
                    type="date"
                    value={profileData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.dateOfBirth
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.dateOfBirth && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.dateOfBirth}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Address</p>
              {isEditing ? (
                <div>
                  <textarea
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={2}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                      fieldErrors.address
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.address && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.address}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">City</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.city
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.city && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.city}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Pincode</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.pincode
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.pincode && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.pincode}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.pincode}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Vehicle Number</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.vehicleNumber}
                    onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.vehicleNumber
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.vehicleNumber && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.vehicleNumber}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.vehicleNumber}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Vehicle Type</p>
              {isEditing ? (
                <select
                  value={profileData.vehicleType}
                  onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                  className="w-full text-neutral-900 text-sm px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Bike">Bike</option>
                  <option value="Scooter">Scooter</option>
                  <option value="Car">Car</option>
                  <option value="Cycle">Cycle</option>
                </select>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.vehicleType}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bank Information */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden mt-4">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">Bank Information</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Account Name</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.accountName}
                    onChange={(e) => handleInputChange('accountName', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.accountName
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.accountName && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.accountName}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.accountName || "Not provided"}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Bank Name</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.bankName
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.bankName && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.bankName}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.bankName || "Not provided"}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">Account Number</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.accountNumber
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.accountNumber && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.accountNumber}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.accountNumber || "Not provided"}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-neutral-500 text-xs mb-1">IFSC Code</p>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={profileData.ifscCode}
                    onChange={(e) => handleInputChange('ifscCode', e.target.value)}
                    className={`w-full text-neutral-900 text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      fieldErrors.ifscCode
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : "border-neutral-300 focus:ring-orange-500"
                    }`}
                  />
                  {fieldErrors.ifscCode && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.ifscCode}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 text-sm">{profileData.ifscCode || "Not provided"}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 mt-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">Total Deliveries</p>
              <p className="text-neutral-900 text-2xl font-bold">{profileData.totalDeliveries}</p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">Joined On</p>
              <p className="text-neutral-900 text-sm font-semibold">{profileData.joinDate}</p>
            </div>
          </div>
        </div>

        {/* Edit/Save/Cancel Buttons */}
        {isEditing ? (
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCancel}
              className="flex-1 bg-neutral-200 text-neutral-900 rounded-xl py-3 font-semibold hover:bg-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-orange-500 text-white rounded-xl py-3 font-semibold hover:bg-orange-600 transition-colors"
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            <button
              onClick={handleEdit}
              className="w-full bg-orange-500 text-white rounded-xl py-3 font-semibold hover:bg-orange-600 transition-colors"
            >
              Edit Profile
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/privacy-policy")}
                className="bg-white py-3 px-4 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:border-orange-500 transition-colors text-center"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => navigate("/terms")}
                className="bg-white py-3 px-4 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:border-orange-500 transition-colors text-center"
              >
                Terms & Conditions
              </button>
            </div>
          </div>
        )}
      </div>
      <DeliveryBottomNav />
    </div>
  );
}

