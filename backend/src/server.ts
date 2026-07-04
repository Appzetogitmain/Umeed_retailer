import dotenv from "dotenv";
// Load environment variables as early as possible
dotenv.config();
import path from "path";

console.log('--- SERVER STARTING ---');
console.log('RAZORPAY_KEY_ID exists:', !!process.env.RAZORPAY_KEY_ID);

import express, { Application, Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import connectDB from "./config/db";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { ensureDefaultAdmin } from "./utils/ensureDefaultAdmin";
import { seedHeaderCategories } from "./utils/seedHeaderCategories";
import { seedFAQs } from "./utils/seedFAQs";
import { initializeSocket } from "./socket/socketService";
import { PRODUCTION_ALLOWED_ORIGINS, isLocalhostOrigin } from "./config/corsOrigins";

const app: Application = express();
const httpServer = createServer(app);

// Allow-list shared with socketService.ts via config/corsOrigins.ts so HTTP
// and WebSocket CORS policy can't drift apart.
const allowedOrigins = PRODUCTION_ALLOWED_ORIGINS;

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow localhost
    if (process.env.NODE_ENV !== "production") {
      if (isLocalhostOrigin(origin)) {
        return callback(null, true);
      }
    }

    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, "");

    // Check if origin is in allowed list (exact match or normalized)
    const isAllowed = allowedOrigins.some((allowed) => {
      const normalizedAllowed = allowed.replace(/\/$/, "");
      return (
        origin === allowed ||
        normalizedOrigin === normalizedAllowed ||
        origin === normalizedAllowed ||
        normalizedOrigin === allowed
      );
    });

    if (isAllowed) {
      return callback(null, true);
    }

    // Log rejected origins so CORS misconfiguration is visible in server logs
    // instead of only surfacing as a silent browser-side block.
    console.warn(`⚠️ CORS rejected origin: ${origin}`);

    // Reject if not allowed - return false instead of error for better handling
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  maxAge: 86400,
};

// Apply CORS middleware - This handles everything including preflight
app.use(cors(corsOptions));

// Capture the raw request body alongside the parsed one so webhook handlers
// (e.g. Razorpay) can verify HMAC signatures against the exact bytes the
// sender signed, instead of a re-serialized JSON.stringify(req.body) which
// can differ in key order/whitespace and break signature verification.
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Initialize Socket.io
const io = initializeSocket(httpServer);
app.set("io", io);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Kosil API Server is running!",
    version: "1.0.0",
    socketIO: "Listening for WebSocket connections",
  });
});

// Debug middleware - log all incoming requests
app.use((req: Request, _res: Response, next: express.NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use("/api/v1", routes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect DB then ensure default admin exists
  await connectDB();
  await ensureDefaultAdmin();
  await seedHeaderCategories();
  await seedFAQs();

  httpServer.listen(PORT, () => {
    console.log("\n\x1b[32m✓\x1b[0m \x1b[1mKosil Server Started\x1b[0m");
    console.log(`   \x1b[36mPort:\x1b[0m http://localhost:${PORT}`);
    console.log(
      `   \x1b[36mEnvironment:\x1b[0m ${process.env.NODE_ENV || "development"}`
    );
    console.log(`   \x1b[36mSocket.IO:\x1b[0m ✓ Ready for connections\n`);
  });
}

startServer().catch((err) => {
  console.error("\n\x1b[31m✗ Failed to start server\x1b[0m");
  console.error(err);
  process.exit(1);
});
