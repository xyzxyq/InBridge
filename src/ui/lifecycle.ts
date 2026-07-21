export type InteractionPhase = "editing" | "reselecting" | "submitting" | "completed" | "recovery";

export interface InteractionLifecycle {
  phase: InteractionPhase;
  hasCompletedOnce: boolean;
}

export type InteractionLifecycleEvent =
  | "submit"
  | "delivery_success"
  | "delivery_failure"
  | "retry"
  | "reselect"
  | "cancel_reselect";

export interface InteractionPresentation {
  formDisabled: boolean;
  showPrimaryActions: boolean;
  showCancel: boolean;
  showCancelReselect: boolean;
  showReselect: boolean;
}

export function initialInteractionLifecycle(): InteractionLifecycle {
  return { phase: "editing", hasCompletedOnce: false };
}

export function transitionInteractionLifecycle(
  state: InteractionLifecycle,
  event: InteractionLifecycleEvent
): InteractionLifecycle {
  if ((state.phase === "editing" || state.phase === "reselecting") && event === "submit") {
    return { ...state, phase: "submitting" };
  }
  if (state.phase === "submitting" && event === "delivery_success") {
    return { phase: "completed", hasCompletedOnce: true };
  }
  if (state.phase === "submitting" && event === "delivery_failure") {
    return { ...state, phase: "recovery" };
  }
  if (state.phase === "recovery" && event === "retry") {
    return { ...state, phase: "submitting" };
  }
  if (state.phase === "completed" && event === "reselect") {
    return { phase: "reselecting", hasCompletedOnce: true };
  }
  if (state.phase === "reselecting" && event === "cancel_reselect") {
    return { phase: "completed", hasCompletedOnce: true };
  }
  return state;
}

export function interactionPresentation(state: InteractionLifecycle): InteractionPresentation {
  const editable = state.phase === "editing" || state.phase === "reselecting";
  return {
    formDisabled: !editable,
    showPrimaryActions: editable,
    showCancel: state.phase === "editing" && !state.hasCompletedOnce,
    showCancelReselect: state.phase === "reselecting",
    showReselect: state.phase === "completed"
  };
}
