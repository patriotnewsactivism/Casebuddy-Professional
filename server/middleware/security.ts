import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Express, Request, Response, NextFunction } from "express";
import { randomBytes, createHash } from "crypto";

/**
 * Security middleware configuration for CaseBuddy Professional
 * Implements OWASP security best practices for legal applications
 */

// Security headers via Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.daily.co"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "wss:",
        "ws:",
        "https://generativelanguage.googleapis.com",
        "https://*.daily.co",
        "https://www.googleapis.com",
      ],
      frameSrc: ["'self'", "https://*.daily.co"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(process.env.NODE_ENV === "production" ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Daily.co integration
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  originAgentCluster: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  },
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 login attempts per 15 minutes
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Rate limiter for file uploads
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: { error: "Upload limit exceeded, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for AI operations (more expensive)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 AI requests per hour
  message: { error: "AI request limit exceeded, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF Token generation and validation using double-submit cookie pattern
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_SECRET_LENGTH = 32;

function generateCsrfToken(): string {
  return randomBytes(CSRF_SECRET_LENGTH).toString("hex");
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    // Generate token on GET requests for forms
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Client needs to read this
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    return next();
  }

  // Validate CSRF token for state-changing requests
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
}

// Request ID middleware for tracing
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers["x-request-id"] || randomBytes(16).toString("hex");
  req.requestId = id as string;
  res.setHeader("X-Request-ID", id);
  next();
}

// Sanitize request body to prevent common injection attacks
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: Record<string, any>): void {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, "");
      // Remove potential MongoDB operators
      if (obj[key].startsWith("$")) {
        obj[key] = obj[key].substring(1);
      }
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Prevent parameter pollution
export function preventParamPollution(req: Request, res: Response, next: NextFunction): void {
  if (req.query) {
    for (const key in req.query) {
      if (Array.isArray(req.query[key])) {
        // Take only the last value if array
        req.query[key] = req.query[key][req.query[key].length - 1];
      }
    }
  }
  next();
}

// Error handler that doesn't leak sensitive information
export function secureErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error(`[${req.requestId}] Error:`, err);

  // Don't leak stack traces in production
  const message = process.env.NODE_ENV === "production"
    ? "An error occurred processing your request"
    : err.message;

  const statusCode = (err as any).status || (err as any).statusCode || 500;

  res.status(statusCode).json({
    error: message,
    requestId: req.requestId,
  });
}

// Apply all security middleware to Express app
export function applySecurityMiddleware(app: Express): void {
  // Security headers
  app.use(securityHeaders);

  // Request ID for tracing
  app.use(requestId);

  // Rate limiting
  app.use("/api/", apiRateLimiter);

  // Input sanitization
  app.use(sanitizeInput);

  // Parameter pollution prevention
  app.use(preventParamPollution);
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        id: string;
        username: string;
      };
    }
  }
}
