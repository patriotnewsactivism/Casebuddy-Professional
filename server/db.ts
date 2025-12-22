import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { resolveDatabaseUrl } from "@shared/databaseUrl";

const connectionString = resolveDatabaseUrl();

// Configure connection pool for production
const poolConfig: pg.PoolConfig = {
  connectionString,
  // Connection pool settings optimized for Cloud Run/App Engine
  max: process.env.NODE_ENV === "production" ? 20 : 5,
  min: process.env.NODE_ENV === "production" ? 5 : 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // For Cloud SQL with Unix socket
  ...(process.env.CLOUD_SQL_CONNECTION_NAME && {
    host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`,
  }),
};

// SSL configuration for production (when not using Cloud SQL socket)
if (process.env.NODE_ENV === "production" && !process.env.CLOUD_SQL_CONNECTION_NAME) {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

const pool = new pg.Pool(poolConfig);

// Handle pool errors gracefully
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing database pool...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing database pool...");
  await pool.end();
  process.exit(0);
});

export const db = drizzle(pool, { schema });

// Export pool for health checks
export { pool };
