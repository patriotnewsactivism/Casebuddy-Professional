import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

function createDegradedDbClient(): NodePgDatabase<typeof schema> {
  const handler: ProxyHandler<Record<string, never>> = {
    get(_target, property) {
      throw new Error(
        `Database is not configured. Set the DATABASE_URL environment variable before calling '${String(property)}'.`,
      );
    },
  };

  return new Proxy({}, handler) as NodePgDatabase<typeof schema>;
}

interface DatabaseResources {
  db: NodePgDatabase<typeof schema>;
  pool: pg.Pool | null;
  isConfigured: boolean;
}

export function initializeDatabase(env: NodeJS.ProcessEnv = process.env): DatabaseResources {
  if (!env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Starting in degraded mode with no database connectivity.");
    return {
      db: createDegradedDbClient(),
      pool: null,
      isConfigured: false,
    };
  }

  // Configure connection pool for production
  const poolConfig: pg.PoolConfig = {
    connectionString: env.DATABASE_URL,
    // Connection pool settings optimized for Cloud Run/App Engine
    max: env.NODE_ENV === "production" ? 20 : 5,
    min: env.NODE_ENV === "production" ? 5 : 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // For Cloud SQL with Unix socket
    ...(env.CLOUD_SQL_CONNECTION_NAME && {
      host: `/cloudsql/${env.CLOUD_SQL_CONNECTION_NAME}`,
    }),
  };

  // SSL configuration for production (when not using Cloud SQL socket)
  if (env.NODE_ENV === "production" && !env.CLOUD_SQL_CONNECTION_NAME) {
    poolConfig.ssl = {
      rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
    };
  }

  const pool = new pg.Pool(poolConfig);

  // Handle pool errors gracefully
  pool.on("error", (err) => {
    console.error("Unexpected database pool error:", err);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutdown signal received, closing database pool...");
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return {
    db: drizzle(pool, { schema }),
    pool,
    isConfigured: true,
  };
}

const { db, pool, isConfigured: isDatabaseConfigured } = initializeDatabase();

export { db, pool, isDatabaseConfigured };
