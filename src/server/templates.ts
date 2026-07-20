import { z } from "zod";
import { normalizeInteraction } from "./normalize.js";
import {
  comparisonCardOptionSchema,
  idSchema,
  normalizedInteractionSchema,
  optionSchema,
  type InteractionConfig,
  type NormalizedInteraction
} from "./schemas.js";

export const templateIdSchema = z.enum(["decision", "confirmation", "experiment_config", "theme_config", "comparison"]);

export const templateCatalogEntrySchema = z
  .object({
    id: templateIdSchema,
    title: z.string(),
    description: z.string(),
    bestFor: z.array(z.string()),
    requiredParameters: z.array(z.string())
  })
  .strict();

export const templateCatalogOutputSchema = z
  .object({
    templates: z.array(templateCatalogEntrySchema)
  })
  .strict();

export const TEMPLATE_CATALOG: z.output<typeof templateCatalogEntrySchema>[] = [
  {
    id: "decision",
    title: "方案决策",
    description: "根据给定选项生成单选或多选决策面板，并显示提交前摘要。",
    bestFor: ["方案选择", "候选项筛选", "多项偏好收集"],
    requiredParameters: ["interactionId", "options"]
  },
  {
    id: "confirmation",
    title: "确认与拒绝",
    description: "生成明确的确认、拒绝和取消交互，避免把未确认内容当作授权。",
    bestFor: ["执行前确认", "风险审批", "接受或拒绝建议"],
    requiredParameters: ["interactionId", "title"]
  },
  {
    id: "experiment_config",
    title: "实验配置",
    description: "通过三步向导配置研究方向、训练参数、消融实验并在最终确认前汇总。",
    bestFor: ["机器学习实验", "论文实验设计", "训练参数确认"],
    requiredParameters: ["interactionId"]
  },
  {
    id: "theme_config",
    title: "主题配置",
    description: "生成颜色、亮度、密度和视觉风格参数，并提供安全实时预览。",
    bestFor: ["图表主题", "界面主题", "视觉风格确认"],
    requiredParameters: ["interactionId"]
  },
  {
    id: "comparison",
    title: "方案比较",
    description: "用信息丰富的单选卡片并列展示方案说明、优势和限制。",
    bestFor: ["实施方案比较", "技术选型", "策略选择"],
    requiredParameters: ["interactionId", "options"]
  }
];

const sharedFields = {
  interactionId: idSchema.describe("Stable id used to correlate the submitted result"),
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(800).optional(),
  submitLabel: z.string().min(1).max(60).optional(),
  cancelLabel: z.string().min(1).max(60).optional().default("取消")
};

const decisionTemplateSchema = z
  .object({
    templateId: z.literal("decision"),
    ...sharedFields,
    mode: z.enum(["single", "multiple"]).optional().default("single"),
    fieldLabel: z.string().min(1).max(120).optional().default("方案"),
    options: z.array(optionSchema).min(2).max(50),
    defaultValues: z.array(z.string().min(1).max(120)).max(50).optional().default([]),
    required: z.boolean().optional().default(true),
    summaryTitle: z.string().min(1).max(120).optional().default("当前选择")
  })
  .strict();

const confirmationTemplateSchema = z
  .object({
    templateId: z.literal("confirmation"),
    ...sharedFields,
    title: z.string().min(1).max(120),
    fieldLabel: z.string().min(1).max(120).optional().default("决定"),
    confirmLabel: z.string().min(1).max(120).optional().default("确认"),
    rejectLabel: z.string().min(1).max(120).optional().default("拒绝"),
    defaultDecision: z.enum(["confirm", "reject"]).optional()
  })
  .strict();

const defaultDirections = [
  { label: "强化学习", value: "rl" },
  { label: "多智能体强化学习", value: "marl" }
];

const defaultEnvironments = [
  { label: "CartPole", value: "cartpole" },
  { label: "LunarLander", value: "lunar_lander" },
  { label: "Atari", value: "atari" }
];

const defaultAblationVariables = [
  { label: "网络架构", value: "network_architecture" },
  { label: "奖励塑形", value: "reward_shaping" },
  { label: "通信模块", value: "communication_module" }
];

