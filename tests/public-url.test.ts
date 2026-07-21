import { describe, expect, it } from "vitest";
import { resolvePublicBaseUrl } from "../src/server/public-url.js";

describe("public URL resolution", () => {
  it("prefers an explicit self-hosted URL", () => {
    expect(
      resolvePublicBaseUrl({
        INBRIDGE_PUBLIC_URL: "https://mcp.example.com/path",
        VERCEL_PROJECT_PRODUCTION_URL: "project.example.com"
      })
    ).toBe("https://mcp.example.com");
  });

  it("uses Vercel's production domain without exposing a repository-specific URL", () => {
    expect(resolvePublicBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "project.example.com" })).toBe(
      "https://project.example.com"
    );
  });

  it("falls back to the active Vercel deployment and then localhost", () => {
    expect(resolvePublicBaseUrl({ VERCEL_URL: "preview.example.com" })).toBe("https://preview.example.com");
    expect(resolvePublicBaseUrl({})).toBe("http://localhost:3000");
  });
});
