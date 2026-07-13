import { Request, Response } from "express";
import Seller from "../../../models/Seller";
import {
  sendOTP as sendOTPService,
  verifyOTP as verifyOTPService,
} from "../../../services/otpService";
import { generateToken } from "../../../services/jwtService";
import { asyncHandler } from "../../../utils/asyncHandler";
import bcrypt from "bcrypt";

/**
 * Send OTP to seller mobile number
 */
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const { mobile } = req.body;
  if (!mobile) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  // Clean the mobile number
  let cleanMobile = mobile.replace(/\D/g, "").replace(/^0+/, "");
  if (cleanMobile.length === 12 && cleanMobile.startsWith("91")) {
    cleanMobile = cleanMobile.slice(2);
  }

  if (cleanMobile.length !== 10) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  const normalizedMobile = cleanMobile;

  // Check if seller exists with this mobile
  const seller = await Seller.findOne({ mobile: normalizedMobile });
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found with this mobile number",
    });
  }

  // Send OTP - for login, always use default OTP
  const result = await sendOTPService(normalizedMobile, "Seller", true);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Verify OTP and login seller
 */
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, otp } = req.body;
  if (!mobile) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  // Clean the mobile number
  let cleanMobile = mobile.replace(/\D/g, "").replace(/^0+/, "");
  if (cleanMobile.length === 12 && cleanMobile.startsWith("91")) {
    cleanMobile = cleanMobile.slice(2);
  }

  if (cleanMobile.length !== 10) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  const normalizedMobile = cleanMobile;

  if (!otp || !/^[0-9]{4}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "Valid 4-digit OTP is required",
    });
  }

  // Verify OTP
  const isValid = await verifyOTPService(normalizedMobile, otp, "Seller");
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  // Find seller
  const seller = await Seller.findOne({ mobile: normalizedMobile }).select("-password");
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found",
    });
  }

  // Generate JWT token
  const token = generateToken(seller._id.toString(), "Seller");

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: seller._id,
        userType: "Seller",
        sellerName: seller.sellerName,
        mobile: seller.mobile,
        email: seller.email,
        storeName: seller.storeName,
        status: seller.status,
        logo: seller.logo,
        address: seller.address,
        city: seller.city,
      },
    },
  });
});

