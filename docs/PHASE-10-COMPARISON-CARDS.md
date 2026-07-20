# Phase 10：Comparison Cards

## 能力

`comparison_cards` 用于比较 2–6 个信息丰富的方案，并提交一个稳定字符串值：

```json
{
  "id": "choice",
  "type": "comparison_cards",
  "label": "方案比较",
  "required": true,
  "options": [
    {
      "value": "fast",
      "title": "快速方案",
      "description": "优先跑通闭环",
      "badge": "推荐",
      "pros": ["交付快"],
      "cons": ["扩展能力有限"]
    },
    {
      "value": "safe",
      "title": "稳健方案",
      "pros": ["风险低"],
      "cons": ["周期更长"]
    }
  ]
}
```

结果只包含选中值，例如 `{ "choice": "safe" }`，结果协议仍为 `version: "1"`。

## 安全边界

- 卡片标题必填，说明和标签可选。
- 优势与限制各最多五项。
- 选项值唯一，默认值必须引用现有选项。
- 不接受图片、URL、HTML、CSS、脚本、表达式或未知字段。
- `badge` 只作说明，不会自动替用户选择。

## 交互与可访问性

- 整张卡片是关联原生 radio 的 label。
- 鼠标、触摸、键盘和屏幕阅读器都使用单选语义。
- 选中态同时显示边框、背景和“已选择”文字。
- 必填未选时阻止提交并聚焦第一张卡。
- 桌面端使用响应式网格，移动端使用单列。

## 模板

`comparison` 模板必填 `interactionId` 和 `options`，默认生成 `choice` 控件、安全摘要、“确认方案”和“取消”按钮。

## ChatGPT 验收提示词

```text
请只调用 InBridge 的 render_interaction_template，使用 comparison 模板，
让我从“快速方案”“稳健方案”“创新方案”三张比较卡片中单选。
每张卡片都提供简短说明、优势和限制；将“稳健方案”标记为推荐，
但不要设置默认选择。调用后等待我在卡片中确认。
```

验收应确认：未选择时不能提交；整卡可点击；最终只提交一次；ChatGPT 能准确读取选中方案并继续任务。
