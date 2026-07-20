import { describe, expect, it } from "vitest";
import { matchesVisibilityCondition, resolveVisibleControlIds, selectVisibleValues } from "../src/ui/visibility.js";

describe("conditional control visibility", () => {
  it("shows and hides a dependent control from a boolean switch", () => {
    const controls = [
      { id: "ablation" },
      {
        id: "variables",
        visibleWhen: { controlId: "ablation", operator: "equals" as const, value: true }
      }
    ];

    expect([...resolveVisibleControlIds(controls, { ablation: false })]).toEqual(["ablation"]);
    expect([...resolveVisibleControlIds(controls, { ablation: true })]).toEqual(["ablation", "variables"]);
  });

  it("supports checkbox membership conditions", () => {
    expect(
      matchesVisibilityCondition(
        { controlId: "topics", operator: "includes", value: "marl" },
        ["rl", "marl"]
      )
    ).toBe(true);
    expect(
      matchesVisibilityCondition(
        { controlId: "topics", operator: "not_includes", value: "vision" },
        ["rl", "marl"]
      )
    ).toBe(true);
  });

  it("hides an entire dependency chain when its source is hidden", () => {
    const controls = [
      { id: "enabled" },
      { id: "details", visibleWhen: { controlId: "enabled", operator: "equals" as const, value: true } },
      { id: "note", visibleWhen: { controlId: "details", operator: "equals" as const, value: "show" } }
    ];

    expect([...resolveVisibleControlIds(controls, { enabled: false, details: "show" })]).toEqual(["enabled"]);
  });

  it("excludes hidden values from the submitted result", () => {
    const selected = selectVisibleValues(
      { ablation: false, variables: ["reward"], budget: 80 },
      new Set(["ablation", "budget"])
    );

    expect(selected).toEqual({ ablation: false, budget: 80 });
  });
});
