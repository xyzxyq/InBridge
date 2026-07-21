export type DemoScenarioId = "decision" | "experiment" | "theme";

export interface DemoScenario {
  id: DemoScenarioId;
  label: string;
  description: string;
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  { id: "decision", label: "方案选择", description: "并列比较信息完整的候选方案，并提交一个明确决定。" },
  { id: "experiment", label: "实验配置", description: "通过三步向导逐步完成研究与训练参数配置。" },
  { id: "theme", label: "主题预览", description: "调整视觉参数，并在确认前即时查看结果。" }
];

export interface DemoState {
  decision: { choice: string; submitted: boolean };
  experiment: {
    step: number;
    direction: string;
    environments: string[];
    budget: number;
    seeds: number;
    ablation: boolean;
    submitted: boolean;
  };
  theme: {
    style: string;
    color: string;
    brightness: number;
    density: string;
    submitted: boolean;
  };
}

export function createInitialDemoState(): DemoState {
  return {
    decision: { choice: "safe", submitted: false },
    experiment: {
      step: 0,
      direction: "marl",
      environments: ["cartpole", "lunar"],
      budget: 80,
      seeds: 8,
      ablation: true,
      submitted: false
    },
    theme: { style: "academic", color: "#6f74cf", brightness: 68, density: "medium", submitted: false }
  };
}

export function resetScenario(state: DemoState, id: DemoScenarioId): DemoState {
  const fresh = createInitialDemoState();
  return { ...state, [id]: fresh[id] };
}

export function themePreviewStyle(state: DemoState["theme"]): Record<string, string> {
  const lightness = 96 - Math.round(state.brightness * 0.18);
  const spacing = state.density === "low" ? "1.4rem" : state.density === "high" ? "0.7rem" : "1rem";
  return {
    "--demo-theme-color": state.color,
    "--demo-theme-lightness": `${lightness}%`,
    "--demo-theme-spacing": spacing
  };
}
