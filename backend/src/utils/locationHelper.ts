import mongoose from "mongoose";
import Seller from "../models/Seller";

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find sellers whose service radius covers the user's location
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @returns Array of seller IDs within range
 */
export async function findSellersWithinRange(
  userLat: number,
  userLng: number
): Promise<mongoose.Types.ObjectId[]> {
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    return [];
  }

  // Validate coordinates
  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    return [];
  }

  try {
    // Fetch all approved sellers with location
    const sellers = await Seller.find({
      status: "Approved",
    }).select("_id location serviceRadiusKm latitude longitude").lean();

    // Filter sellers where user is within their service radius
    const nearbySellerIds: mongoose.Types.ObjectId[] = [];

    for (const seller of sellers) {
      let sellerLat: number | null = null;
      let sellerLng: number | null = null;

      // Try GeoJSON first
      if (seller.location && seller.location.coordinates && seller.location.coordinates.length === 2) {
        sellerLng = seller.location.coordinates[0];
        sellerLat = seller.location.coordinates[1];
      }
      // Fallback to string fields if GeoJSON missing
      else if (seller.latitude && seller.longitude) {
         sellerLat = parseFloat(seller.latitude);
         sellerLng = parseFloat(seller.longitude);
      }

      if (sellerLat !== null && sellerLng !== null && !isNaN(sellerLat) && !isNaN(sellerLng)) {
        const distance = calculateDistance(
          userLat,
          userLng,
          sellerLat,
          sellerLng
        );
        const serviceRadius = seller.serviceRadiusKm || 10; // Default to 10km if not set

        if (distance <= serviceRadius) {
          nearbySellerIds.push(seller._id as mongoose.Types.ObjectId);
        }
      }
    }

    return nearbySellerIds;
  } catch (error) {
    console.error("Error finding nearby sellers:", error);
    return [];
  }
}

/**
 * Calculate estimated delivery time based on distance.
 * @param distanceKm Distance in kilometers
 * @returns Formatted time range string (e.g., "15-20 mins")
 */
export function calculateEstimatedDeliveryTime(distanceKm: number): string {
  const basePrepTime = 5; // 5 mins prep
  const timePerKm = 4; // 4 mins per km
  
  let totalTime = basePrepTime + Math.ceil(distanceKm * timePerKm);
  if (totalTime > 35) totalTime = 35; // Cap at 35 mins
  
  const minTime = Math.max(10, totalTime - 5);
  const maxTime = Math.max(15, totalTime);
  
  return `${minTime}-${maxTime} mins`;
}

/**
 * Find the nearest seller and their estimated delivery time.
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @returns Object with nearestSellerId, distance, and estimatedDeliveryTime
 */
export async function getNearestSellerInfo(
  userLat: number,
  userLng: number
): Promise<{ nearestSellerId: string | null; distance: number | null; estimatedDeliveryTime: string }> {
  const defaultETA = "12-15 mins";
  
  if (userLat === null || userLng === null || isNaN(userLat) || isNaN(userLng)) {
    return { nearestSellerId: null, distance: null, estimatedDeliveryTime: defaultETA };
  }

  if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    return { nearestSellerId: null, distance: null, estimatedDeliveryTime: defaultETA };
  }

  try {
    const sellers = await Seller.find({ status: "Approved" })
      .select("_id location serviceRadiusKm latitude longitude").lean();

    let minDistance = Infinity;
    let nearestSellerId: string | null = null;

    for (const seller of sellers) {
      let sellerLat: number | null = null;
      let sellerLng: number | null = null;

      if (seller.location && seller.location.coordinates && seller.location.coordinates.length === 2) {
        sellerLng = seller.location.coordinates[0];
        sellerLat = seller.location.coordinates[1];
      } else if (seller.latitude && seller.longitude) {
         sellerLat = parseFloat(seller.latitude);
         sellerLng = parseFloat(seller.longitude);
      }

      if (sellerLat !== null && sellerLng !== null && !isNaN(sellerLat) && !isNaN(sellerLng)) {
        const distance = calculateDistance(userLat, userLng, sellerLat, sellerLng);
        const serviceRadius = seller.serviceRadiusKm || 10;

        if (distance <= serviceRadius && distance < minDistance) {
          minDistance = distance;
          nearestSellerId = seller._id.toString();
        }
      }
    }

    if (nearestSellerId && minDistance !== Infinity) {
      return {
        nearestSellerId,
        distance: minDistance,
        estimatedDeliveryTime: calculateEstimatedDeliveryTime(minDistance)
      };
    }

    return { nearestSellerId: null, distance: null, estimatedDeliveryTime: defaultETA };
  } catch (error) {
    console.error("Error finding nearest seller info:", error);
    return { nearestSellerId: null, distance: null, estimatedDeliveryTime: defaultETA };
  }
}
