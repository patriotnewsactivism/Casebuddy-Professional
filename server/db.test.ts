import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeDatabase } from "./db";

describe("initializeDatabase", () => {
  it("falls back to degraded mode when DATABASE_URL is missing", () => {
    const { db, pool, isConfigured } = initializeDatabase({});

    assert.equal(isConfigured, false);
    assert.equal(pool, null);
    assert.throws(() => {
      // Accessing any property should surface a helpful error
      (db as unknown as Record<string, unknown>).select;
    }, /DATABASE_URL/);
  });
});
