export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  controlIds: string[];
}

export function clampStepIndex(index: number, stepCount: number): number {
  if (stepCount < 1) throw new Error("A wizard requires at least one step");
  return Math.min(stepCount - 1, Math.max(0, index));
}

export function isFinalStep(index: number, stepCount: number): boolean {
  return clampStepIndex(index, stepCount) === stepCount - 1;
}

export function stepControlIds(steps: WizardStep[], index: number): ReadonlySet<string> {
  return new Set(steps[index]?.controlIds ?? []);
}

export function controlStepIndex(steps: WizardStep[], controlId: string): number {
  return steps.findIndex((step) => step.controlIds.includes(controlId));
}