/**
 * Register new seller
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    sellerName,
    mobile,
    email,
    storeName,
    category,
    address,
    city,
    serviceableArea,
  } = req.body;

  // Validation (password removed - sellers don't need password during signup)
  if (
    !sellerName ||
    !mobile ||
    !email ||
    !storeName ||
    !category
  ) {
    return res.status(400).json({
      success: false,
      message: "Required fields (Name, Mobile, Email, Store Name, Category) must be provided",
    });
  }

  // Clean the mobile number
  let cleanMobile = mobile.replace(/\D/g, "").replace(/^0+/, "");
  if (cleanMobile.length === 12 && cleanMobile.startsWith("91")) {
    cleanMobile = cleanMobile.slice(2);
  }

  if (cleanMobile.length !== 10) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  const normalizedMobile = cleanMobile;

  // Validate location is provided
  const latitude = req.body.latitude ? parseFloat(req.body.latitude) : null;
  const longitude = req.body.longitude ? parseFloat(req.body.longitude) : null;

  // Parse and validate service radius
  let serviceRadiusKm = 10; // Default 10km
  if (req.body.serviceRadiusKm !== undefined && req.body.serviceRadiusKm !== null && req.body.serviceRadiusKm !== '') {
    const parsedRadius = typeof req.body.serviceRadiusKm === 'string'
      ? parseFloat(req.body.serviceRadiusKm)
      : Number(req.body.serviceRadiusKm);

    if (!isNaN(parsedRadius) && parsedRadius >= 0.1 && parsedRadius <= 100) {
      serviceRadiusKm = parsedRadius;
    } else {
      return res.status(400).json({
        success: false,
        message: "Service radius must be between 0.1 and 100 kilometers",
      });
    }
  }

  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    // Location is optional now to allow dynamic setting later
    // Just proceed without setting location if not provided
  }

  // Validate latitude and longitude ranges if provided
  if (latitude && longitude && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    return res.status(400).json({
      success: false,
      message: "Invalid location coordinates",
    });
  }

  // Check if seller already exists
  const existingSeller = await Seller.findOne({
    $or: [{ mobile: normalizedMobile }, { email }],
  });

  if (existingSeller) {
    return res.status(409).json({
      success: false,
      message: "Seller already exists with this mobile or email",
    });
  }

  // Create GeoJSON location point [longitude, latitude] if provided
  const location = (longitude && latitude) ? {
    type: 'Point' as const,
    coordinates: [longitude, latitude],
  } : undefined;

  // Create new seller with GeoJSON location (password not required during signup)
  const seller = await Seller.create({
    sellerName,
    mobile: normalizedMobile,
    email,
    // password field removed - sellers don't need password during signup
    storeName,
    category,
    address,
    city,
    ...(serviceableArea && { serviceableArea }),
    searchLocation: req.body.searchLocation,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    location, // GeoJSON location for geospatial queries
    serviceRadiusKm, // Service radius in kilometers
    status: "Pending",
    requireProductApproval: false,
    viewCustomerDetails: false,
    commission: 0,
    balance: 0,
    categories: req.body.categories || [],
  });

  // Generate token
  const token = generateToken(seller._id.toString(), "Seller");

  return res.status(201).json({
    success: true,
    message: "Seller registered successfully. Awaiting admin approval.",
    data: {
      token,
      user: {
        id: seller._id,
        userType: "Seller",
        sellerName: seller.sellerName,
        mobile: seller.mobile,
        email: seller.email,
        storeName: seller.storeName,
        status: seller.status,
        address: seller.address,
        city: seller.city,
      },
    },
  });
});

/**
 * Get seller's profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;

  const seller = await Seller.findById(sellerId).select("-password");
  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: seller,
  });
});

/**
 * Update seller's profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const updates = req.body;

  const restrictedFields = ["password", "mobile", "status", "balance"];
  restrictedFields.forEach((field) => delete updates[field]);

  // Validate Name (No numbers, max 50 chars)
  if (updates.sellerName) {
    if (!/^[A-Za-z\s]+$/.test(updates.sellerName)) {
      return res.status(400).json({ success: false, message: "Name can only contain letters and spaces" });
    }
    if (updates.sellerName.length > 50) {
      return res.status(400).json({ success: false, message: "Name cannot exceed 50 characters" });
    }
  }

  // Handle email update and uniqueness
  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(updates.email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    const existing = await Seller.findOne({ email: updates.email, _id: { $ne: sellerId } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email is already in use by another account" });
    }
  }

  // Handle Tax Validations
  if (updates.panCard && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(updates.panCard)) {
    return res.status(400).json({ success: false, message: "Invalid PAN format" });
  }
  if (updates.taxNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(updates.taxNumber)) {
    return res.status(400).json({ success: false, message: "Invalid GST format" });
  }

  // Handle Bank Detail Validations and Hashing
  if (updates.accountNumber || updates.ifsc || updates.accountName || updates.bankName || updates.branch) {
    // If they provided any bank details, they must provide the core ones to hash
    if (!updates.accountNumber || !updates.ifsc || !updates.bankName) {
      return res.status(400).json({ success: false, message: "Account Number, Bank Name, and IFSC are required to update bank details" });
    }
    
    if (updates.accountName && !/^[A-Za-z\s]+$/.test(updates.accountName)) {
      return res.status(400).json({ success: false, message: "Account Holder Name can only contain letters and spaces" });
    }
    if (!/^\d{9,18}$/.test(updates.accountNumber)) {
      return res.status(400).json({ success: false, message: "Account Number must be between 9 and 18 digits" });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(updates.ifsc)) {
      return res.status(400).json({ success: false, message: "Invalid IFSC format" });
    }

    // Hash the account number
    const salt = await bcrypt.genSalt(10);
    updates.accountNumberHash = await bcrypt.hash(updates.accountNumber, salt);
    updates.accountNumberMasked = `****${updates.accountNumber.slice(-4)}`;
    
    // Explicitly delete the plaintext account number so it is NEVER saved to the DB
    updates.accountNumber = undefined;
  }

  // Handle location update (convert lat/lng to GeoJSON)
  if (updates.latitude && updates.longitude) {
    const latitude = parseFloat(updates.latitude);
    const longitude = parseFloat(updates.longitude);

    if (!isNaN(latitude) && !isNaN(longitude)) {
      // Update GeoJSON location for geospatial queries
      updates.location = {
        type: 'Point',
        coordinates: [longitude, latitude], // MongoDB GeoJSON: [longitude, latitude]
      };
      // Ensure string fields are also synchronized
      updates.latitude = latitude.toString();
      updates.longitude = longitude.toString();
    }
  }

  // Handle serviceRadiusKm update
  if (updates.serviceRadiusKm !== undefined && updates.serviceRadiusKm !== null && updates.serviceRadiusKm !== '') {
    const radius = typeof updates.serviceRadiusKm === 'string'
      ? parseFloat(updates.serviceRadiusKm)
      : Number(updates.serviceRadiusKm);

    if (!isNaN(radius) && radius >= 0.1 && radius <= 100) {
      updates.serviceRadiusKm = radius; // Ensure it's saved as a number
    } else {
      return res.status(400).json({
        success: false,
        message: "Service radius must be between 0.1 and 100 kilometers",
      });
    }
  } else if (updates.serviceRadiusKm === '' || updates.serviceRadiusKm === null) {
    // If empty string or null is sent, remove it from updates to keep existing value
    delete updates.serviceRadiusKm;
  }

  const seller = await Seller.findByIdAndUpdate(sellerId, updates, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!seller) {
    return res.status(404).json({
      success: false,
      message: "Seller not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: seller,
  });
});

/**
 * Toggle shop status (Open/Close)
 */
export const toggleShopStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;

    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // Handle undefined case - if isShopOpen is undefined, default to true (open) then toggle to false
    // This ensures backward compatibility with sellers created before this field was added
    if (seller.isShopOpen === undefined) {
      seller.isShopOpen = false; // Toggle from default "open" to "closed"
    } else {
      seller.isShopOpen = !seller.isShopOpen; // Normal toggle
    }

    // Fix invalid GeoJSON location objects
    // MongoDB requires that if location.type is "Point", coordinates must be a valid array
    if (seller.location && seller.location.type === 'Point') {
      if (!seller.location.coordinates || !Array.isArray(seller.location.coordinates) || seller.location.coordinates.length !== 2) {
        // Invalid location object - remove it to prevent validation error
        seller.location = undefined;
      }
    }

    await seller.save();

    return res.status(200).json({
      success: true,
      message: `Shop is now ${seller.isShopOpen ? "Open" : "Closed"}`,
      data: { isShopOpen: seller.isShopOpen },
    });
  }
);
