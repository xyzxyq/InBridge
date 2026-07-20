# Interactive Choice Bridge（ICB）开发设计文档

> 版本：v0.1 Draft  
> 日期：2026-07-20  
> 状态：待用户审核  
> 目标平台：ChatGPT Web（Developer Mode）  
> 技术标准：MCP + MCP Apps UI  

---

## 1. 项目摘要

Interactive Choice Bridge（以下简称 **ICB**）是一个面向 ChatGPT 对话的通用交互桥。

它解决的问题是：模型在对话中需要用户做选择时，不再只能输出纯文本选项，而是可以调用一个 MCP Tool，在 ChatGPT 对话中渲染真实的交互 UI，例如：

- 单选框
- 多选框
- 下拉菜单
- 滑块
- 文本输入框
- 数字输入框
- 开关
- 颜色选择器
- 可选的实时预览区域
- “确认并继续”按钮

用户完成操作后，UI 将选择结果传回 ChatGPT 的模型上下文，并发送一条用户侧 follow-up message 触发下一轮模型响应，使模型能够**真正读取用户刚刚的操作结果并继续执行任务**。

核心体验：

```text
ChatGPT 判断“这里需要用户确认”
        ↓
调用 render_interaction MCP Tool
        ↓
ChatGPT 内联渲染交互面板
        ↓
用户操作控件
        ↓
点击“确认并继续”
        ↓
UI 更新模型上下文 + 发送 follow-up message
        ↓
模型读取结构化选择结果
        ↓
继续当前任务
```

本项目第一阶段只做一件事：

> **把“模型提出选择”与“用户操作结果返回模型”连成一个可靠的闭环。**

---

## 2. 项目目标

### 2.1 必须实现

1. ChatGPT 模型可以通过 MCP Tool 动态定义一次交互。
2. 交互 UI 直接显示在 ChatGPT 网页端对话中。
3. UI 支持常见表单控件。
4. 用户的操作结果必须以结构化数据返回模型。
5. 点击“确认并继续”后，应自动触发下一轮模型响应，而不是要求用户再手动输入一句话。
6. App 必须保持通用，不与 PPT、科研、学习等某个具体业务绑定。
7. 所有 UI 配置必须经过白名单 schema 校验，模型不能注入任意 HTML/JS。
8. V1 不保存长期用户数据，不建立数据库。
9. V1 不需要用户账户系统。
10. V1 代码应能够本地开发，并能部署到一个稳定 HTTPS MCP endpoint。

### 2.2 非目标（V1 不做）

1. 不实现完整的低代码 UI Builder。
2. 不允许模型直接提交任意 JavaScript。
3. 不实现跨用户协同。
4. 不建立复杂后端数据库。
5. 不替代 ChatGPT 自身的文件生成、PPTX 生成或其他工具。
6. 不做独立网站。
7. 不做复杂多页面应用。
8. 不在 V1 中实现真正的 PPTX 渲染器。

---

## 3. 典型使用场景

### 3.1 PPTX 风格确认

模型需要确认：

- 风格：极简 / 科技 / 学术 / 商务 / 杂志
- 主色
- 明暗
- 饱和度
- 信息密度

ICB 渲染：

- 下拉菜单：风格
- 颜色选择器：主色
- 滑块：明暗
- 滑块：饱和度
- 单选：信息密度
- 预览区域：根据参数实时改变示例卡片

用户点击确认后，模型收到：

```json
{
  "interaction_id": "ppt_style_001",
  "status": "confirmed",
  "values": {
    "style": "tech",
    "primary_color": "#6D5DFB",
    "brightness": 38,
    "saturation": 72,
    "density": "medium"
  }
}
```

随后模型继续制作 PPTX。

### 3.2 强化学习学习路径

模型渲染：

- 当前基础：入门 / 有基础 / 可读论文
- 目标：理论 / 算法 / 复现 / 投稿
- 每周时间投入滑块
- 感兴趣方向多选

确认后，模型根据结构化结果生成学习计划。

### 3.3 实验配置

模型渲染：

- 环境多选
- seed 数量
- 训练步数
- GPU 预算
- 是否开启 ablation

用户确认后，模型生成实验计划或配置文件。

---

## 4. 技术架构

### 4.1 总体架构

