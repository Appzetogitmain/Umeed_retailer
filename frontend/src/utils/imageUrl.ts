import { getSocketBaseURL } from "../services/api/config";

/**
 * Normalizes image URLs, specifically fixing local fallback uploads (http://localhost:5000) 
 * when the frontend is deployed to a live environment pointing to a live backend.
 */
export const normalizeImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  
  // Check if the URL is a local fallback URL from the backend
  if (url.startsWith('http://localhost:5000/')) {
    const backendBaseUrl = getSocketBaseURL();
    
    // Only replace if the actual backend URL is not localhost (i.e. live environment)
    if (!backendBaseUrl.includes('localhost')) {
      return url.replace('http://localhost:5000', backendBaseUrl);
    }
  }
  
  return url;
};
