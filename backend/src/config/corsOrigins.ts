// Single source of truth for allowed CORS origins, shared by the Express CORS
// config (server.ts) and the Socket.io CORS config (socketService.ts) so the
// two policies can't drift out of sync.
export const PRODUCTION_ALLOWED_ORIGINS = [
  "https://www.kosil.com",
  "https://kosil.com",
  "https://kosil-frontend.onrender.com",
  "https://kosil.biz",
  "https://kosil.biz/",
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url: string) => url.trim()).filter((url: string) => url.length > 0)
    : []),
];

export const isLocalhostOrigin = (origin: string): boolean =>
  origin.startsWith("http://localhost:") ||
  origin.startsWith("http://127.0.0.1:") ||
  origin.startsWith("https://localhost:");
