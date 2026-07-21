export type InBridgeTheme = "light" | "dark";

export function resolveInBridgeTheme(
  hostTheme: InBridgeTheme | undefined,
  systemPrefersDark: boolean
): InBridgeTheme {
  return hostTheme ?? (systemPrefersDark ? "dark" : "light");
}
