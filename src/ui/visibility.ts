export type VisibilityValue = string | number | boolean | string[] | null;

export interface VisibilityCondition {
  controlId: string;
  operator: "equals" | "not_equals" | "includes" | "not_includes";
  value: string | number | boolean;
}

export interface ConditionalControl {
  id: string;
  visibleWhen?: VisibilityCondition;
}

export function matchesVisibilityCondition(
  condition: VisibilityCondition,
  sourceValue: VisibilityValue | undefined
): boolean {
  switch (condition.operator) {
    case "equals":
      return sourceValue === condition.value;
    case "not_equals":
      return sourceValue !== condition.value;
    case "includes":
      return Array.isArray(sourceValue) && typeof condition.value === "string" && sourceValue.includes(condition.value);
    case "not_includes":
      return Array.isArray(sourceValue) && typeof condition.value === "string" && !sourceValue.includes(condition.value);
  }
}

export function resolveVisibleControlIds(
  controls: ConditionalControl[],
  values: Record<string, VisibilityValue>
): Set<string> {
  const visible = new Set<string>();

  for (const control of controls) {
    const condition = control.visibleWhen;
    if (
      !condition ||
      (visible.has(condition.controlId) && matchesVisibilityCondition(condition, values[condition.controlId]))
    ) {
      visible.add(control.id);
    }
  }

  return visible;
}

export function selectVisibleValues(
  values: Record<string, VisibilityValue>,
  visibleControlIds: ReadonlySet<string>
): Record<string, VisibilityValue> {
  return Object.fromEntries(Object.entries(values).filter(([controlId]) => visibleControlIds.has(controlId)));
}
