import { describe, expect, it } from "vitest";
import {
  buildInteractionTemplate,
  interactionTemplateRequestSchema,
  TEMPLATE_CATALOG,
  templateCatalogOutputSchema
} from "../src/server/templates.js";

describe("interaction templates", () => {
  it("publishes four valid discoverable templates", () => {
    expect(templateCatalogOutputSchema.parse({ templates: TEMPLATE_CATALOG }).templates.map((entry) => entry.id)).toEqual([
      "decision",
      "confirmation",
      "experiment_config",
      "theme_config"
    ]);
  });

  it("builds a single-decision interaction with a summary", () => {
    const interaction = buildInteractionTemplate({
      templateId: "decision",
      interactionId: "choose_plan",
      options: [
        { label: "方案 A", value: "a" },
        { label: "方案 B", value: "b" }
      ],
      defaultValues: ["b"]
    });

    expect(interaction.controls[0]).toMatchObject({ type: "radio", defaultValue: "b", required: true });
    expect(interaction.preview).toMatchObject({ type: "summary", bindings: { 方案: "choice" } });
  });

  it("builds a multiple-decision interaction", () => {
    const interaction = buildInteractionTemplate({
      templateId: "decision",
      interactionId: "choose_topics",
      mode: "multiple",
      options: [
        { label: "RL", value: "rl" },
        { label: "MARL", value: "marl" }
      ],
      defaultValues: ["rl"]
    });

    expect(interaction.controls[0]).toMatchObject({ type: "checkbox_group", defaultValue: ["rl"] });
  });

  it("rejects invalid decision defaults before rendering", () => {
    expect(() =>
      interactionTemplateRequestSchema.parse({
        templateId: "decision",
        interactionId: "bad_defaults",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" }
        ],
        defaultValues: ["a", "b"]
      })
    ).toThrow(/single decisions accept at most one default/);
  });

  it("builds an explicit confirmation interaction", () => {
    const interaction = buildInteractionTemplate({
      templateId: "confirmation",
      interactionId: "approve_run",
      title: "是否开始训练？"
    });

    expect(interaction.controls[0]).toMatchObject({
      id: "decision",
      type: "radio",
      options: [
        { label: "确认", value: "confirm" },
        { label: "拒绝", value: "reject" }
      ]
    });
    expect(interaction.cancelLabel).toBe("取消");
  });

  it("builds a complete experiment configuration with safe summary bindings", () => {
    const interaction = buildInteractionTemplate({
      templateId: "experiment_config",
      interactionId: "experiment_01",
      defaultDirection: "marl",
      defaultEnvironments: ["cartpole"],
      note: "优先保证创新性"
    });

    expect(interaction.controls).toHaveLength(9);
    expect(interaction.controls.map((control) => control.id)).toEqual([
      "research_direction",
      "environments",
      "information_density",
      "training_budget",
      "seed_count",
      "primary_color",
      "note",
      "ablation",
      "ablation_variables"
    ]);
    expect(interaction.controls[8]).toMatchObject({
      id: "ablation_variables",
      visibleWhen: { controlId: "ablation", operator: "equals", value: true }
    });
    expect(interaction.steps).toEqual([
      {
        id: "basics",
        title: "基础信息",
        controlIds: ["research_direction", "environments", "information_density"]
      },
      {
        id: "training",
        title: "训练配置",
        controlIds: ["training_budget", "seed_count", "primary_color", "note"]
      },
      {
        id: "ablation_review",
        title: "消融与确认",
        controlIds: ["ablation", "ablation_variables"]
      }
    ]);
    expect(interaction.preview).toMatchObject({ type: "summary", title: "实验配置摘要" });
  });

  it("rejects unknown default ablation variables", () => {
    expect(() =>
      interactionTemplateRequestSchema.parse({
        templateId: "experiment_config",
        interactionId: "bad_ablation",
        defaultAblationVariables: ["missing"]
      })
    ).toThrow(/must match ablation variable options/);
  });

  it("builds a theme interaction with a live theme-card preview", () => {
    const interaction = buildInteractionTemplate({
      templateId: "theme_config",
      interactionId: "paper_theme",
      defaultStyle: "academic",
      primaryColor: "#9767A9",
      brightness: 75,
      density: "high"
    });

    expect(interaction.controls).toHaveLength(4);
    expect(interaction.preview).toMatchObject({
      type: "theme_card",
      bindings: {
        primaryColor: "primary_color",
        brightness: "brightness",
        density: "density",
        style: "style"
      }
    });
  });
});
