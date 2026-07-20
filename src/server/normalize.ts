import type { InteractionConfig, NormalizedInteraction } from "./schemas.js";
import { interactionConfigSchema } from "./schemas.js";

export function normalizeInteraction(input: InteractionConfig): NormalizedInteraction {
  const parsed = interactionConfigSchema.parse(input);

  return {
    interactionId: parsed.interactionId,
    title: parsed.title,
    ...(parsed.description === undefined ? {} : { description: parsed.description }),
    controls: parsed.controls,
    submitLabel: parsed.submitLabel ?? "确认并继续",
    ...(parsed.cancelLabel === undefined ? {} : { cancelLabel: parsed.cancelLabel }),
    ...(parsed.preview === undefined ? {} : { preview: parsed.preview })
  };
}
