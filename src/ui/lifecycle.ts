export type InteractionPhase = "editing" | "submitting" | "completed" | "recovery";

export interface InteractionLifecycle {
  phase: InteractionPhase;
  hasCompletedOnce: boolean;
}

export type InteractionLifecycleEvent =
  | "submit"
  | "delivery_success"
  | "delivery_failure"
  | "retry"
  | "reselect";

export interface InteractionPresentation {
  formDisabled: boolean;
  showPrimaryActions: boolean;
  showCancel: boolean;
  showReselect: boolean;
}

export function initialInteractionLifecycle(): InteractionLifecycle {
  return { phase: "editing", hasCompletedOnce: false };
}

export function transitionInteractionLifecycle(
  state: InteractionLifecycle,
  event: InteractionLifecycleEvent
): InteractionLifecycle {
  if (state.phase === "editing" && event === "submit") {
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
    return { phase: "editing", hasCompletedOnce: true };
  }
  return state;
}

export function interactionPresentation(state: InteractionLifecycle): InteractionPresentation {
  const editing = state.phase === "editing";
  return {
    formDisabled: !editing,
    showPrimaryActions: editing,
    showCancel: editing && !state.hasCompletedOnce,
    showReselect: state.phase === "completed"
  };
}
