export interface InteractionResult {
  version: "1";
  interactionId: string;
  status: "confirmed" | "cancelled";
  values: Record<string, string>;
  submittedAt: string;
}

export function createInteractionResult(
  interactionId: string,
  status: InteractionResult["status"],
  values: Record<string, string>,
  submittedAt = new Date()
): InteractionResult {
  return {
    version: "1",
    interactionId,
    status,
    values: status === "cancelled" ? {} : values,
    submittedAt: submittedAt.toISOString()
  };
}
