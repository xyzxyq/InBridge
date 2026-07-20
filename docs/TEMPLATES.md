# InBridge 交互模板

模板通过 `render_interaction_template` 工具调用。模型不确定模板时，可以先调用 `list_interaction_templates`；只有没有匹配模板的定制表单才使用底层 `render_interaction`。

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

适合机器学习和论文实验设计。省略可选参数时会使用安全默认值，并生成八个字段及实时摘要。

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
  "primaryColor": "#9767A9",
  "note": "优先保证实验创新性和可复现性"
}
```

可以通过 `directionOptions` 和 `environmentOptions` 替换默认候选项。默认值必须引用候选项中已存在的 `value`。

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

所有模板最终都会转换为与 `render_interaction` 相同的严格白名单结构，并复用同一套确认、取消、重试和结果回传协议。
