import { getSocketBaseURL } from "../services/api/config";

/**
 * Normalizes image URLs, specifically fixing local fallback uploads (http://localhost:5000) 
 * when the frontend is deployed to a live environment pointing to a live backend.
 */
export const normalizeImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  
  // Debug log
  console.log('[normalizeImageUrl] input url:', url);
  
  let processedUrl = url;

  // Check if the URL is a local fallback URL from the backend
  if (processedUrl.startsWith('http://localhost:5000/')) {
    const backendBaseUrl = getSocketBaseURL();
    console.log('[normalizeImageUrl] backendBaseUrl:', backendBaseUrl);
    
    // Only replace if the actual backend URL is not localhost (i.e. live environment)
    if (!backendBaseUrl.includes('localhost')) {
      processedUrl = processedUrl.replace('http://localhost:5000', backendBaseUrl);
      console.log('[normalizeImageUrl] replaced with:', processedUrl);
    }
  }
  
  // Fix for ERR_NAME_NOT_RESOLVED on api.umeedretailers.com
  if (processedUrl.includes('api.umeedretailers.com')) {
    processedUrl = processedUrl.replace('api.umeedretailers.com', 'app.umeedretailers.com');
    console.log('[normalizeImageUrl] fixed api.umeedretailers.com to app.umeedretailers.com:', processedUrl);
  }
  
  return processedUrl;
};