const experimentTemplateSchema = z
  .object({
    templateId: z.literal("experiment_config"),
    ...sharedFields,
    directionOptions: z.array(optionSchema).min(2).max(20).optional().default(defaultDirections),
    environmentOptions: z.array(optionSchema).min(1).max(30).optional().default(defaultEnvironments),
    defaultDirection: z.string().min(1).max(120).optional(),
    defaultEnvironments: z.array(z.string().min(1).max(120)).max(30).optional().default([]),
    defaultInformationDensity: z.enum(["low", "medium", "high"]).optional().default("medium"),
    defaultBudget: z.number().int().min(0).max(100).optional().default(80),
    defaultSeedCount: z.number().int().min(1).max(100).optional().default(8),
    defaultAblation: z.boolean().optional().default(true),
    ablationVariableOptions: z.array(optionSchema).min(1).max(20).optional().default(defaultAblationVariables),
    defaultAblationVariables: z.array(z.string().min(1).max(120)).max(20).optional().default([]),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .default("#2563EB"),
    note: z.string().max(2000).optional()
  })
  .strict();

const themeTemplateSchema = z
  .object({
    templateId: z.literal("theme_config"),
    ...sharedFields,
    defaultStyle: z
      .enum(["minimal", "tech", "academic", "business", "magazine"])
      .optional()
      .default("minimal"),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .default("#2563EB"),
    brightness: z.number().int().min(0).max(100).optional().default(60),
    density: z.enum(["low", "medium", "high"]).optional().default("medium"),
    previewTitle: z.string().min(1).max(120).optional().default("示例标题"),
    previewBody: z.string().min(1).max(400).optional().default("根据参数实时更新的安全主题预览。")
  })
  .strict();

const comparisonTemplateSchema = z
  .object({
    templateId: z.literal("comparison"),
    ...sharedFields,
    fieldLabel: z.string().min(1).max(120).optional().default("方案比较"),
    options: z.array(comparisonCardOptionSchema).min(2).max(6),
    defaultValue: z.string().min(1).max(120).optional(),
    required: z.boolean().optional().default(true),
    summaryTitle: z.string().min(1).max(120).optional().default("当前选择")
  })
  .strict();

export const interactionTemplateRequestSchema = z
  .discriminatedUnion("templateId", [
    decisionTemplateSchema,
    confirmationTemplateSchema,
    experimentTemplateSchema,
    themeTemplateSchema,
    comparisonTemplateSchema
  ])
  .superRefine((request, context) => {
    if (request.templateId === "decision") {
      const values = request.options.map((option) => option.value);
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: "option values must be unique", path: ["options"] });
      }
      if (new Set(request.defaultValues).size !== request.defaultValues.length) {
        context.addIssue({ code: "custom", message: "defaultValues must be unique", path: ["defaultValues"] });
      }
      if (request.defaultValues.some((value) => !values.includes(value))) {
        context.addIssue({ code: "custom", message: "defaultValues must match option values", path: ["defaultValues"] });
      }
      if (request.mode === "single" && request.defaultValues.length > 1) {
        context.addIssue({ code: "custom", message: "single decisions accept at most one default", path: ["defaultValues"] });
      }
    }

    if (request.templateId === "experiment_config") {
      const directionValues = request.directionOptions.map((option) => option.value);
      const environmentValues = request.environmentOptions.map((option) => option.value);
      if (new Set(directionValues).size !== directionValues.length) {
        context.addIssue({ code: "custom", message: "direction option values must be unique", path: ["directionOptions"] });
      }
      if (new Set(environmentValues).size !== environmentValues.length) {
        context.addIssue({ code: "custom", message: "environment option values must be unique", path: ["environmentOptions"] });
      }
      const ablationValues = request.ablationVariableOptions.map((option) => option.value);
      if (new Set(ablationValues).size !== ablationValues.length) {
        context.addIssue({
          code: "custom",
          message: "ablation variable option values must be unique",
          path: ["ablationVariableOptions"]
        });
      }
      if (request.defaultDirection !== undefined && !directionValues.includes(request.defaultDirection)) {
        context.addIssue({
          code: "custom",
          message: "defaultDirection must match a direction option",
          path: ["defaultDirection"]
        });
      }
      if (request.defaultEnvironments.some((value) => !environmentValues.includes(value))) {
        context.addIssue({
          code: "custom",
          message: "defaultEnvironments must match environment options",
          path: ["defaultEnvironments"]
        });
      }
      if (request.defaultAblationVariables.some((value) => !ablationValues.includes(value))) {
        context.addIssue({
          code: "custom",
          message: "defaultAblationVariables must match ablation variable options",
          path: ["defaultAblationVariables"]
        });
      }
    }

    if (request.templateId === "comparison") {
      const values = request.options.map((option) => option.value);
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: "comparison option values must be unique", path: ["options"] });
      }
      if (request.defaultValue !== undefined && !values.includes(request.defaultValue)) {
        context.addIssue({
          code: "custom",
          message: "defaultValue must match a comparison option",
          path: ["defaultValue"]
        });
      }
    }
  });

