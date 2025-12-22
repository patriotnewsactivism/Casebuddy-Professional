import type { Request, Response, NextFunction } from "express";
import { compare, hash } from "bcrypt";
import { randomBytes, createHash } from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auditLog, AuditAction } from "../services/auditLog";

const BCRYPT_ROUNDS = 12;
const SESSION_TOKEN_LENGTH = 32;
const SESSION_EXPIRY_HOURS = 24;

// In-memory session store (should be replaced with Redis in production)
interface Session {
  userId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
  ip: string;
  userAgent: string;
}

const sessions = new Map<string, Session>();

// Clean expired sessions periodically
setInterval(() => {
  const now = new Date();
  sessions.forEach((session, token) => {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  });
}, 60 * 60 * 1000); // Every hour

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_LENGTH).toString("hex");
}

/**
 * Create a new session for a user
 */
export function createSession(
  userId: string,
  username: string,
  ip: string,
  userAgent: string
): string {
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  sessions.set(token, {
    userId,
    username,
    createdAt: now,
    expiresAt,
    ip,
    userAgent,
  });

  return token;
}

/**
 * Validate a session token and return session data
 */
export function validateSession(token: string): Session | null {
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Destroy a session
 */
export function destroySession(token: string): void {
  sessions.delete(token);
}

/**
 * Destroy all sessions for a user
 */
export function destroyAllUserSessions(userId: string): void {
  sessions.forEach((session, token) => {
    if (session.userId === userId) {
      sessions.delete(token);
    }
  });
}

/**
 * Authentication middleware - requires valid session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.session_token;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const session = validateSession(token);

  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  // Attach user to request
  req.user = {
    id: session.userId,
    username: session.username,
  };

  next();
}

/**
 * Optional authentication - attaches user if authenticated, continues if not
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.session_token;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : cookieToken;

  if (token) {
    const session = validateSession(token);
    if (session) {
      req.user = {
        id: session.userId,
        username: session.username,
      };
    }
  }

  next();
}

/**
 * Login handler
 */
export async function login(
  username: string,
  password: string,
  ip: string,
  userAgent: string
): Promise<{ success: true; token: string; user: { id: string; username: string } } | { success: false; error: string }> {
  try {
    // Find user
    const [user] = await db.select().from(users).where(eq(users.username, username));

    if (!user) {
      await auditLog({
        action: AuditAction.LOGIN_FAILED,
        userId: null,
        ip,
        userAgent,
        details: { reason: "User not found", username },
      });
      return { success: false, error: "Invalid credentials" };
    }

    // Check if password is hashed (starts with $2) or plaintext
    const isHashed = user.password.startsWith("$2");
    let passwordValid: boolean;

    if (isHashed) {
      passwordValid = await verifyPassword(password, user.password);
    } else {
      // Legacy plaintext comparison - should be migrated
      passwordValid = password === user.password;

      // Auto-upgrade to hashed password on successful login
      if (passwordValid) {
        const hashedPassword = await hashPassword(password);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));
      }
    }

    if (!passwordValid) {
      await auditLog({
        action: AuditAction.LOGIN_FAILED,
        userId: user.id,
        ip,
        userAgent,
        details: { reason: "Invalid password" },
      });
      return { success: false, error: "Invalid credentials" };
    }

    // Create session
    const token = createSession(user.id, user.username, ip, userAgent);

    await auditLog({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      ip,
      userAgent,
      details: {},
    });

    return {
      success: true,
      token,
      user: { id: user.id, username: user.username },
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

/**
 * Register handler
 */
export async function register(
  username: string,
  password: string,
  ip: string,
  userAgent: string
): Promise<{ success: true; token: string; user: { id: string; username: string } } | { success: false; error: string }> {
  try {
    // Validate password strength
    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    if (!/[A-Z]/.test(password)) {
      return { success: false, error: "Password must contain at least one uppercase letter" };
    }

    if (!/[a-z]/.test(password)) {
      return { success: false, error: "Password must contain at least one lowercase letter" };
    }

    if (!/[0-9]/.test(password)) {
      return { success: false, error: "Password must contain at least one number" };
    }

    // Check if username already exists
    const [existing] = await db.select().from(users).where(eq(users.username, username));
    if (existing) {
      return { success: false, error: "Username already exists" };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const [user] = await db.insert(users).values({
      username,
      password: hashedPassword,
    }).returning();

    // Create session
    const token = createSession(user.id, user.username, ip, userAgent);

    await auditLog({
      action: AuditAction.USER_REGISTERED,
      userId: user.id,
      ip,
      userAgent,
      details: {},
    });

    return {
      success: true,
      token,
      user: { id: user.id, username: user.username },
    };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Registration failed" };
  }
}

/**
 * Logout handler
 */
export async function logout(
  token: string,
  userId: string,
  ip: string,
  userAgent: string
): Promise<void> {
  destroySession(token);

  await auditLog({
    action: AuditAction.LOGOUT,
    userId,
    ip,
    userAgent,
    details: {},
  });
}

/**
 * Change password handler
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ip: string,
  userAgent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Verify current password
    const isHashed = user.password.startsWith("$2");
    let passwordValid: boolean;

    if (isHashed) {
      passwordValid = await verifyPassword(currentPassword, user.password);
    } else {
      passwordValid = currentPassword === user.password;
    }

    if (!passwordValid) {
      await auditLog({
        action: AuditAction.PASSWORD_CHANGE_FAILED,
        userId,
        ip,
        userAgent,
        details: { reason: "Current password incorrect" },
      });
      return { success: false, error: "Current password is incorrect" };
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    // Invalidate all other sessions
    destroyAllUserSessions(userId);

    await auditLog({
      action: AuditAction.PASSWORD_CHANGED,
      userId,
      ip,
      userAgent,
      details: {},
    });

    return { success: true };
  } catch (error) {
    console.error("Password change error:", error);
    return { success: false, error: "Password change failed" };
  }
}
