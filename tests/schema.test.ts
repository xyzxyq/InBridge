import { describe, expect, it } from "vitest";
import { interactionConfigSchema } from "../src/server/schemas.js";

const validConfig = {
  interactionId: "choice_001",
  title: "请选择一个方案",
  controls: [
    {
      id: "plan",
      type: "radio" as const,
      label: "方案",
      required: true,
      options: [
        { label: "方案 A", value: "a" },
        { label: "方案 B", value: "b" }
      ]
    }
  ]
};

describe("interactionConfigSchema", () => {
  it("accepts a valid radio interaction", () => {
    expect(interactionConfigSchema.parse(validConfig)).toMatchObject(validConfig);
  });

  it("rejects arbitrary HTML fields", () => {
    expect(() => interactionConfigSchema.parse({ ...validConfig, html: "<script>alert(1)</script>" })).toThrow();
  });

  it("rejects duplicate control ids", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        controls: [validConfig.controls[0], validConfig.controls[0]]
      })
    ).toThrow(/control ids must be unique/);
  });

  it("rejects a default value outside the option set", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        controls: [{ ...validConfig.controls[0], defaultValue: "missing" }]
      })
    ).toThrow(/defaultValue must match an option value/);
  });

  it("accepts every Phase 2 control type and applies defaults", () => {
    const parsed = interactionConfigSchema.parse({
      interactionId: "all_controls",
      title: "All controls",
      controls: [
        {
          id: "topics",
          type: "checkbox_group",
          label: "Topics",
          options: [
            { label: "RL", value: "rl" },
            { label: "MARL", value: "marl" }
          ],
          defaultValue: ["rl"]
        },
        {
          id: "density",
          type: "select",
          label: "Density",
          options: [
            { label: "Low", value: "low" },
            { label: "High", value: "high" }
          ]
        },
        { id: "budget", type: "range", label: "Budget", min: 0, max: 100 },
        { id: "note", type: "text", label: "Note" },
        { id: "seeds", type: "number", label: "Seeds", min: 1, max: 20 },
        { id: "ablation", type: "switch", label: "Ablation" },
        { id: "primary", type: "color", label: "Primary" }
      ]
    });

    expect(parsed.controls.map((control) => control.type)).toEqual([
      "checkbox_group",
      "select",
      "range",
      "text",
      "number",
      "switch",
      "color"
    ]);
    expect(parsed.controls[2]).toMatchObject({ step: 1, showValue: true });
    expect(parsed.controls[6]).toMatchObject({ defaultValue: "#2563EB" });
  });

  it("rejects invalid checkbox defaults", () => {
    expect(() =>
      interactionConfigSchema.parse({
        interactionId: "bad_checkbox",
        title: "Bad checkbox",
        controls: [
          {
            id: "topics",
            type: "checkbox_group",
            label: "Topics",
            options: [{ label: "RL", value: "rl" }],
            defaultValue: ["missing"]
          }
        ]
      })
    ).toThrow(/defaultValue entries must match option values/);
  });

  it("rejects invalid numeric boundaries", () => {
    expect(() =>
      interactionConfigSchema.parse({
        interactionId: "bad_range",
        title: "Bad range",
        controls: [{ id: "score", type: "range", label: "Score", min: 10, max: 1 }]
      })
    ).toThrow(/min must be less than max/);
  });

  it("rejects non-hex colors", () => {
    expect(() =>
      interactionConfigSchema.parse({
        interactionId: "bad_color",
        title: "Bad color",
        controls: [{ id: "color", type: "color", label: "Color", defaultValue: "red" }]
      })
    ).toThrow(/six-digit hex color/);
  });
});