// MCP's tools/list exporter requires a plain object shape. Keep this schema
// discoverable for model-generated arguments, then apply the stricter
// discriminated-union validation above inside the tool callback.
export const interactionTemplateToolInputSchema = z
  .object({
    templateId: templateIdSchema.describe("Named interaction template to render"),
    interactionId: sharedFields.interactionId,
    title: sharedFields.title,
    description: sharedFields.description,
    submitLabel: sharedFields.submitLabel,
    cancelLabel: z.string().min(1).max(60).optional(),
    mode: z.enum(["single", "multiple"]).optional(),
    fieldLabel: z.string().min(1).max(120).optional(),
    options: z
      .union([
        z.array(optionSchema).min(2).max(50),
        z.array(comparisonCardOptionSchema).min(2).max(6)
      ])
      .optional(),
    defaultValues: z.array(z.string().min(1).max(120)).max(50).optional(),
    defaultValue: z.string().min(1).max(120).optional(),
    required: z.boolean().optional(),
    summaryTitle: z.string().min(1).max(120).optional(),
    confirmLabel: z.string().min(1).max(120).optional(),
    rejectLabel: z.string().min(1).max(120).optional(),
    defaultDecision: z.enum(["confirm", "reject"]).optional(),
    directionOptions: z.array(optionSchema).min(2).max(20).optional(),
    environmentOptions: z.array(optionSchema).min(1).max(30).optional(),
    defaultDirection: z.string().min(1).max(120).optional(),
    defaultEnvironments: z.array(z.string().min(1).max(120)).max(30).optional(),
    defaultInformationDensity: z.enum(["low", "medium", "high"]).optional(),
    defaultBudget: z.number().int().min(0).max(100).optional(),
    defaultSeedCount: z.number().int().min(1).max(100).optional(),
    defaultAblation: z.boolean().optional(),
    ablationVariableOptions: z.array(optionSchema).min(1).max(20).optional(),
    defaultAblationVariables: z.array(z.string().min(1).max(120)).max(20).optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    note: z.string().max(2000).optional(),
    defaultStyle: z.enum(["minimal", "tech", "academic", "business", "magazine"]).optional(),
    brightness: z.number().int().min(0).max(100).optional(),
    density: z.enum(["low", "medium", "high"]).optional(),
    previewTitle: z.string().min(1).max(120).optional(),
    previewBody: z.string().min(1).max(400).optional()
  })
  .strict();

export { normalizedInteractionSchema };
export type InteractionTemplateRequest = z.input<typeof interactionTemplateRequestSchema>;

function sharedInteraction(request: {
  interactionId: string;
  title?: string | undefined;
  description?: string | undefined;
  submitLabel?: string | undefined;
  cancelLabel?: string | undefined;
}) {
  return {
    interactionId: request.interactionId,
    ...(request.title === undefined ? {} : { title: request.title }),
    ...(request.description === undefined ? {} : { description: request.description }),
    ...(request.submitLabel === undefined ? {} : { submitLabel: request.submitLabel }),
    ...(request.cancelLabel === undefined ? {} : { cancelLabel: request.cancelLabel })
  };
}

