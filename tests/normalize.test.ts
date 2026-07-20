import { describe, expect, it } from "vitest";
import { normalizeInteraction } from "../src/server/normalize.js";

describe("normalizeInteraction", () => {
  it("adds the default submit label and required flag", () => {
    const normalized = normalizeInteraction({
      interactionId: "test",
      title: "Test",
      controls: [
        {
          id: "answer",
          type: "radio",
          label: "Answer",
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" }
          ]
        }
      ]
    });

    expect(normalized.submitLabel).toBe("确认并继续");
    expect(normalized.controls[0]?.required).toBe(false);
  });

  it("preserves a validated preview config", () => {
    const normalized = normalizeInteraction({
      interactionId: "preview",
      title: "Preview",
      controls: [
        {
          id: "answer",
          type: "radio",
          label: "Answer",
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" }
          ]
        }
      ],
      preview: { type: "summary", bindings: { Answer: "answer" } }
    });
    expect(normalized.preview).toEqual({ type: "summary", bindings: { Answer: "answer" } });
  });

  it("preserves a validated wizard declaration", () => {
    const normalized = normalizeInteraction({
      interactionId: "wizard",
      title: "Wizard",
      controls: [
        {
          id: "answer",
          type: "radio",
          label: "Answer",
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" }
          ]
        },
        { id: "note", type: "text", label: "Note" }
      ],
      steps: [
        { id: "choice", title: "Choice", controlIds: ["answer"] },
        { id: "details", title: "Details", controlIds: ["note"] }
      ]
    });

    expect(normalized.steps).toEqual([
      { id: "choice", title: "Choice", controlIds: ["answer"] },
      { id: "details", title: "Details", controlIds: ["note"] }
    ]);
  });

  it("preserves comparison card content", () => {
    const normalized = normalizeInteraction({
      interactionId: "comparison",
      title: "Comparison",
      controls: [
        {
          id: "plan",
          type: "comparison_cards",
          label: "Plan",
          options: [
            { value: "fast", title: "Fast", pros: ["Quick"] },
            { value: "safe", title: "Safe", cons: ["Slower"] }
          ]
        }
      ]
    });

    expect(normalized.controls[0]).toMatchObject({
      type: "comparison_cards",
      options: [
        { value: "fast", title: "Fast", pros: ["Quick"], cons: [] },
        { value: "safe", title: "Safe", pros: [], cons: ["Slower"] }
      ]
    });
  });
});
