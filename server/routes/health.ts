import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Health check endpoints for Google Cloud deployment
 * Used by load balancers and orchestrators to verify service health
 */

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: "up" | "down";
      latency?: number;
      error?: string;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export function registerHealthRoutes(app: Express) {
  // Simple liveness check - just confirms the process is running
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed readiness check - verifies all dependencies
  app.get("/api/health/ready", async (_req, res) => {
    const startTime = Date.now();
    const memoryUsage = process.memoryUsage();

    const healthStatus: HealthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      checks: {
        database: {
          status: "down",
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
      },
    };

    // Check database connectivity
    try {
      const dbStart = Date.now();
      await db.execute(sql`SELECT 1`);
      healthStatus.checks.database = {
        status: "up",
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      healthStatus.checks.database = {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown database error",
      };
      healthStatus.status = "unhealthy";
    }

    // Check memory pressure
    if (healthStatus.checks.memory.percentage > 90) {
      healthStatus.status = healthStatus.status === "unhealthy" ? "unhealthy" : "degraded";
    }

    const statusCode = healthStatus.status === "healthy" ? 200 :
                       healthStatus.status === "degraded" ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  });

  // Kubernetes-style liveness probe
  app.get("/api/health/live", (_req, res) => {
    res.status(200).send("OK");
  });

  // Startup probe for slow-starting containers
  app.get("/api/health/startup", async (_req, res) => {
    try {
      // Verify critical services are ready
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ ready: true });
    } catch {
      res.status(503).json({ ready: false });
    }
  });
}
