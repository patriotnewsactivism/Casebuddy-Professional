import type { Express, Request, Response } from "express";
import { z } from "zod";
import { login, register, logout, changePassword, requireAuth } from "../middleware/auth";
import { authRateLimiter } from "../middleware/security";
import { extractRequestInfo } from "../services/auditLog";

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export function registerAuthRoutes(app: Express): void {
  /**
   * POST /api/auth/login
   * Authenticate user and return session token
   */
  app.post("/api/auth/login", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid credentials format",
          details: validation.error.errors,
        });
        return;
      }

      const { username, password } = validation.data;
      const { ip, userAgent } = extractRequestInfo(req);

      const result = await login(username, password, ip, userAgent);

      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      // Set session cookie
      res.cookie("session_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  /**
   * POST /api/auth/register
   * Create new user account
   */
  app.post("/api/auth/register", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid registration data",
          details: validation.error.errors,
        });
        return;
      }

      const { username, password } = validation.data;
      const { ip, userAgent } = extractRequestInfo(req);

      const result = await register(username, password, ip, userAgent);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Set session cookie
      res.cookie("session_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.status(201).json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  /**
   * POST /api/auth/logout
   * Terminate user session
   */
  app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.session_token || req.headers.authorization?.substring(7);
      const { ip, userAgent } = extractRequestInfo(req);

      if (token && req.user) {
        await logout(token, req.user.id, ip, userAgent);
      }

      res.clearCookie("session_token");
      res.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const validation = changePasswordSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid password data",
          details: validation.error.errors,
        });
        return;
      }

      const { currentPassword, newPassword } = validation.data;
      const { ip, userAgent } = extractRequestInfo(req);

      const result = await changePassword(
        req.user!.id,
        currentPassword,
        newPassword,
        ip,
        userAgent
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Clear cookie to force re-login
      res.clearCookie("session_token");
      res.json({ success: true, message: "Password changed successfully. Please log in again." });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Password change failed" });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info
   */
  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    res.json({
      user: req.user,
    });
  });

  /**
   * GET /api/auth/check
   * Check if session is valid (for frontend to verify auth state)
   */
  app.get("/api/auth/check", (req: Request, res: Response) => {
    const token = req.cookies?.session_token || req.headers.authorization?.substring(7);

    if (!token) {
      res.json({ authenticated: false });
      return;
    }

    // Import here to avoid circular dependency
    const { validateSession } = require("../middleware/auth");
    const session = validateSession(token);

    if (!session) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
      },
    });
  });
}
