import { describe, expect, it } from "vitest";
import {
  initialInteractionLifecycle,
  interactionPresentation,
  transitionInteractionLifecycle
} from "../src/ui/lifecycle";

describe("interaction lifecycle", () => {
  it("shows the one-time submit and cancel actions while initially editing", () => {
    expect(interactionPresentation(initialInteractionLifecycle())).toEqual({
      formDisabled: false,
      showPrimaryActions: true,
      showCancel: true,
      showCancelReselect: false,
      showReselect: false
    });
  });

  it("replaces the submit actions with reselect after successful delivery", () => {
    const submitting = transitionInteractionLifecycle(initialInteractionLifecycle(), "submit");
    const completed = transitionInteractionLifecycle(submitting, "delivery_success");

    expect(completed).toEqual({ phase: "completed", hasCompletedOnce: true });
    expect(interactionPresentation(completed)).toEqual({
      formDisabled: true,
      showPrimaryActions: false,
      showCancel: false,
      showCancelReselect: false,
      showReselect: true
    });
  });

  it("enters a reversible draft mode when the user reselects", () => {
    const completed = { phase: "completed", hasCompletedOnce: true } as const;
    const reselecting = transitionInteractionLifecycle(completed, "reselect");

    expect(reselecting.phase).toBe("reselecting");
    expect(interactionPresentation(reselecting)).toEqual({
      formDisabled: false,
      showPrimaryActions: true,
      showCancel: false,
      showCancelReselect: true,
      showReselect: false
    });
  });

  it("returns to the completed presentation when reselection is cancelled", () => {
    const reselecting = { phase: "reselecting", hasCompletedOnce: true } as const;
    const restored = transitionInteractionLifecycle(reselecting, "cancel_reselect");

    expect(restored).toEqual({ phase: "completed", hasCompletedOnce: true });
    expect(interactionPresentation(restored)).toEqual({
      formDisabled: true,
      showPrimaryActions: false,
      showCancel: false,
      showCancelReselect: false,
      showReselect: true
    });
  });

  it("allows retry only from recovery and preserves the one-time history", () => {
    const submitting = transitionInteractionLifecycle(initialInteractionLifecycle(), "submit");
    const recovery = transitionInteractionLifecycle(submitting, "delivery_failure");
    const retrying = transitionInteractionLifecycle(recovery, "retry");

    expect(recovery.phase).toBe("recovery");
    expect(retrying).toEqual({ phase: "submitting", hasCompletedOnce: false });
    expect(transitionInteractionLifecycle(retrying, "reselect")).toBe(retrying);
  });
});
