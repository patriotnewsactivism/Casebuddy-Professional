export interface DatabaseEnvConfig {
  DATABASE_URL?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  CLOUD_SQL_CONNECTION_NAME?: string;
  INSTANCE_CONNECTION_NAME?: string;
  DB_SOCKET_PATH?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_DB?: string;
  POSTGRES_HOST?: string;
  POSTGRES_PORT?: string;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function buildSocketConnectionString(
  config: Required<
    Pick<DatabaseEnvConfig, "DB_USER" | "DB_PASSWORD" | "DB_NAME" | "CLOUD_SQL_CONNECTION_NAME">
  > & { DB_PORT?: string; DB_SOCKET_PATH?: string },
) {
  const port = config.DB_PORT || "5432";
  const socketBase = config.DB_SOCKET_PATH || "/cloudsql";
  const socketHost = `${socketBase}/${config.CLOUD_SQL_CONNECTION_NAME}`;
  return `postgresql://${encode(config.DB_USER)}:${encode(config.DB_PASSWORD)}@/${encode(config.DB_NAME)}?host=${encode(socketHost)}&port=${encode(port)}`;
}

function buildTcpConnectionString(config: Required<Pick<DatabaseEnvConfig, "DB_USER" | "DB_PASSWORD" | "DB_NAME" | "DB_HOST">> & { DB_PORT?: string }) {
  const port = config.DB_PORT || "5432";
  return `postgresql://${encode(config.DB_USER)}:${encode(config.DB_PASSWORD)}@${config.DB_HOST}:${port}/${encode(config.DB_NAME)}`;
}

/**
 * Resolves the database connection string from the environment.
 *
 * Priority:
 * 1. DATABASE_URL
 * 2. Cloud SQL socket parameters (DB_USER, DB_PASSWORD, DB_NAME, CLOUD_SQL_CONNECTION_NAME)
 * 3. Standard TCP parameters (DB_USER, DB_PASSWORD, DB_NAME, DB_HOST)
 */
export function resolveDatabaseUrl(env: DatabaseEnvConfig = process.env): string {
  if (env.DATABASE_URL?.trim()) {
    return env.DATABASE_URL.trim();
  }

  const dbUser = env.DB_USER || env.POSTGRES_USER;
  const dbPassword = env.DB_PASSWORD || env.POSTGRES_PASSWORD;
  const dbName = env.DB_NAME || env.POSTGRES_DB;
  const dbHost = env.DB_HOST || env.POSTGRES_HOST;
  const dbPort = env.DB_PORT || env.POSTGRES_PORT;
  const cloudSql = env.CLOUD_SQL_CONNECTION_NAME || env.INSTANCE_CONNECTION_NAME;
  const socketPath = env.DB_SOCKET_PATH;

  if (dbUser && dbPassword && dbName && cloudSql) {
    return buildSocketConnectionString({
      DB_USER: dbUser,
      DB_PASSWORD: dbPassword,
      DB_NAME: dbName,
      CLOUD_SQL_CONNECTION_NAME: cloudSql,
      DB_PORT: dbPort,
      DB_SOCKET_PATH: socketPath,
    });
  }

  if (dbUser && dbPassword && dbName && dbHost) {
    return buildTcpConnectionString({
      DB_USER: dbUser,
      DB_PASSWORD: dbPassword,
      DB_NAME: dbName,
      DB_HOST: dbHost,
      DB_PORT: dbPort,
    });
  }

  throw new Error(
    "DATABASE_URL environment variable is required. Alternatively, provide DB_USER, DB_PASSWORD, DB_NAME, and either CLOUD_SQL_CONNECTION_NAME (for Cloud SQL sockets) or DB_HOST (for TCP).",
  );
}

/**
 * Checks whether the environment contains enough information to configure a database connection.
 *
 * This mirrors the validation logic used by resolveDatabaseUrl but returns a boolean instead of
 * throwing, making it suitable for conditional server startup in CI/build environments where a
 * database is intentionally unavailable.
 */
export function hasDatabaseConfig(env: DatabaseEnvConfig = process.env): boolean {
  if (env.DATABASE_URL?.trim()) {
    return true;
  }

  const dbUser = env.DB_USER || env.POSTGRES_USER;
  const dbPassword = env.DB_PASSWORD || env.POSTGRES_PASSWORD;
  const dbName = env.DB_NAME || env.POSTGRES_DB;
  const dbHost = env.DB_HOST;
  const cloudSql = env.CLOUD_SQL_CONNECTION_NAME;

  const hasBaseCredentials = Boolean(dbUser && dbPassword && dbName);
  if (!hasBaseCredentials) {
    return false;
  }

  return Boolean(cloudSql || dbHost);
}
