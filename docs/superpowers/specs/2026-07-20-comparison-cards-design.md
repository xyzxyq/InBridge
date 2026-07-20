# Phase 10：Comparison Cards 设计

## 目标

让 ChatGPT 在需要用户比较多个信息丰富的方案时，通过结构化卡片展示差异，并让用户明确选择一个方案后继续当前任务。

首个生产场景是比较三个实施方案。Phase 10 只支持单选，不实现多选、排序或拖拽。

## 控件协议

新增 `comparison_cards` 控件：

```json
{
  "id": "plan",
  "type": "comparison_cards",
  "label": "请选择实施方案",
  "required": true,
  "options": [
    {
      "value": "fast",
      "title": "快速方案",
      "description": "优先尽快跑通闭环",
      "badge": "推荐",
      "pros": ["交付快", "风险低"],
      "cons": ["扩展能力有限"]
    }
  ],
  "defaultValue": "fast"
}
```

卡片选项结构：

```ts
interface ComparisonCardOption {
  value: string;
  title: string;
  description?: string;
  badge?: string;
  pros?: string[];
  cons?: string[];
}
```

控件值仍是单个字符串。确认结果继续使用现有 `version: "1"` 协议：

```json
{
  "values": {
    "plan": "fast"
  }
}
```

## 与现有系统的关系

- `radio` 继续用于简短选项。
- `comparison_cards` 用于需要同时展示说明、优势和限制的方案。
- `comparison_cards` 可以作为单页控件，也可以加入多步骤向导。
- 它可以包含 `visibleWhen`，也可以作为后续条件控件的字符串来源。
- 摘要、结果过滤、取消、防重复提交和失败降级全部复用现有实现。

## 服务端约束

- 每组必须包含 2–6 张卡片。
- `value` 必填、唯一，长度为 1–120。
- `title` 必填，长度为 1–120。
- `description` 最长 400 字符。
- `badge` 最长 40 字符。
- `pros` 和 `cons` 各最多 5 项，每项长度为 1–120。
- `defaultValue` 必须引用当前卡片组选项。
- 条件运算只允许 `equals` 和 `not_equals`，条件值必须匹配现有卡片 `value`。
- 所有结构使用严格白名单，拒绝未知字段。
- 不接受图片 URL、HTML、JavaScript、CSS、表达式或外部资源。

## 模板

新增 `comparison` 模板，并将模板目录扩展为五项。模板必填参数：

- `interactionId`
- `options`

可选参数：

- `title`
- `description`
- `fieldLabel`
- `defaultValue`
- `required`
- `submitLabel`
- `cancelLabel`
- `summaryTitle`

默认值：

- 标题：`比较并选择一个方案`
- 字段标签：`方案比较`
- 必填：`true`
- 提交按钮：`确认方案`
- 取消按钮：`取消`
- 摘要标题：`当前选择`

模板生成一个 `comparison_cards` 控件和一个绑定该控件的安全摘要。

## Widget 行为

### 布局

- 桌面端根据宽度显示 2–3 列。
- 移动端使用单列，避免卡片内容被压缩。
- 卡片保持紧凑，不加入图片、渐变或装饰性大面积背景。

### 内容顺序

每张卡依次显示：

1. 可选 `badge`；
2. 标题；
3. 简短说明；
4. 可选“优势”列表；
5. 可选“限制”列表；
6. 明确的选择状态。

### 选择与可访问性

- 每张卡使用原生 radio input，同组共享控件 ID 作为 `name`。
- 整张卡是关联 label，可以点击任意区域选择。
- 键盘焦点使用清晰轮廓。
- 选中态同时使用边框、背景、单选状态和“已选择”文字，不只依赖颜色。
- `badge` 仅展示模型提供的中性标签，不自动选中卡片。

### 校验与提交

- 必填但未选择时，将整个卡片组标记为错误并聚焦第一张卡片。
- 选择变化后清除错误并刷新条件控件与摘要。
- 最终提交仍只返回选中卡片的 `value`。
- 在向导中只校验当前步骤；最终确认仍只提交一次。

## 测试策略

采用测试驱动开发。每项生产行为先由失败测试证明尚未实现，再写最小代码通过。

服务端测试覆盖：

- 合法 `comparison_cards` 配置；
- 默认值和选项唯一性；
- 卡片数量、字段长度和列表数量边界；
- 未知字段与 URL 字段拒绝；
- 作为 `visibleWhen` 字符串来源；
- 标准化保持卡片结构。

模板测试覆盖：

- 模板目录包含 `comparison`；
- 必填参数和默认文案；
- 默认值合法性；
- 模板输出通过统一交互 schema。

UI 与浏览器测试覆盖：

- 默认卡片选中；
- 点击整张卡片完成选择；
- 必填未选不能提交；
- 选择值进入摘要与结构化结果；
- 向导和条件控件兼容；
- 移动端单列与桌面端网格；
- 一次上下文更新和一次 follow-up message；
- 控制台无错误或警告。

## 发布与验收

- 包版本升级为 `0.10.0`。
- Widget resource URI 升级为 `ui://inbridge/interaction-v10.html`。
- 本地类型检查、全部测试、构建、MCP 冒烟和真实浏览器测试通过。
- 推送 `main` 后等待 GitHub CI、Vercel 生产部署和生产监控通过。
- 最后在 ChatGPT 中调用 `comparison` 模板，选择一个方案，确认模型准确读取方案值并继续任务。

## 验收标准

1. 模型可以通过严格 schema 声明 2–6 张比较卡片。
2. 卡片清晰展示标题、说明、优势、限制和标签。
3. 用户可通过鼠标、触摸和键盘完成单选。
4. 必填校验、默认值、摘要和提交结果正确。
5. 现有 radio、模板、条件控件和多步骤向导不回归。
6. 最终只触发一次结构化上下文更新和一次 follow-up message。
7. ChatGPT 能读取选中方案并继续当前任务。

## 非目标

- 多选方案组合。
- 拖拽排序或优先级排名。
- 图片、图标 URL 或富媒体卡片。
- 模型定义 HTML、CSS 或交互脚本。
- 自动替用户选择带“推荐”标签的方案。
