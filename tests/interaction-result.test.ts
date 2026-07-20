import { describe, expect, it } from "vitest";
import { createInteractionResult } from "../src/ui/result.js";

describe("createInteractionResult", () => {
  it("creates a versioned confirmed result", () => {
    expect(createInteractionResult("demo", "confirmed", { plan: "b" }, new Date("2026-07-20T00:00:00Z"))).toEqual({
      version: "1",
      interactionId: "demo",
      status: "confirmed",
      values: { plan: "b" },
      submittedAt: "2026-07-20T00:00:00.000Z"
    });
  });

  it("never carries values into a cancelled result", () => {
    expect(createInteractionResult("demo", "cancelled", { plan: "b" }).values).toEqual({});
  });

  it("preserves typed values from every control", () => {
    const values = {
      topics: ["rl", "marl"],
      brightness: 42,
      ablation: true,
      note: "test",
      optionalNumber: null
    };
    expect(createInteractionResult("typed", "confirmed", values).values).toEqual(values);
  });
});