```text
┌──────────────────────────────────────────────┐
│                ChatGPT Web                   │
│                                              │
│  ┌───────────────┐      ┌─────────────────┐  │
│  │ ChatGPT Model │      │ MCP Apps iframe │  │
│  └───────┬───────┘      │  Interactive UI │  │
│          │              └────────┬────────┘  │
│          │ MCP tool call         │ ui/* bridge│
└──────────┼───────────────────────┼────────────┘
           │                       │
           ▼                       │
┌──────────────────────────────────┴────────────┐
│             ICB MCP Server                    │
│                                               │
│  - render_interaction tool                    │
│  - schema validation                          │
│  - UI resource registration                   │
│  - optional logging / health check            │
└───────────────────────────────────────────────┘
```

### 4.2 三层职责

#### A. ChatGPT 模型

负责：

- 判断何时需要交互确认
- 生成交互配置
- 调用 `render_interaction`
- 在用户确认后读取结果
- 继续任务

不负责：

- 执行 UI JavaScript
- 维护 UI 局部状态

#### B. MCP Server

负责：

- 暴露 MCP Tool
- 校验输入 schema
- 标准化配置
- 注册 UI resource
- 返回 structuredContent

V1 为无状态服务器。

#### C. MCP Apps UI

负责：

- 接收 tool input / tool result
- 动态渲染白名单控件
- 本地维护用户输入状态
- 实时预览
- 校验必填项
- 确认后同步模型上下文
- 发送 follow-up message

---

## 5. 技术选型

### 5.1 推荐栈

- Node.js 22+
- TypeScript
- `@modelcontextprotocol/sdk`
- `@modelcontextprotocol/ext-apps`
- Zod
- Vite
- Vanilla TypeScript UI

### 5.2 为什么 V1 不使用 React

V1 的 UI 本质是动态表单和本地状态管理，复杂度有限。Vanilla TypeScript：

- 依赖更少
- bundle 更小
- 调试链更短
- MCP UI 示例更容易审计

若 V2 引入复杂实时预览、组件编排或画布，可再迁移 React。

---

## 6. MCP Tool 设计

V1 只公开一个核心 Tool：

```text
render_interaction
```

### 6.1 Tool 的职责

模型调用该工具，传入一次交互的完整声明式配置。

服务器：

1. 验证 schema；
2. 过滤未知字段；
3. 标准化默认值；
4. 返回 UI resource + structuredContent；
5. ChatGPT 渲染 iframe。

### 6.2 Tool 描述建议

```text
Render an interactive decision or configuration panel for the user inside the chat.
Use this tool when the user needs to choose, configure, compare, confirm, or enter a small amount of structured information and an interactive UI is more effective than asking for a plain-text reply.
Do not use it for simple yes/no questions unless visual confirmation materially helps.
```

### 6.3 输入 Schema

```ts
interface InteractionConfig {
  interactionId: string;
  title: string;
  description?: string;
  controls: Control[];
  submitLabel?: string;
  cancelLabel?: string;
  preview?: PreviewConfig;
  metadata?: Record<string, string | number | boolean>;
}
```

### 6.4 Control 联合类型

```ts
type Control =
  | RadioControl
  | CheckboxGroupControl
  | SelectControl
  | RangeControl
  | TextControl
  | NumberControl
  | SwitchControl
  | ColorControl;
```

所有控件共享：

```ts
interface BaseControl {
  id: string;
  type: string;
  label: string;
  description?: string;
  required?: boolean;
}
```

#### radio

```json
{
  "id": "style",
  "type": "radio",
  "label": "整体风格",
  "required": true,
  "options": [
    { "label": "极简", "value": "minimal" },
    { "label": "科技", "value": "tech" },
    { "label": "学术", "value": "academic" }
  ],
  "defaultValue": "academic"
}
```

#### checkbox_group

```json
{
  "id": "topics",
  "type": "checkbox_group",
  "label": "感兴趣方向",
  "options": [
    { "label": "MARL", "value": "marl" },
    { "label": "RL", "value": "rl" }
  ],
  "defaultValue": ["marl"]
}
```

#### select

```json
{
  "id": "density",
  "type": "select",
  "label": "信息密度",
  "options": [
    { "label": "低", "value": "low" },
    { "label": "中", "value": "medium" },
    { "label": "高", "value": "high" }
  ]
}
```

#### range