export function buildInteractionTemplate(input: InteractionTemplateRequest): NormalizedInteraction {
  const request = interactionTemplateRequestSchema.parse(input);
  let config: InteractionConfig;

  switch (request.templateId) {
    case "decision": {
      const control =
        request.mode === "single"
          ? {
              id: "choice",
              type: "radio" as const,
              label: request.fieldLabel,
              required: request.required,
              options: request.options,
              ...(request.defaultValues[0] === undefined ? {} : { defaultValue: request.defaultValues[0] })
            }
          : {
              id: "choices",
              type: "checkbox_group" as const,
              label: request.fieldLabel,
              required: request.required,
              options: request.options,
              defaultValue: request.defaultValues
            };
      const controlId = request.mode === "single" ? "choice" : "choices";
      config = {
        ...sharedInteraction(request),
        title: request.title ?? (request.mode === "single" ? "请选择一个方案" : "请选择方案"),
        controls: [control],
        submitLabel: request.submitLabel ?? "确认选择",
        preview: { type: "summary", title: request.summaryTitle, bindings: { [request.fieldLabel]: controlId } }
      };
      break;
    }
    case "confirmation":
      config = {
        ...sharedInteraction(request),
        title: request.title,
        controls: [
          {
            id: "decision",
            type: "radio",
            label: request.fieldLabel,
            required: true,
            options: [
              { label: request.confirmLabel, value: "confirm" },
              { label: request.rejectLabel, value: "reject" }
            ],
            ...(request.defaultDecision === undefined ? {} : { defaultValue: request.defaultDecision })
          }
        ],
        submitLabel: request.submitLabel ?? "提交决定"
      };
      break;
    case "experiment_config":
      config = {
        ...sharedInteraction(request),
        title: request.title ?? "配置实验方案",
        description: request.description ?? "确认后将按这些参数继续设计或执行实验。",
        controls: [
          {
            id: "research_direction",
            type: "radio",
            label: "研究方向",
            required: true,
            options: request.directionOptions,
            ...(request.defaultDirection === undefined ? {} : { defaultValue: request.defaultDirection })
          },
          {
            id: "environments",
            type: "checkbox_group",
            label: "实验环境",
            required: true,
            options: request.environmentOptions,
            defaultValue: request.defaultEnvironments
          },
          {
            id: "information_density",
            type: "select",
            label: "信息密度",
            options: [
              { label: "低", value: "low" },
              { label: "中", value: "medium" },
              { label: "高", value: "high" }
            ],
            defaultValue: request.defaultInformationDensity
          },
          {
            id: "training_budget",
            type: "range",
            label: "训练预算",
            min: 0,
            max: 100,
            step: 5,
            defaultValue: request.defaultBudget
          },
          {
            id: "seed_count",
            type: "number",
            label: "随机种子数量",
            min: 1,
            max: 100,
            step: 1,
            defaultValue: request.defaultSeedCount
          },
          {
            id: "primary_color",
            type: "color",
            label: "图表主色",
            defaultValue: request.primaryColor
          },
          {
            id: "note",
            type: "text",
            label: "补充说明",
            placeholder: "例如：确保高质量创新性",
            ...(request.note === undefined ? {} : { defaultValue: request.note })
          },
          {
            id: "ablation",
            type: "switch",
            label: "消融实验",
            defaultValue: request.defaultAblation
          },
          {
            id: "ablation_variables",
            type: "checkbox_group",
            label: "消融变量",
            options: request.ablationVariableOptions,
            defaultValue: request.defaultAblationVariables,
            visibleWhen: { controlId: "ablation", operator: "equals", value: true }
          }
        ],
        steps: [
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
        ],
        submitLabel: request.submitLabel ?? "确认实验配置",
        preview: {
          type: "summary",
          title: "实验配置摘要",
          bindings: {
            研究方向: "research_direction",
            实验环境: "environments",
            信息密度: "information_density",
            训练预算: "training_budget",
            随机种子数量: "seed_count",
            消融实验: "ablation",
            消融变量: "ablation_variables",
            图表主色: "primary_color",
            补充说明: "note"
          }
        }
      };
      break;
    case "theme_config":
      config = {
        ...sharedInteraction(request),
        title: request.title ?? "配置主题",
        controls: [
          {
            id: "style",
            type: "select",
            label: "风格",
            options: [
              { label: "极简", value: "minimal" },
              { label: "科技", value: "tech" },
              { label: "学术", value: "academic" },
              { label: "商务", value: "business" },
              { label: "杂志", value: "magazine" }
            ],
            defaultValue: request.defaultStyle
          },
          {
            id: "primary_color",
            type: "color",
            label: "主色",
            defaultValue: request.primaryColor
          },
          {
            id: "brightness",
            type: "range",
            label: "亮度",
            min: 0,
            max: 100,
            defaultValue: request.brightness
          },
          {
            id: "density",
            type: "select",
            label: "密度",
            options: [
              { label: "低", value: "low" },
              { label: "中", value: "medium" },
              { label: "高", value: "high" }
            ],
            defaultValue: request.density
          }
        ],
        submitLabel: request.submitLabel ?? "确认主题",
        preview: {
          type: "theme_card",
          title: request.previewTitle,
          body: request.previewBody,
          bindings: {
            primaryColor: "primary_color",
            brightness: "brightness",
            density: "density",
            style: "style"
          }
        }
      };
      break;
    case "comparison":
      config = {
        ...sharedInteraction(request),
        title: request.title ?? "比较并选择一个方案",
        controls: [
          {
            id: "choice",
            type: "comparison_cards",
            label: request.fieldLabel,
            required: request.required,
            options: request.options,
            ...(request.defaultValue === undefined ? {} : { defaultValue: request.defaultValue })
          }
        ],
        submitLabel: request.submitLabel ?? "确认方案",
        preview: {
          type: "summary",
          title: request.summaryTitle,
          bindings: { [request.fieldLabel]: "choice" }
        }
      };
      break;
  }

  return normalizeInteraction(config);
}
