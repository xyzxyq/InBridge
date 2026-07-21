import { describe, expect, it, vi } from "vitest";
import { copyEndpoint } from "../src/site/components/endpoint-copy";
import { prefersReducedMotion } from "../src/site/components/reveal";
import { createInitialDemoState, resetScenario, themePreviewStyle } from "../src/site/data/demo-scenarios";

describe("landing page interactions", () => {
  it("creates complete defaults and resets only the selected demo scenario", () => {
    const state = createInitialDemoState();
    state.decision.choice = "creative";
    state.experiment.budget = 35;

    const reset = resetScenario(state, "decision");

    expect(reset.decision).toEqual({ choice: "safe", submitted: false });
    expect(reset.experiment.budget).toBe(35);
  });

  it("maps theme controls to bounded presentation tokens", () => {
    expect(themePreviewStyle({
      style: "academic",
      color: "#6f74cf",
      brightness: 68,
      density: "high",
      submitted: false
    })).toEqual({
      "--demo-theme-color": "#6f74cf",
      "--demo-theme-lightness": "84%",
      "--demo-theme-spacing": "0.7rem"
    });
  });

  it("reports clipboard success and failure without throwing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyEndpoint("https://example.com/mcp", { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/mcp");
    expect(await copyEndpoint("https://example.com/mcp", { writeText: vi.fn().mockRejectedValue(new Error("denied")) })).toBe(false);
  });

  it("detects the user's reduced-motion preference", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);
    vi.unstubAllGlobals();
  });
});
