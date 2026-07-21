import { describe, expect, it } from "vitest";
import { resolveInBridgeTheme } from "../src/ui/theme";

describe("theme resolution", () => {
  it("uses the MCP Host theme ahead of the operating-system preference", () => {
    expect(resolveInBridgeTheme("light", true)).toBe("light");
    expect(resolveInBridgeTheme("dark", false)).toBe("dark");
  });

  it("falls back to the operating-system preference when the Host omits a theme", () => {
    expect(resolveInBridgeTheme(undefined, true)).toBe("dark");
    expect(resolveInBridgeTheme(undefined, false)).toBe("light");
  });
});