```json
{
  "id": "brightness",
  "type": "range",
  "label": "明暗",
  "min": 0,
  "max": 100,
  "step": 1,
  "defaultValue": 50,
  "showValue": true
}
```

#### text

```json
{
  "id": "note",
  "type": "text",
  "label": "补充要求",
  "placeholder": "可选"
}
```

#### number

```json
{
  "id": "seed_count",
  "type": "number",
  "label": "随机种子数量",
  "min": 1,
  "max": 20,
  "step": 1,
  "defaultValue": 5
}
```

#### switch

```json
{
  "id": "enable_ablation",
  "type": "switch",
  "label": "开启消融实验",
  "defaultValue": true
}
```

#### color

```json
{
  "id": "primary_color",
  "type": "color",
  "label": "主色",
  "defaultValue": "#6D5DFB"
}
```

---

## 7. 输出结果协议

用户确认后，UI 构造：

```ts
interface InteractionResult {
  version: "1";
  interactionId: string;
  status: "confirmed" | "cancelled";
  values: Record<string, unknown>;
  submittedAt: string;
}
```

示例：

```json
{
  "version": "1",
  "interactionId": "ppt_style_001",
  "status": "confirmed",
  "values": {
    "style": "tech",
    "primary_color": "#6D5DFB",
    "brightness": 38,
    "density": "medium"
  },
  "submittedAt": "2026-07-20T07:20:00.000Z"
}
```

### 7.1 推荐的提交策略

确认按钮点击后：

1. `updateModelContext(...)` 写入完整结构化结果；
2. 等待成功；
3. `sendMessage(...)` 发送简短用户消息触发下一轮；
4. UI 切换到“已提交”状态，防止重复提交。

建议 follow-up message：

```text
我已确认上面的交互选择。请读取该交互组件同步的结构化结果并继续当前任务。
```

不把大量 JSON 全塞进可见聊天消息；完整结果放在 model context 中。

### 7.2 降级策略

若 `updateModelContext` 失败：

- 直接在 `sendMessage` 中附带压缩后的 JSON。

若 `sendMessage` 失败：

- UI 显示“结果已保存到模型上下文，请发送任意消息继续”。

若两者都失败：

- UI 显示可复制的 JSON 结果。

---

## 8. UI 行为规范

### 8.1 初始态

显示：

- 标题
- 可选描述
- 控件
- 预览（如有）
- 确认按钮
- 取消按钮（可选）

### 8.2 输入态

- 所有交互只在 iframe 本地发生
- 滑块/颜色/选项变化实时刷新预览
- 不在每一次变化时调用模型，避免产生大量对话和网络开销

### 8.3 提交态

点击确认：

- 校验 required
- 禁用提交按钮
- 显示 submitting 状态
- 同步 model context
- 发送 follow-up message
- 成功后显示 confirmed 状态

### 8.4 防重复提交

提交成功后：

```ts
submitted = true
```

再次点击无效。

### 8.5 取消

取消结果：

```json
{
  "status": "cancelled"
}
```

并发送 follow-up：

```text
我取消了这次交互选择，请不要基于未确认的选项继续执行。
```

---

## 9. 实时预览设计

V1 只支持**安全、有限、声明式预览**。

### 9.1 PreviewConfig

```ts
interface PreviewConfig {
  type: "theme_card" | "summary" | "none";
  bindings?: Record<string, string>;
}
```

### 9.2 theme_card

用于 PPT / 文档风格选择。

预览可以绑定：

- primary_color
- brightness
- density
- style

但只能改变：

- CSS variables
- 排版密度
- 圆角
- 示例标题/正文布局

模型不能注入 CSS 或 HTML。

### 9.3 后续扩展

V2 可以新增：

- slide_mock
- chart_preview
- layout_preview
- comparison_preview

仍应采用白名单 renderer。

---

## 10. 模型调用策略

ICB 的 Tool description 应明确：

### 建议调用

- 用户需要从多个方案中选择
- 需要多参数配置
- 需要实时预览
- 需要结构化输入
- 用户明确偏好交互式方式
- 一次性表单比多轮追问更高效

### 不建议调用

- 只有一个简单事实问题
- 一句自然语言即可回答
- 需要长篇自由文本创作
- 用户已经给出明确参数
- 用户明确要求纯文本

### 推荐触发原则

