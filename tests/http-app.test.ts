import type { Server } from "node:http";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createHttpApp } from "../src/server/app.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createHttpApp(path.join(process.cwd(), "src/site")).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to resolve test server address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HTTP production boundary", () => {
  test("adds request tracing and security headers without exposing Express", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { "x-request-id": "phase6-test-request" }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("phase6-test-request");
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  test("replaces unsafe request ids", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { "x-request-id": "unsafe request id" }
    });
    const id = response.headers.get("x-request-id");

    expect(id).toMatch(/^[A-Za-z0-9_.:-]{1,128}$/);
    expect(id).not.toBe("unsafe request id");
  });

  test("serves the project icon from the production origin", async () => {
    const response = await fetch(`${baseUrl}/icon.png`);
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400, immutable");
    expect(Array.from(body.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  test("serves the landing page with revalidation caching and a restrictive CSP", async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).not.toContain("'unsafe-inline'");
    expect(html).toContain("让对话，");
    expect(html).toContain("data-interactive-demo");
  });

  test("returns a safe JSON response for malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json"
    });
    const body = (await response.json()) as { error: string; requestId: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Malformed JSON request body");
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("{not-json"));
  });

  test("rejects bodies over 64kb without echoing their contents", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(70 * 1024) })
    });
    const text = await response.text();

    expect(response.status).toBe(413);
    expect(text).toContain("Request body exceeds the 64kb limit");
    expect(text).not.toContain("x".repeat(100));
  });

  test("uses JSON for unsupported methods and unknown routes", async () => {
    const [methodResponse, missingResponse] = await Promise.all([
      fetch(`${baseUrl}/mcp`, { method: "PUT" }),
      fetch(`${baseUrl}/missing`)
    ]);

    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("allow")).toBe("POST");
    expect(await methodResponse.json()).toMatchObject({ error: "Use POST for stateless MCP requests" });
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toMatchObject({ error: "Not found" });
  });
});
