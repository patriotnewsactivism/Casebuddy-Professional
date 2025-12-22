import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { hasDatabaseConfig, resolveDatabaseUrl } from "../shared/databaseUrl";

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

test("throws when no database configuration is available", () => {
  delete process.env.DATABASE_URL;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DB_HOST;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;

  assert.throws(() => resolveDatabaseUrl());
});

test("hasDatabaseConfig mirrors validation logic", () => {
  delete process.env.DATABASE_URL;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  delete process.env.DB_HOST;
  delete process.env.CLOUD_SQL_CONNECTION_NAME;

  assert.equal(hasDatabaseConfig(), false);

  process.env.DB_USER = "user";
  process.env.DB_PASSWORD = "pw";
  process.env.DB_NAME = "db";
  process.env.DB_HOST = "localhost";

  assert.equal(hasDatabaseConfig(), true);
});
