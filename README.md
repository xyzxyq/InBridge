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
- 必填校验与重复提交保护
- 确认与取消结果
- `updateModelContext` + `sendMessage` 双通道提交
- 上下文更新失败时，将压缩 JSON 放入 follow-up message
- 两条通道都失败时，显示可复制 JSON

## 环境要求

- Node.js 22 或更高版本
- npm 11 或兼容版本
- 如需连接 ChatGPT：可访问 Developer Mode，并准备一个 HTTPS tunnel

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

烟雾测试会临时启动编译后的服务器，并真实执行：

- `GET /health`
- MCP initialize
- `tools/list`
- `tools/call`：调用 `render_interaction`
- `resources/read`：读取内联 widget

## 接入 ChatGPT Developer Mode

1. 本地完成 `npm run build && npm start`。
2. 使用 Secure MCP Tunnel、ngrok 或 Cloudflare Tunnel 暴露 `http://localhost:3000`。
3. 在 ChatGPT 中打开 **Settings → Security and login → Developer mode**。
4. 前往 **Settings → Plugins**，创建 developer-mode app。
5. MCP server URL 填写 `https://<你的域名>/mcp`。
6. 新建对话并启用 InBridge，然后明确要求：

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

## 当前阶段边界

Phase 2 已实现全部八种 V1 控件。安全声明式预览（`theme_card`、`summary`）仍属于 Phase 3，当前版本不接受模型提供的 HTML、JavaScript、CSS 或外部 URL。
