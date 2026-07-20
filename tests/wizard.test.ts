import { describe, expect, it } from "vitest";
import {
  clampStepIndex,
  controlStepIndex,
  isFinalStep,
  nextStepIndex,
  previousStepIndex,
  stepControlIds,
  type WizardStep
} from "../src/ui/wizard.js";

const steps: WizardStep[] = [
  { id: "basics", title: "Basics", controlIds: ["direction"] },
  { id: "training", title: "Training", controlIds: ["budget", "seed_count"] },
  { id: "review", title: "Review", controlIds: ["ablation"] }
];

describe("wizard navigation model", () => {
  it("clamps step indexes to the available range", () => {
    expect(clampStepIndex(-1, 3)).toBe(0);
    expect(clampStepIndex(1, 3)).toBe(1);
    expect(clampStepIndex(4, 3)).toBe(2);
    expect(() => clampStepIndex(0, 0)).toThrow(/at least one step/);
  });

  it("detects the final step", () => {
    expect(isFinalStep(1, 3)).toBe(false);
    expect(isFinalStep(2, 3)).toBe(true);
  });

  it("returns the controls assigned to a step", () => {
    expect([...stepControlIds(steps, 1)]).toEqual(["budget", "seed_count"]);
    expect([...stepControlIds(steps, 9)]).toEqual([]);
  });

  it("finds the step that owns a control", () => {
    expect(controlStepIndex(steps, "seed_count")).toBe(1);
    expect(controlStepIndex(steps, "missing")).toBe(-1);
  });

  it("moves forward and backward without crossing boundaries", () => {
    expect(nextStepIndex(0, 3)).toBe(1);
    expect(nextStepIndex(2, 3)).toBe(2);
    expect(previousStepIndex(1, 3)).toBe(0);
    expect(previousStepIndex(0, 3)).toBe(0);
  });
});
