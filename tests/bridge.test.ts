import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverInteractionResult, type InteractionBridge } from "../src/ui/bridge.js";
import { createInteractionResult } from "../src/ui/result.js";

const result = createInteractionResult(
  "bridge_test",
  "confirmed",
  { plan: "b" },
  new Date("2026-07-20T00:00:00Z")
);

function createBridge(overrides: Partial<InteractionBridge> = {}): InteractionBridge {
  return {
    getHostCapabilities: () => ({ updateModelContext: {}, message: {} }),
    updateModelContext: vi.fn(async () => ({})),
    sendMessage: vi.fn(async () => ({})),
    ...overrides
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deliverInteractionResult", () => {
  it("uses model context and a short trigger when both capabilities work", async () => {
    const bridge = createBridge();
    const outcome = await deliverInteractionResult(bridge, result);

    expect(outcome).toBe("sent_with_context");
    expect(bridge.updateModelContext).toHaveBeenCalledOnce();
    expect(bridge.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [expect.objectContaining({ text: expect.stringContaining("读取 InBridge 同步") })]
      })
    );
  });

  it("inlines JSON in the message when context update fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bridge = createBridge({ updateModelContext: vi.fn(async () => Promise.reject(new Error("offline"))) });
    const outcome = await deliverInteractionResult(bridge, result);

    expect(outcome).toBe("sent_with_inline_result");
    expect(bridge.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [expect.objectContaining({ text: expect.stringContaining('"plan":"b"') })]
      })
    );
  });

  it("reports context-only recovery when sending the trigger fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bridge = createBridge({ sendMessage: vi.fn(async () => Promise.reject(new Error("rejected"))) });
    expect(await deliverInteractionResult(bridge, result)).toBe("context_only");
  });

  it("does not call unsupported host methods", async () => {
    const bridge = createBridge({ getHostCapabilities: () => ({}) });
    expect(await deliverInteractionResult(bridge, result)).toBe("manual_copy");
    expect(bridge.updateModelContext).not.toHaveBeenCalled();
    expect(bridge.sendMessage).not.toHaveBeenCalled();
  });

  it("preserves optimistic compatibility when capabilities are absent", async () => {
    const bridge = createBridge({ getHostCapabilities: () => undefined });
    expect(await deliverInteractionResult(bridge, result)).toBe("sent_with_context");
  });

  it("sends a distinct cancellation trigger", async () => {
    const cancelled = createInteractionResult("bridge_test", "cancelled", { plan: "b" });
    const bridge = createBridge({ getHostCapabilities: () => ({ message: {} }) });
    expect(await deliverInteractionResult(bridge, cancelled)).toBe("sent_with_inline_result");
    expect(bridge.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [expect.objectContaining({ text: expect.stringContaining("我取消了") })]
      })
    );
  });

  it("treats an isError response as a recoverable manual fallback", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bridge = createBridge({
      getHostCapabilities: () => ({ message: {} }),
      sendMessage: vi.fn(async () => ({ isError: true }))
    });
    expect(await deliverInteractionResult(bridge, result)).toBe("manual_copy");
  });
});
