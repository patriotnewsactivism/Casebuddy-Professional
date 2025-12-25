import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveDatabaseUrl } from "../shared/databaseUrl";

const originalEnv = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

afterEach(() => {
  resetEnv();
});

test("uses DATABASE_URL when provided", () => {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
  const url = resolveDatabaseUrl();
  assert.equal(url, "postgresql://user:pass@localhost:5432/db");
});

test("constructs Cloud SQL socket connection string", () => {
  delete process.env.DATABASE_URL;
  process.env.DB_USER = "casebuddy";
  process.env.DB_PASSWORD = "s3cret!";
  process.env.DB_NAME = "cases";
  process.env.CLOUD_SQL_CONNECTION_NAME = "project:region:instance";
  process.env.DB_PORT = "5432";

  const url = resolveDatabaseUrl();
  assert.equal(
    url,
    "postgresql://casebuddy:s3cret!@/cases?host=%2Fcloudsql%2Fproject%3Aregion%3Ainstance&port=5432",
  );
});

test("supports alternate Cloud SQL env vars and custom socket path", () => {
  delete process.env.DATABASE_URL;
  process.env.POSTGRES_USER = "casebuddy";
  process.env.POSTGRES_PASSWORD = "s3cret!";
  process.env.POSTGRES_DB = "cases";
  process.env.INSTANCE_CONNECTION_NAME = "project:region:instance";
  process.env.DB_PORT = "6543";
  process.env.DB_SOCKET_PATH = "/tmp/cloudsql";

  const url = resolveDatabaseUrl();
  assert.equal(
    url,
    "postgresql://casebuddy:s3cret!@/cases?host=%2Ftmp%2Fcloudsql%2Fproject%3Aregion%3Ainstance&port=6543",
  );
});

test("constructs TCP connection string when host is provided", () => {
  delete process.env.DATABASE_URL;
  process.env.DB_USER = "casebuddy";
  process.env.DB_PASSWORD = "s3cret!";
  process.env.DB_NAME = "cases";
  process.env.DB_HOST = "127.0.0.1";
  process.env.DB_PORT = "5433";

  const url = resolveDatabaseUrl();
  assert.equal(url, "postgresql://casebuddy:s3cret!@127.0.0.1:5433/cases");
});

test("uses PostgreSQL-style host variables when provided", () => {
  delete process.env.DATABASE_URL;
  process.env.POSTGRES_USER = "casebuddy";
  process.env.POSTGRES_PASSWORD = "s3cret!";
  process.env.POSTGRES_DB = "cases";
  process.env.POSTGRES_HOST = "db.internal";
  process.env.POSTGRES_PORT = "6432";

  const url = resolveDatabaseUrl();
  assert.equal(url, "postgresql://casebuddy:s3cret!@db.internal:6432/cases");
});

test("wraps IPv6 hosts in brackets for TCP connections", () => {
  delete process.env.DATABASE_URL;
  process.env.DB_USER = "casebuddy";
  process.env.DB_PASSWORD = "s3cret!";
  process.env.DB_NAME = "cases";
  process.env.DB_HOST = "2001:db8::1";
  process.env.DB_PORT = "5432";

  const url = resolveDatabaseUrl();
  assert.equal(url, "postgresql://casebuddy:s3cret!@[2001:db8::1]:5432/cases");
});

test("trims whitespace from environment values", () => {
  delete process.env.DATABASE_URL;
  process.env.DB_USER = "  casebuddy  ";
  process.env.DB_PASSWORD = "  s3cret!  ";
  process.env.DB_NAME = "  cases  ";
  process.env.DB_HOST = "  127.0.0.1  ";
  process.env.DB_PORT = " 5432 ";

  const url = resolveDatabaseUrl();
  assert.equal(url, "postgresql://casebuddy:s3cret!@127.0.0.1:5432/cases");
});

test("throws when no database configuration is available", () => {
  delete process.env.DATABASE_URL;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DB_HOST;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;

  assert.throws(() => resolveDatabaseUrl());
});
