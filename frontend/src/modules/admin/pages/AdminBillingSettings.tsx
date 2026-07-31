import { useState, useEffect } from 'react';
import { useToast } from '../../../context/ToastContext';
import { getAppSettings, updateAppSettings, AppSettings } from '../../../services/api/admin/adminSettingsService';
import { motion } from 'framer-motion';

export default function AdminBillingSettings() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    // Form State
    const [platformFee, setPlatformFee] = useState<number>(0);
    const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(0);
    const [deliveryCharges, setDeliveryCharges] = useState<number>(0);

    // Distance Based Config
    const [isDistanceBased, setIsDistanceBased] = useState(false);
    const [baseCharge, setBaseCharge] = useState<number>(0);
    const [baseDistance, setBaseDistance] = useState<number>(0);
    const [kmRate, setKmRate] = useState<number>(0);
    const [deliveryBoyKmRate, setDeliveryBoyKmRate] = useState<number>(0);
    const [googleMapsKey, setGoogleMapsKey] = useState<string>('');

    // Dynamic Rider Earning Config
    const [riderBasePay, setRiderBasePay] = useState(30);
    const [riderPerKmRate, setRiderPerKmRate] = useState(8);
    const [riderMinimumEarning, setRiderMinimumEarning] = useState(40);
    const [riderPeakBonus, setRiderPeakBonus] = useState(0);
    const [isPeakModeActive, setIsPeakModeActive] = useState(false);
    const [riderRainBonus, setRiderRainBonus] = useState(0);
    const [isRainModeActive, setIsRainModeActive] = useState(false);
    const [riderHeavyItemBonus, setRiderHeavyItemBonus] = useState(0);
    const [riderHeavyItemThreshold, setRiderHeavyItemThreshold] = useState(5);

    // Support Info Config
    const [supportEmail, setSupportEmail] = useState<string>('');
    const [supportPhone, setSupportPhone] = useState<string>('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await getAppSettings();
            if (response && response.success && response.data) {
                const data = response.data;
                setSettings(data);

                // Initialize State
                setPlatformFee(data.platformFee || 0);
                setFreeDeliveryThreshold(data.freeDeliveryThreshold || 0);
                setDeliveryCharges(data.deliveryCharges || 0);
                setSupportEmail(data.supportEmail || '');
                setSupportPhone(data.supportPhone || '');

                if (data.deliveryConfig) {
                    setIsDistanceBased(data.deliveryConfig.isDistanceBased || false);
                    setBaseCharge(data.deliveryConfig.baseCharge || 0);
                    setBaseDistance(data.deliveryConfig.baseDistance || 0);
                    setKmRate(data.deliveryConfig.kmRate || 0);
                    setDeliveryBoyKmRate(data.deliveryConfig.deliveryBoyKmRate || 0);
                    setGoogleMapsKey(data.deliveryConfig.googleMapsKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
                    // If no config exists, try to pre-fill from env
                    setGoogleMapsKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
                }

                if (data.riderEarningConfig) {
                    setRiderBasePay(data.riderEarningConfig.basePay ?? 30);
                    setRiderPerKmRate(data.riderEarningConfig.perKmRate ?? 8);
                    setRiderMinimumEarning(data.riderEarningConfig.minimumEarning ?? 40);
                    setRiderPeakBonus(data.riderEarningConfig.peakBonus ?? 0);
                    setIsPeakModeActive(data.riderEarningConfig.isPeakModeActive ?? false);
                    setRiderRainBonus(data.riderEarningConfig.rainBonus ?? 0);
                    setIsRainModeActive(data.riderEarningConfig.isRainModeActive ?? false);
                    setRiderHeavyItemBonus(data.riderEarningConfig.heavyItemBonus ?? 0);
                    setRiderHeavyItemThreshold(data.riderEarningConfig.heavyItemWeightThreshold ?? 5);
                }
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Failed to fetch settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const updatePayload: any = {
                platformFee,
                freeDeliveryThreshold,
                deliveryCharges,
                supportEmail,
                supportPhone,
                deliveryConfig: {
                    isDistanceBased,
                    baseCharge,
                    baseDistance,
                    kmRate,
                    deliveryBoyKmRate,
                    googleMapsKey
                },
                riderEarningConfig: {
                    basePay: riderBasePay,
                    perKmRate: riderPerKmRate,
                    minimumEarning: riderMinimumEarning,
                    peakBonus: riderPeakBonus,
                    isPeakModeActive,
                    rainBonus: riderRainBonus,
                    isRainModeActive,
                    heavyItemBonus: riderHeavyItemBonus,
                    heavyItemWeightThreshold: riderHeavyItemThreshold
                }
            };

            const response = await updateAppSettings(updatePayload);
            if (response.success) {
                showToast('Billing settings updated successfully');
                setSettings(response.data);
            } else {
                showToast('Failed to update settings', 'error');
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.response?.data?.message || 'Error updating settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Billing & Charges</h1>
          </div>
                    <p className="text-sm text-gray-500">Manage delivery fees, platform charges, and thresholds.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </button>
            </div>

            <div className="space-y-6">
                {/* General Billing Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">General Charges</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Platform/Handling Fee (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={platformFee}
                                    onChange={(e) => setPlatformFee(Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 2"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Added to every order as handling charge.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Free Delivery Threshold (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={freeDeliveryThreshold}
                                    onChange={(e) => setFreeDeliveryThreshold(Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 499"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Orders above this amount will have free delivery.</p>
                        </div>
                    </div>
                </div>

                {/* Delivery Configuration Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <div className="flex justify-between items-start mb-6 pb-2 border-b">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Customer Delivery Fee Configuration</h2>
                            <p className="text-sm text-gray-500">Configure how much the customer will be charged for delivery</p>
                        </div>

                        <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
                            <button
                                onClick={() => setIsDistanceBased(false)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${!isDistanceBased ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Fixed Price
                            </button>
                            <button
                                onClick={() => setIsDistanceBased(true)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${isDistanceBased ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Distance Based
                            </button>
                        </div>
                    </div>

                    {!isDistanceBased ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="max-w-md"
                        >
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fixed Delivery Charge (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={deliveryCharges}
                                    onChange={(e) => setDeliveryCharges(Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="e.g. 40"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Flat fee charged for all deliveries below threshold.</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
                        >
                            <div className="col-span-full bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 mb-2">
                                <strong>Note:</strong> Distance calculation requires Google Maps API Key. Without a key, it may fallback to straight line distance.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Base Charge (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={baseCharge}
                                        onChange={(e) => setBaseCharge(Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Min charge for first X kms.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Base Distance (km)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={baseDistance}
                                        onChange={(e) => setBaseDistance(Number(e.target.value))}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">km</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Distance covered in base charge.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Extra per km Charge (₹)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={kmRate}
                                        onChange={(e) => setKmRate(Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Charged for every km after base distance.</p>
                            </div>

                            {/* Removed deprecated Delivery Boy Commission field from here */}

                            <div className="col-span-full">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Google Maps API Key (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={googleMapsKey}
                                    onChange={(e) => setGoogleMapsKey(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                    placeholder="AIza..."
                                />
                                <p className="mt-1 text-xs text-gray-500">Required for accurate road distance calculation.</p>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Rider Earning Configuration Section */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <div className="flex justify-between items-start mb-6 pb-2 border-b">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Rider Earning Configuration</h2>
                            <p className="text-sm text-gray-500">Dynamic earning formula for delivery boys</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Base Pay (₹)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={riderBasePay}
                                onChange={(e) => setRiderBasePay(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Per KM Rate (₹)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={riderPerKmRate}
                                onChange={(e) => setRiderPerKmRate(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Minimum Earning (₹)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={riderMinimumEarning}
                                onChange={(e) => setRiderMinimumEarning(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                            <div className="flex justify-between items-center mb-4">
                                <label className="font-medium text-orange-900">Peak Hours Bonus</label>
                                <button
                                    onClick={() => setIsPeakModeActive(!isPeakModeActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPeakModeActive ? 'bg-orange-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPeakModeActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={riderPeakBonus}
                                    onChange={(e) => setRiderPeakBonus(Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex justify-between items-center mb-4">
                                <label className="font-medium text-blue-900">Rain Mode Bonus</label>
                                <button
                                    onClick={() => setIsRainModeActive(!isRainModeActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRainModeActive ? 'bg-blue-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isRainModeActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={riderRainBonus}
                                    onChange={(e) => setRiderRainBonus(Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 col-span-full md:col-span-1">
                            <div className="flex justify-between items-center mb-4">
                                <label className="font-medium text-purple-900">Heavy Item Bonus</label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-purple-700 mb-1">Bonus Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">+₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={riderHeavyItemBonus}
                                            onChange={(e) => setRiderHeavyItemBonus(Number(e.target.value))}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-purple-700 mb-1">Threshold (kg)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            value={riderHeavyItemThreshold}
                                            onChange={(e) => setRiderHeavyItemThreshold(Number(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support Contact Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">Support Contacts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Support Email
                            </label>
                            <input
                                type="email"
                                value={supportEmail}
                                onChange={(e) => setSupportEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                placeholder="e.g. support@speedoo.com"
                            />
                            <p className="mt-1 text-xs text-gray-500">This email will be shown to users on the Support page.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Support Phone Number
                            </label>
                            <input
                                type="text"
                                value={supportPhone}
                                onChange={(e) => setSupportPhone(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                                placeholder="e.g. +91 9999999999"
                            />
                            <p className="mt-1 text-xs text-gray-500">This phone number will be shown to users on the Support page.</p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
