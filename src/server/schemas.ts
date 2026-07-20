import { z } from "zod";

export const idSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "must contain only letters, numbers, underscores, or hyphens");

const labelSchema = z.string().min(1).max(120);
const descriptionSchema = z.string().max(400).optional();

export const optionSchema = z
  .object({
    label: labelSchema,
    value: z.string().min(1).max(120)
  })
  .strict();

const sharedControlFields = {
  id: idSchema,
  label: labelSchema,
  description: descriptionSchema,
  required: z.boolean().optional().default(false)
};

export const radioControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("radio"),
    options: z.array(optionSchema).min(2).max(50),
    defaultValue: z.string().max(120).optional()
  })
  .strict();

export const checkboxGroupControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("checkbox_group"),
    options: z.array(optionSchema).min(1).max(50),
    defaultValue: z.array(z.string().max(120)).max(50).optional().default([])
  })
  .strict();

export const selectControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("select"),
    options: z.array(optionSchema).min(2).max(50),
    placeholder: z.string().max(120).optional(),
    defaultValue: z.string().max(120).optional()
  })
  .strict();

export const rangeControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("range"),
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().finite().positive().optional().default(1),
    defaultValue: z.number().finite().optional(),
    showValue: z.boolean().optional().default(true)
  })
  .strict();

export const textControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("text"),
    placeholder: z.string().max(200).optional(),
    defaultValue: z.string().max(2000).optional(),
    maxLength: z.number().int().min(1).max(2000).optional().default(2000)
  })
  .strict();

export const numberControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("number"),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().finite().positive().optional().default(1),
    defaultValue: z.number().finite().optional(),
    placeholder: z.string().max(120).optional()
  })
  .strict();

export const switchControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("switch"),
    defaultValue: z.boolean().optional().default(false)
  })
  .strict();

export const colorControlSchema = z
  .object({
    ...sharedControlFields,
    type: z.literal("color"),
    defaultValue: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "must be a six-digit hex color")
      .optional()
      .default("#2563EB")
  })
  .strict();

export const controlSchema = z.discriminatedUnion("type", [
  radioControlSchema,
  checkboxGroupControlSchema,
  selectControlSchema,
  rangeControlSchema,
  textControlSchema,
  numberControlSchema,
  switchControlSchema,
  colorControlSchema
]);

const themeBindingsSchema = z
  .object({
    primaryColor: idSchema.optional(),
    brightness: idSchema.optional(),
    density: idSchema.optional(),
    style: idSchema.optional()
  })
  .strict();

const summaryBindingsSchema = z
  .record(z.string().min(1).max(60), idSchema)
  .refine((bindings) => Object.keys(bindings).length <= 20, "summary bindings must not exceed 20 entries");

export const previewSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("theme_card"),
      title: z.string().min(1).max(120).optional(),
      body: z.string().min(1).max(400).optional(),
      bindings: themeBindingsSchema.optional().default({})
    })
    .strict(),
  z
    .object({
      type: z.literal("summary"),
      title: z.string().min(1).max(120).optional(),
      bindings: summaryBindingsSchema.optional()
    })
    .strict()
]);

function validateOptions(
  control: { options: Array<{ value: string }> },
  index: number,
  ctx: z.RefinementCtx
): string[] {
  const values = control.options.map((option) => option.value);
  if (new Set(values).size !== values.length) {
    ctx.addIssue({ code: "custom", message: "option values must be unique", path: ["controls", index, "options"] });
  }
  return values;
}

export const interactionConfigSchema = z
  .object({
    interactionId: idSchema,
    title: z.string().min(1).max(120),
    description: z.string().max(800).optional(),
    controls: z.array(controlSchema).min(1).max(20),
    submitLabel: z.string().min(1).max(60).optional(),
    cancelLabel: z.string().min(1).max(60).optional(),
    preview: previewSchema.optional()
  })
  .strict()
  .superRefine((config, ctx) => {
    const ids = config.controls.map((control) => control.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "control ids must be unique", path: ["controls"] });
    }

    config.controls.forEach((control, index) => {
      if (control.type === "radio" || control.type === "select") {
        const values = validateOptions(control, index, ctx);
        if (control.defaultValue !== undefined && !values.includes(control.defaultValue)) {
          ctx.addIssue({
            code: "custom",
            message: "defaultValue must match an option value",
            path: ["controls", index, "defaultValue"]
          });
        }
      }

      if (control.type === "checkbox_group") {
        const values = validateOptions(control, index, ctx);
        if (new Set(control.defaultValue).size !== control.defaultValue.length) {
          ctx.addIssue({
            code: "custom",
            message: "defaultValue entries must be unique",
            path: ["controls", index, "defaultValue"]
          });
        }
        if (control.defaultValue.some((value) => !values.includes(value))) {
          ctx.addIssue({
            code: "custom",
            message: "defaultValue entries must match option values",
            path: ["controls", index, "defaultValue"]
          });
        }
      }

      if (control.type === "range") {
        if (control.min >= control.max) {
          ctx.addIssue({ code: "custom", message: "min must be less than max", path: ["controls", index, "min"] });
        }
        if (
          control.defaultValue !== undefined &&
          (control.defaultValue < control.min || control.defaultValue > control.max)
        ) {
          ctx.addIssue({
            code: "custom",
            message: "defaultValue must be within min and max",
            path: ["controls", index, "defaultValue"]
          });
        }
      }

      if (control.type === "number") {
        if (control.min !== undefined && control.max !== undefined && control.min > control.max) {
          ctx.addIssue({ code: "custom", message: "min must be less than or equal to max", path: ["controls", index, "min"] });
        }
        if (
          control.defaultValue !== undefined &&
          ((control.min !== undefined && control.defaultValue < control.min) ||
            (control.max !== undefined && control.defaultValue > control.max))
        ) {
          ctx.addIssue({
            code: "custom",
            message: "defaultValue must be within min and max",
            path: ["controls", index, "defaultValue"]
          });
        }
      }

      if (
        control.type === "text" &&
        control.defaultValue !== undefined &&
        control.defaultValue.length > control.maxLength
      ) {
        ctx.addIssue({
          code: "custom",
          message: "defaultValue must not exceed maxLength",
          path: ["controls", index, "defaultValue"]
        });
      }
    });

    if (config.preview) {
      const controlsById = new Map(config.controls.map((control) => [control.id, control]));
      const bindingEntries = Object.entries(config.preview.bindings ?? {});
      for (const [binding, controlId] of bindingEntries) {
        const control = controlsById.get(controlId);
        if (!control) {
          ctx.addIssue({
            code: "custom",
            message: `preview binding references unknown control: ${controlId}`,
            path: ["preview", "bindings", binding]
          });
          continue;
        }

        if (config.preview.type === "theme_card") {
          const compatible =
            (binding === "primaryColor" && control.type === "color") ||
            (binding === "brightness" && (control.type === "range" || control.type === "number")) ||
            ((binding === "density" || binding === "style") &&
              (control.type === "radio" || control.type === "select"));
          if (!compatible) {
            ctx.addIssue({
              code: "custom",
              message: `${binding} is not compatible with ${control.type}`,
              path: ["preview", "bindings", binding]
            });
          }
        }
      }
    }
  });

export const normalizedInteractionSchema = z.object({
  interactionId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  controls: z.array(controlSchema),
  submitLabel: z.string(),
  cancelLabel: z.string().optional(),
  preview: previewSchema.optional()
});

export type InteractionConfig = z.input<typeof interactionConfigSchema>;
export type NormalizedInteraction = z.output<typeof normalizedInteractionSchema>;
