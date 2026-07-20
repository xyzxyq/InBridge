import { z } from "zod";

const idSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "must contain only letters, numbers, underscores, or hyphens");

export const optionSchema = z
  .object({
    label: z.string().min(1).max(120),
    value: z.string().min(1).max(120)
  })
  .strict();

export const radioControlSchema = z
  .object({
    id: idSchema,
    type: z.literal("radio"),
    label: z.string().min(1).max(120),
    description: z.string().max(400).optional(),
    required: z.boolean().optional().default(false),
    options: z.array(optionSchema).min(2).max(20),
    defaultValue: z.string().max(120).optional()
  })
  .strict()
  .superRefine((control, ctx) => {
    const values = control.options.map((option) => option.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: "custom", message: "option values must be unique", path: ["options"] });
    }
    if (control.defaultValue !== undefined && !values.includes(control.defaultValue)) {
      ctx.addIssue({ code: "custom", message: "defaultValue must match an option value", path: ["defaultValue"] });
    }
  });

export const interactionConfigSchema = z
  .object({
    interactionId: idSchema,
    title: z.string().min(1).max(120),
    description: z.string().max(800).optional(),
    controls: z.array(radioControlSchema).min(1).max(10),
    submitLabel: z.string().min(1).max(60).optional(),
    cancelLabel: z.string().min(1).max(60).optional()
  })
  .strict()
  .superRefine((config, ctx) => {
    const ids = config.controls.map((control) => control.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "control ids must be unique", path: ["controls"] });
    }
  });

export const normalizedInteractionSchema = z.object({
  interactionId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  controls: z.array(radioControlSchema),
  submitLabel: z.string(),
  cancelLabel: z.string().optional()
});

export type InteractionConfig = z.input<typeof interactionConfigSchema>;
export type NormalizedInteraction = z.output<typeof normalizedInteractionSchema>;
