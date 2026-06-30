import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter for OTP requests
 * 5 requests per 15 minutes per mobile number (falls back to IP if no mobile in body)
 */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { success: false, message: 'Too many OTP requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.method === 'OPTIONS', // Skip CORS preflight
  keyGenerator: (req: Request) => {
    if (req.body?.mobile) {
      return req.body.mobile;
    }
    return ipKeyGenerator(req.ip || 'unknown');
  },
});

/**
 * Rate limiter for login attempts
 * 10 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.method === 'OPTIONS', // Skip CORS preflight
});
