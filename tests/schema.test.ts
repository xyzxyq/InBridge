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

  it("accepts safe theme-card bindings", () => {
    const parsed = interactionConfigSchema.parse({
      interactionId: "theme_preview",
      title: "Theme preview",
      controls: [
        { id: "color", type: "color", label: "Color" },
        { id: "brightness", type: "range", label: "Brightness", min: 0, max: 100 },
        {
          id: "style",
          type: "select",
          label: "Style",
          options: [
            { label: "Minimal", value: "minimal" },
            { label: "Tech", value: "tech" }
          ]
        }
      ],
      preview: {
        type: "theme_card",
        bindings: { primaryColor: "color", brightness: "brightness", style: "style" }
      }
    });

    expect(parsed.preview?.type).toBe("theme_card");
  });

  it("accepts summary label-to-control bindings", () => {
    const parsed = interactionConfigSchema.parse({
      ...validConfig,
      preview: { type: "summary", bindings: { "选择结果": "plan" } }
    });
    expect(parsed.preview).toMatchObject({ type: "summary", bindings: { "选择结果": "plan" } });
  });

  it("rejects preview bindings to unknown controls", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        preview: { type: "summary", bindings: { Missing: "does_not_exist" } }
      })
    ).toThrow(/references unknown control/);
  });

  it("rejects incompatible theme bindings", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        preview: { type: "theme_card", bindings: { primaryColor: "plan" } }
      })
    ).toThrow(/primaryColor is not compatible with radio/);
  });

  it("rejects arbitrary markup in preview config", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        preview: { type: "summary", html: "<script>alert(1)</script>" }
      })
    ).toThrow();
  });

  it("accepts a condition that references an earlier compatible control", () => {
    const parsed = interactionConfigSchema.parse({
      interactionId: "conditional_ablation",
      title: "Conditional controls",
      controls: [
        { id: "ablation", type: "switch", label: "Ablation", defaultValue: true },
        {
          id: "variables",
          type: "checkbox_group",
          label: "Variables",
          options: [{ label: "Reward", value: "reward" }],
          visibleWhen: { controlId: "ablation", operator: "equals", value: true }
        }
      ]
    });

    expect(parsed.controls[1]).toMatchObject({
      visibleWhen: { controlId: "ablation", operator: "equals", value: true }
    });
  });

  it("rejects conditions that reference a later control", () => {
    expect(() =>
      interactionConfigSchema.parse({
        interactionId: "forward_reference",
        title: "Forward reference",
        controls: [
          {
            id: "note",
            type: "text",
            label: "Note",
            visibleWhen: { controlId: "enabled", operator: "equals", value: true }
          },
          { id: "enabled", type: "switch", label: "Enabled" }
        ]
      })
    ).toThrow(/must reference an earlier control/);
  });

  it("rejects condition values that do not match the source type", () => {
    expect(() =>
      interactionConfigSchema.parse({
        interactionId: "wrong_condition_type",
        title: "Wrong condition type",
        controls: [
          { id: "enabled", type: "switch", label: "Enabled" },
          {
            id: "note",
            type: "text",
            label: "Note",
            visibleWhen: { controlId: "enabled", operator: "equals", value: "yes" }
          }
        ]
      })
    ).toThrow(/must be a boolean/);
  });

  it("only allows membership operators for checkbox groups", () => {
    expect(() =>
      interactionConfigSchema.parse({
        interactionId: "wrong_membership_source",
        title: "Wrong membership source",
        controls: [
          { id: "enabled", type: "switch", label: "Enabled" },
          {
            id: "note",
            type: "text",
            label: "Note",
            visibleWhen: { controlId: "enabled", operator: "includes", value: "yes" }
          }
        ]
      })
    ).toThrow(/requires a checkbox_group source/);
  });
});