```text
交互 UI 的价值 > UI 带来的额外复杂度
```

---

## 11. 数据流

### 11.1 创建交互

```text
User prompt
   ↓
ChatGPT model
   ↓ render_interaction(config)
MCP Server
   ↓ normalized structuredContent
ChatGPT host
   ↓ iframe + tool input/result
ICB UI
```

### 11.2 返回选择

```text
User changes controls
   ↓
Local UI state
   ↓ Confirm
updateModelContext(result)
   ↓
sendMessage(trigger)
   ↓
ChatGPT model next turn
   ↓
Read interaction result
   ↓
Continue task
```

---

## 12. 服务器端设计

### 12.1 Endpoint

```text
POST /mcp
GET  /health
```

生产环境：

```text
https://<domain>/mcp
```

### 12.2 无状态原则

V1 不保存：

- 用户选择
- ChatGPT 对话
- 用户账号
- 文件
- 历史记录

所有选择只存在于：

1. iframe 当前内存状态；
2. ChatGPT model context / conversation。

### 12.3 日志

生产日志只记录：

- request id
- tool name
- response status
- latency
- schema validation error

默认不记录 control values。

---

## 13. 安全设计

### 13.1 最大原则

**模型只能声明 UI，不允许模型编写 UI 代码。**

禁止 Tool 参数包含：

- HTML
- JavaScript
- CSS
- iframe URL
- script URL
- 任意网络请求配置

### 13.2 Schema 白名单

所有 control.type 必须在固定 enum 中。

未知字段使用 strict schema 拒绝或 strip。

### 13.3 输入限制

建议：

- title <= 120 chars
- description <= 800 chars
- controls <= 20
- option count <= 50 / control
- text maxLength <= 2000
- interaction payload <= 64 KB

### 13.4 URL 与外部资源

V1 不允许动态外部 URL。

### 13.5 敏感操作

ICB 本身只负责收集选择，不执行购买、删除、发送邮件等外部副作用操作。

如果未来加入 action tool，应独立设计权限和确认机制。

---

## 14. 推荐项目结构

```text
interactive-choice-bridge/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── .env.example
├── src/
│   ├── server/
│   │   ├── index.ts
│   │   ├── mcp.ts
│   │   ├── schemas.ts
│   │   └── normalize.ts
│   └── ui/
│       ├── main.ts
│       ├── bridge.ts
│       ├── state.ts
│       ├── render-control.ts
│       ├── preview.ts
│       └── styles.css
├── public/
│   └── widget.html
├── dist/
├── tests/
│   ├── schema.test.ts
│   ├── normalize.test.ts
│   └── interaction-result.test.ts
└── scripts/
    └── smoke-test.ts
```

---

## 15. 核心模块

### 15.1 `schemas.ts`

定义：

- InteractionConfigSchema
- ControlSchema discriminated union
- PreviewConfigSchema
- InteractionResultSchema

### 15.2 `normalize.ts`

负责：

- 默认 submitLabel
- 默认 required=false
- range 默认 step
- 清洗重复 control id
- 验证 defaultValue 是否合法

### 15.3 `mcp.ts`

注册：

- app resource
- `render_interaction` tool

Tool handler 不做业务逻辑，只 validate + normalize + echo structuredContent。

### 15.4 `bridge.ts`

封装：

- 初始化 MCP Apps App / postMessage transport
- 接收 tool input/result
- updateModelContext
- sendMessage
- error handling

UI 其他模块不直接操作 bridge API。

### 15.5 `render-control.ts`

按 control.type 渲染对应原生 HTML 控件。

### 15.6 `preview.ts`

根据 preview.type 调用固定 renderer。

---

## 16. 错误处理

### 16.1 Tool 输入非法

服务器返回明确错误：

```text
Invalid interaction config: controls[2].min must be <= max
```

### 16.2 UI 初始化失败

UI 显示：

```text
交互组件初始化失败，请在对话中改用文本方式继续。
```

### 16.3 提交失败

提供重试按钮。

### 16.4 Host 不支持某能力

能力检测：

- 能 update model context：使用
- 能 send message：使用
- 两者不能同时使用：降级

---

## 17. 测试计划

### 17.1 Unit Tests

必须覆盖：

- 每种 control schema 正常输入
- 错误类型
- 重复 id
- 非法 defaultValue
- range 边界
- max controls
- option count
- payload size

