import jwt from 'jsonwebtoken';
import { UserType } from '../models/Otp';

export interface TokenPayload {
  userId: string;
  userType: UserType;
  role?: string;
}

// Fail fast on startup rather than silently signing tokens with a publicly-known
// fallback secret that would let anyone forge valid JWTs for any user/role.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

export const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(userId: string, userType: UserType, role?: string): string {
  const payload: TokenPayload = {
    userId,
    userType,
    ...(role && { role }),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

