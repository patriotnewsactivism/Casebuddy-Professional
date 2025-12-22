import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import express from "express";
import { registerApiNotFound } from "../server/middleware/notFound";

function startTestServer() {
  const app = express();
  app.get("/api/existing", (_req, res) => {
    res.json({ message: "ok" });
  });

  registerApiNotFound(app);

  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return { server, baseUrl };
}

describe("registerApiNotFound", () => {
  const context = startTestServer();

  after(() =>
    new Promise<void>((resolve) => {
      context.server.close(() => resolve());
    }),
  );

  it("returns structured JSON for unknown API routes", async () => {
    const response = await fetch(`${context.baseUrl}/api/missing`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);

    const body = await response.json();
    assert.deepEqual(body, { error: "API route not found" });
  });

  it("leaves defined routes untouched", async () => {
    const response = await fetch(`${context.baseUrl}/api/existing`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(body, { message: "ok" });
  });
});