### 17.2 UI Tests

验证：

- 每个控件正常渲染
- 默认值正确
- required 校验
- range 实时显示
- preview 更新
- confirm 防重复提交
- cancel
- bridge error fallback

### 17.3 MCP Inspector

检查：

- tools/list
- resources
- render_interaction tool call
- structuredContent
- UI resource MIME type

### 17.4 ChatGPT Web E2E

必须人工验证：

#### Case A：单选

Prompt：

```text
请用 Interactive Choice Bridge 让我选择 A/B/C 三个方案。
```

验收：

- ChatGPT 调用 tool
- UI 出现
- 选择 B
- 点击确认
- 下一轮模型明确知道 B

#### Case B：多控件

- radio
- range
- color
- switch

验收：全部值正确返回。

#### Case C：取消

验收：模型不把默认值误认为用户确认。

#### Case D：重复提交

验收：只触发一次后续消息。

#### Case E：模型上下文更新失败

验收：sendMessage JSON fallback 正常。

---

## 18. 验收标准（Definition of Done）

V1 只有同时满足以下条件才算完成：

1. MCP Server 可在本地启动。
2. `/mcp` 可被 MCP Inspector 正常识别。
3. ChatGPT Developer Mode 能成功连接。
4. 模型能调用 `render_interaction`。
5. ChatGPT 对话中出现内联 UI。
6. 至少支持 radio、checkbox_group、select、range、text、number、switch、color。
7. UI 配置全部由 schema 驱动。
8. 模型无法通过 tool 参数注入 HTML/JS。
9. 用户点击确认后，下一轮模型能准确读取所有选择。
10. 用户不需要额外手动输入“我选好了”。
11. 取消操作可被模型区分。
12. 提交失败有明确降级路径。
13. 本地测试通过。
14. 部署到 HTTPS 后，Mac 关闭仍可使用。
15. README 包含安装、开发、部署、连接 ChatGPT、故障排查说明。

---

## 19. 开发阶段划分

### Phase 0：脚手架

目标：跑通 MCP Server + 空白 UI。

产物：

- Node/TS 项目
- `/mcp`
- UI resource
- health endpoint

### Phase 1：最小闭环

只做：

- radio
- confirm
- updateModelContext
- sendMessage

验收：点击一个选项后模型自动知道选择并继续。

> Phase 1 是全项目最关键的里程碑。只有此闭环验证成功，才继续开发。

### Phase 2：通用控件

新增：

- checkbox_group
- select
- range
- text
- number
- switch
- color

### Phase 3：安全预览

新增：

- theme_card
- summary

### Phase 4：健壮性

新增：

- fallback
- duplicate protection
- validation UX
- error messages
- capability detection

### Phase 5：部署

流程：

```text
Local
  ↓
Tunnel test
  ↓
ChatGPT Developer Mode E2E
  ↓
Cloud deployment
  ↓
Fixed HTTPS /mcp endpoint
```

---

## 20. 推荐部署策略

### 开发阶段

- 本地 Node.js
- Secure MCP Tunnel / Cloudflare Tunnel / ngrok

### 正式个人使用

选择支持长期 Node HTTP 服务或 MCP 部署的平台。

要求：

- HTTPS
- 支持 streaming HTTP（或 ChatGPT 当前支持的 MCP transport）
- 稳定公网域名
- 可查看日志
- 可配置环境变量

V1 服务无数据库、无高计算负载，因此资源需求极低。

---

## 21. 关键平台事实与实现约束

1. ChatGPT 的 MCP Apps UI 运行在 iframe 中，并通过标准 `ui/*` JSON-RPC / `postMessage` bridge 与 Host 通信。
2. 新 App 应优先使用 MCP Apps 标准 bridge；需要 ChatGPT 特有能力时再使用 `window.openai` 扩展。
3. MCP Apps 标准提供从 UI 调用 server tool、发送 follow-up message、更新 model-visible context 的能力。
4. `updateModelContext` 用于让模型在后续 turn 看到 UI 状态，但本身不立即触发模型响应。
5. `sendMessage` 可以向 host chat 添加用户角色消息，因此可用于“确认并继续”的自动触发。
6. 开发者模式下，远程 MCP Server 需要可由 ChatGPT 访问；正式连接通常使用公网 HTTPS `/mcp` endpoint。

