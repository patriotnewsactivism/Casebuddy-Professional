import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { resolveDatabaseUrl } from "@shared/databaseUrl";

const { Pool } = pg;

const connectionString = resolveDatabaseUrl();

// Configure connection pool for production
const cloudSqlConnection =
  process.env.CLOUD_SQL_CONNECTION_NAME || process.env.INSTANCE_CONNECTION_NAME;
const socketPath = process.env.DB_SOCKET_PATH || "/cloudsql";

const poolConfig: pg.PoolConfig = {
  connectionString,
  // Connection pool settings optimized for Cloud Run/App Engine
  max: process.env.NODE_ENV === "production" ? 20 : 5,
  min: process.env.NODE_ENV === "production" ? 5 : 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // For Cloud SQL with Unix socket
  ...(cloudSqlConnection && {
    host: `${socketPath}/${cloudSqlConnection}`,
  }),
};

// SSL configuration for production (when not using Cloud SQL socket)
if (process.env.NODE_ENV === "production" && !cloudSqlConnection) {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };
}

const pool = new Pool(poolConfig);

// Handle pool errors gracefully
pool.on("error", (err: Error) => {
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
