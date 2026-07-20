import type { InteractionResult } from "./result";

interface HostCapabilities {
  updateModelContext?: unknown;
  message?: unknown;
}

export interface InteractionBridge {
  getHostCapabilities(): HostCapabilities | undefined;
  updateModelContext(params: {
    structuredContent: Record<string, unknown>;
    content: Array<{ type: "text"; text: string }>;
  }): Promise<unknown>;
  sendMessage(params: {
    role: "user";
    content: Array<{ type: "text"; text: string }>;
  }): Promise<{ isError?: boolean }>;
}

export type SubmissionOutcome =
  | "sent_with_context"
  | "sent_with_inline_result"
  | "context_only"
  | "manual_copy";

function supports(capabilities: HostCapabilities | undefined, capability: keyof HostCapabilities): boolean {
  // Older compatible hosts may not return a capability object. Preserve the
  // optimistic behavior that worked before capability negotiation was added.
  return capabilities === undefined || capabilities[capability] !== undefined;
}

export async function deliverInteractionResult(
  bridge: InteractionBridge,
  result: InteractionResult
): Promise<SubmissionOutcome> {
  const capabilities = bridge.getHostCapabilities();
  const canUpdateContext = supports(capabilities, "updateModelContext");
  const canSendMessage = supports(capabilities, "message");
  let contextUpdated = false;

  if (canUpdateContext) {
    try {
      await bridge.updateModelContext({
        structuredContent: { inbridgeInteractionResult: result },
        content: [{ type: "text", text: `InBridge interaction result:\n${JSON.stringify(result)}` }]
      });
      contextUpdated = true;
    } catch (error) {
      console.warn("Unable to update model context", error);
    }
  }

  if (canSendMessage) {
    const trigger =
      result.status === "cancelled"
        ? "我取消了上面的交互选择。请不要基于未确认的选项继续执行。"
        : contextUpdated
          ? "我已确认上面的交互选择。请读取 InBridge 同步的结构化结果并继续当前任务。"
          : `我已确认上面的交互选择，请根据此结果继续：${JSON.stringify(result)}`;

    try {
      const response = await bridge.sendMessage({ role: "user", content: [{ type: "text", text: trigger }] });
      if (response.isError) throw new Error("Host rejected the follow-up message");
      return contextUpdated ? "sent_with_context" : "sent_with_inline_result";
    } catch (error) {
      console.error("Unable to send follow-up message", error);
    }
  }

  return contextUpdated ? "context_only" : "manual_copy";
}