这些事实是本项目可行性的基础。

---

## 22. 主要风险

### 风险 1：模型不主动调用 Tool

缓解：

- 优化 tool name / description
- App description 明确“选择、配置、确认时使用”
- 用户自定义指令中写明偏好

### 风险 2：模型调用 Tool，但 schema 过复杂

缓解：

- V1 schema 保持小而稳定
- 使用 discriminated union
- 控件上限 20

### 风险 3：Host 行为变化

缓解：

- 优先 MCP Apps 标准
- 封装 bridge adapter
- 不在业务代码中散布 `window.openai`

### 风险 4：UI 结果只更新上下文但没有触发响应

缓解：

- 固定顺序：updateModelContext → sendMessage

### 风险 5：用户选择未完整传递

缓解：

- 结构化 `InteractionResult`
- result versioning
- E2E assertion

### 风险 6：模型生成恶意或错误 UI 配置

缓解：

- 严格 schema
- 不接受 HTML/JS/CSS
- 限制长度与数量

---

## 23. V2 路线图

在 V1 稳定后再考虑：

### 23.1 Conditional Controls

例如：

```text
开启“消融实验”
  ↓
才显示“消融变量”多选
```

### 23.2 多步骤 Wizard

适合：

- 论文实验设计
- PPTX 风格配置
- 旅行方案

### 23.3 Comparison Cards

模型给出 3 个方案，用户通过卡片直接比较和选择。

### 23.4 Rich Preview

- slide preview
- chart preview
- document preview

### 23.5 Presets

例如：

- 彭于晏 PPT 偏好
- 科研实验默认配置

但长期偏好应谨慎保存，且需要显式用户确认。

---

## 24. 审核时最需要确认的 6 个决策

### D1. 项目定位

建议：只做“通用交互桥”，不绑定具体业务。

### D2. 技术路线

建议：TypeScript + Node + MCP Apps 标准 + Vanilla UI。

### D3. V1 Tool 数量

建议：只有 `render_interaction` 一个核心 tool。

### D4. 返回模型的机制

建议：`updateModelContext` + `sendMessage` 双通道。

### D5. 安全边界

建议：模型只能传声明式 JSON schema，绝不允许传 HTML/JS/CSS。

### D6. 第一里程碑

建议：先只做“单选 + 确认 + 模型自动继续”的闭环 PoC；成功后再扩展全部控件。

---

## 25. 建议执行顺序

```text
1. 创建仓库
2. 安装 MCP SDK / ext-apps / zod
3. 搭建 /mcp
4. 注册 UI resource
5. 实现 render_interaction 最简 schema
6. UI 渲染 radio
7. 接入 MCP Apps bridge
8. 点击确认：updateModelContext
9. 紧接 sendMessage
10. Tunnel 暴露 HTTPS
11. ChatGPT Developer Mode 连接
12. 验证模型是否自动读取选择
-----------------------------
关键 Gate：闭环成功？
-----------------------------
13. 扩展 7 种控件
14. 加 preview
15. 加 fallback / error handling
16. 自动化测试
17. 云端部署
18. 固定 URL 接入 ChatGPT
```

---

## 26. 最终建议

本项目应该避免一开始做成“大而全的交互系统”。

最合理的工程策略是：

> **先证明一件事：用户在 ChatGPT 内联 UI 里点选后，模型可以自动读取结果并继续。**

这个闭环一旦跑通，后续增加单选、多选、滑块、颜色选择、实时预览，本质都是 UI 层扩展。

因此建议以 Phase 1 为第一个强制验收 Gate，在它通过之前，不开发复杂预览和高级控件。

---

## 27. 参考资料

- OpenAI Developers — Apps SDK / MCP Apps compatibility in ChatGPT
  https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt
- OpenAI Developers — Build your MCP server
  https://developers.openai.com/apps-sdk/build/mcp-server
- OpenAI Developers — Connect from ChatGPT
  https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- OpenAI Developers — ChatGPT Developer mode
  https://developers.openai.com/api/docs/guides/developer-mode
- Model Context Protocol — ext-apps official repository
  https://github.com/modelcontextprotocol/ext-apps
- MCP Apps API — App.updateModelContext / App.sendMessage
  https://apps.extensions.modelcontextprotocol.io/api/classes/app.App.html
