export interface UseCase {
  title: string;
  description: string;
  tag: string;
  motif: "choice" | "confirm" | "experiment" | "theme" | "learn" | "loop";
  size: "large" | "small" | "wide";
}

export const USE_CASES: readonly UseCase[] = [
  { title: "方案决策", description: "单选、多选与比较卡片，让每个决定清晰可追溯。", tag: "Decision", motif: "choice", size: "large" },
  { title: "执行前确认", description: "为高风险操作保留明确授权。", tag: "Confirmation", motif: "confirm", size: "small" },
  { title: "实验配置", description: "用向导组织预算、环境和消融变量。", tag: "Wizard", motif: "experiment", size: "small" },
  { title: "视觉风格选择", description: "调整颜色、亮度与密度并实时预览。", tag: "Live preview", motif: "theme", size: "small" },
  { title: "学习与测验", description: "把练习、反馈和路径选择带入对话。", tag: "Learning", motif: "learn", size: "small" },
  { title: "Human-in-the-loop 工作流", description: "在 Agent 自动执行过程中，插入可靠的结构化人工决策节点。", tag: "Agent workflow", motif: "loop", size: "wide" }
];
