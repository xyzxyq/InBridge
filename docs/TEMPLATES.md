# InBridge 交互模板

模板通过 `render_interaction_template` 工具直接调用。常见决策、确认、实验配置、主题配置和方案比较不应先调用 `list_interaction_templates`；只有无法从任务判断模板时才把目录工具作为低频兜底。没有匹配模板的定制表单使用 `ask_user_interactively`。

## decision

适合方案单选、多选和偏好收集。必填参数是 `interactionId` 和 `options`。

```json
{
  "templateId": "decision",
  "interactionId": "choose_plan",
  "title": "请选择实施方案",
  "mode": "single",
  "options": [
    { "label": "方案 A", "value": "a" },
    { "label": "方案 B", "value": "b" }
  ],
  "defaultValues": ["b"]
}
```

`mode` 为 `multiple` 时会生成多选控件。模板始终生成提交前摘要。

## confirmation

适合执行前授权、接受或拒绝建议。确认、拒绝和取消拥有独立语义。

```json
{
  "templateId": "confirmation",
  "interactionId": "approve_training",
  "title": "是否开始训练？",
  "description": "预计消耗 80% 的训练预算。",
  "confirmLabel": "开始训练",
  "rejectLabel": "暂不训练"
}
```

## experiment_config

适合机器学习和论文实验设计。省略可选参数时会使用安全默认值，并生成九个字段以及“基础信息 → 训练配置 → 消融与确认”三步向导。完整摘要只在最后一步显示。

```json
{
  "templateId": "experiment_config",
  "interactionId": "marl_experiment_01",
  "defaultDirection": "marl",
  "defaultEnvironments": ["cartpole", "lunar_lander"],
  "defaultInformationDensity": "high",
  "defaultBudget": 80,
  "defaultSeedCount": 8,
  "defaultAblation": true,
  "defaultAblationVariables": ["network_architecture", "reward_shaping"],
  "primaryColor": "#9767A9",
  "note": "优先保证实验创新性和可复现性"
}
```

可以通过 `directionOptions`、`environmentOptions` 和 `ablationVariableOptions` 替换默认候选项。默认值必须引用候选项中已存在的 `value`。每次前进只校验当前步骤；返回上一步时保留输入。只有开启消融实验时才显示“消融变量”；关闭后该字段不会参与校验、摘要或提交结果。只有最后确认才会把完整结果同步给 ChatGPT。

## 条件控件

`ask_user_interactively` 允许控件通过 `visibleWhen` 引用一个前置控件：

```json
{
  "id": "details",
  "type": "text",
  "label": "补充细节",
  "visibleWhen": {
    "controlId": "enabled",
    "operator": "equals",
    "value": true
  }
}
```

`equals` 和 `not_equals` 用于标量控件，`includes` 和 `not_includes` 仅用于多选控件。条件只能引用更早出现的控件，服务端会拒绝循环、未知引用和类型不匹配。

## theme_config

适合图表、论文和界面主题确认，包含受控实时预览。

```json
{
  "templateId": "theme_config",
  "interactionId": "paper_theme",
  "defaultStyle": "academic",
  "primaryColor": "#2563EB",
  "brightness": 75,
  "density": "high",
  "previewTitle": "论文图表主题"
}
```

## comparison

适合比较信息较丰富的实施方案、技术选型或策略。每张卡可以展示说明、标签、优势和限制，最终只提交一个稳定的 `value`。

```json
{
  "templateId": "comparison",
  "interactionId": "choose_implementation",
  "title": "选择实施方案",
  "options": [
    {
      "value": "fast",
      "title": "快速方案",
      "description": "优先跑通最小闭环",
      "badge": "推荐",
      "pros": ["交付快", "风险低"],
      "cons": ["扩展能力有限"]
    },
    {
      "value": "safe",
      "title": "稳健方案",
      "description": "优先保证长期维护性",
      "pros": ["边界清晰", "易扩展"],
      "cons": ["首轮周期更长"]
    }
  ]
}
```

每组允许 2–6 张卡片。`badge` 只作说明，不会自动替用户选择；如提供 `defaultValue`，它必须匹配某张卡片的 `value`。

所有模板最终都会转换为与 `ask_user_interactively` 相同的严格白名单结构，并复用同一套确认、取消、重试和结果回传协议。
