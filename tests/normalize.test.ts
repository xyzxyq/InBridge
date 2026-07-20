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
});
