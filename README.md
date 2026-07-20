# InBridge

InBridge 是一个个人优先的 MCP App：当模型需要用户选择时，它在 ChatGPT 对话中显示内联交互控件，并把用户确认的结构化结果送回模型。

Phase 1 的最小真实闭环已经通过 ChatGPT Developer Mode 人工验收：

1. 模型调用 `render_interaction`；
2. ChatGPT 显示单选面板；
3. 用户选择并点击“确认并继续”；
4. Widget 调用 `updateModelContext` 写入完整结果；
5. Widget 调用 `sendMessage` 自动触发下一轮；
6. 模型读取选择并继续任务。

## 当前能力

- 无状态 streaming HTTP MCP endpoint：`POST /mcp`
- 健康检查：`GET /health`
- 标准 MCP Apps UI resource：`text/html;profile=mcp-app`
- 严格白名单 schema，支持 radio、checkbox_group、select、range、text、number、switch、color
- 安全声明式实时预览：theme_card、summary
- 必填校验与重复提交保护
- 确认与取消结果
- `updateModelContext` + `sendMessage` 双通道提交
- 上下文更新失败时，将压缩 JSON 放入 follow-up message
- 两条通道都失败时，显示可复制 JSON
- 根据 Host capabilities 检测上下文更新与消息能力
- 自动提交失败后可重试同一份冻结结果，不会重复读取或篡改表单值
- 取消结果使用独立消息，并始终清空未确认值
- 请求级 `X-Request-Id`、结构化生产日志和安全错误响应
- 64kb 请求上限、安全响应头与 Vercel `/mcp` IP 限流
- GitHub CI 发布门禁和每 6 小时生产全链路监控
- 模板发现工具：`list_interaction_templates`
- 模板渲染工具：`render_interaction_template`
- 内置 `decision`、`confirmation`、`experiment_config`、`theme_config` 四个严格模板
- 声明式条件控件：`equals`、`not_equals`、`includes`、`not_includes`
- 隐藏字段自动退出必填校验、提交结果和摘要

## 环境要求

- Node.js 22 或更高版本
- npm 11 或兼容版本
- 如需连接 ChatGPT：可访问 Developer Mode

## 生产服务

当前稳定部署地址：

- 健康检查：`https://mcp.example.com/health`
- MCP endpoint：`https://mcp.example.com/mcp`

服务部署在 Vercel Express Functions，代码仓库已与 Vercel 项目连接。发布生产版本：

```bash
vercel --prod
```

生产监控、日志排查与回滚方法见 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)。

模板参数和调用示例见 [`docs/TEMPLATES.md`](docs/TEMPLATES.md)。

## 本地运行

```bash
npm install
npm run build
npm start
```

默认监听 `http://localhost:3000`。可通过环境变量覆盖端口：

```bash
PORT=4100 npm start
```

Windows PowerShell：

```powershell
$env:PORT = "4100"
npm start
```

开发模式：

```bash
npm run build:ui
npm run dev
```

修改 UI 后需要重新运行 `npm run build:ui`，服务器会从 `dist/ui` 读取并内联 widget bundle。

## 验证

```bash
npm run typecheck
npm test
npm run build
npm run smoke
```

也可以让同一套烟雾测试直接核验生产服务：

```powershell
$env:INBRIDGE_BASE_URL = "https://mcp.example.com"
npm run smoke
```

烟雾测试会临时启动编译后的服务器，并真实执行：

- `GET /health`
- MCP initialize
- `tools/list`
- `tools/call`：调用 `render_interaction`
- `resources/read`：读取内联 widget

## 接入 ChatGPT Developer Mode

1. 在 ChatGPT 中打开 **Settings → Security and login → Developer mode**。
2. 前往 **Settings → Plugins**，创建或编辑 InBridge developer-mode app。
3. MCP server URL 填写 `https://mcp.example.com/mcp`。
4. 保存并刷新应用配置。
5. 新建对话并启用 InBridge，然后明确要求：

```text
请使用 InBridge 的 render_interaction，让我从方案 A、B、C 中选择一个。
```

预期结果：选择并确认后，无需手动再发消息，模型能说明用户选择并继续。

## Tool 输入示例

```json
{
  "interactionId": "plan_choice_001",
  "title": "请选择一个方案",
  "description": "确认后我会按该方案继续。",
  "controls": [
    {
      "id": "plan",
      "type": "radio",
      "label": "方案",
      "required": true,
      "options": [
        { "label": "方案 A", "value": "a" },
        { "label": "方案 B", "value": "b" },
        { "label": "方案 C", "value": "c" }
      ]
    }
  ],
  "submitLabel": "确认并继续",
  "cancelLabel": "取消"
}
```

## 项目结构

```text
src/server/   MCP server、schema、标准化逻辑
src/ui/       MCP Apps widget 与提交 bridge
scripts/      端到端烟雾测试
tests/        schema、标准化和结果协议测试
plan/         初始开发规格
```

完整设计见 [`plan/interactive-chat-ui-bridge-development-spec.md`](plan/interactive-chat-ui-bridge-development-spec.md)。

## 预览配置

`summary` 可实时显示全部控件，或通过“显示标签 → control id”绑定选择字段：

```json
{
  "type": "summary",
  "title": "当前配置",
  "bindings": {
    "研究方向": "direction",
    "训练预算": "budget"
  }
}
```

`theme_card` 只接受四种受控绑定：`primaryColor`、`brightness`、`density`、`style`。绑定必须引用类型兼容的现有控件。

```json
{
  "type": "theme_card",
  "title": "示例标题",
  "body": "根据参数实时更新的安全示例卡片。",
  "bindings": {
    "primaryColor": "primary_color",
    "brightness": "brightness",
    "density": "density",
    "style": "style"
  }
}
```

## 当前阶段边界

Phase 8 已完成安全条件控件和实验模板中的“消融实验 → 消融变量”联动。当前版本仍不接受模型提供的 HTML、JavaScript、CSS、表达式或外部 URL。

## 提交结果状态

Widget 内部区分四种可测试结果：

- `sent_with_context`：结构化上下文与触发消息都成功；
- `sent_with_inline_result`：上下文不可用，完整 JSON 随触发消息发送；
- `context_only`：结果已写入上下文，但消息触发失败，UI 提供重试；
- `manual_copy`：Host 两项能力都不可用，UI 提供重试和复制 JSON。

提交开始后表单值会被冻结。同一时刻只允许一个提交请求；只有 Host 确认消息成功后，组件才进入不可重复提交的完成态。
