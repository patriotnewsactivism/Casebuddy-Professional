import type { Express } from "express";

/**
 * Ensures /api requests that don't match a defined route return a JSON 404
 * instead of falling through to the client-side SPA handler.
 */
export function registerApiNotFound(app: Express): void {
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });
}
