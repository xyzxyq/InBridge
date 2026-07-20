# InBridge 生产运维手册

## 固定端点

- Health：`https://mcp.example.com/health`
- MCP：`https://mcp.example.com/mcp`
- Vercel 项目：`your-vercel-project`

## 发布门禁

所有 push 和 pull request 都会运行 GitHub Actions `CI`：

1. `npm ci`
2. `npm run verify`
3. `npm run build`

Vercel 的生产构建也会先运行 `npm run verify`，测试失败的提交不会替换生产部署。

## 生产监控

GitHub Actions `Production monitor` 每 6 小时执行一次完整远程烟雾测试，也可以在 Actions 页面手动触发。它真实检查：

- `GET /health`
- MCP initialize
- `tools/list`
- `render_interaction`
- `resources/read` 和 Widget 元数据

本地手动检查：

```powershell
$env:INBRIDGE_BASE_URL = "https://mcp.example.com"
npm run smoke
```

## 日志排查

请求日志采用 JSON Lines，并通过 `requestId` 关联开始、完成和错误事件。日志不写入 MCP 请求正文或用户选择。

```powershell
vercel logs https://mcp.example.com --level error --since 1h
```

如用户提供响应头 `X-Request-Id`，可在 Vercel Runtime Logs 中按该值检索。

## 回滚

查看近期部署：

```powershell
vercel list inbridge
```

立即回滚到上一生产部署：

```powershell
vercel rollback
```

或将已验证的指定部署重新指向生产域名：

```powershell
vercel promote <deployment-url>
```

回滚后必须再次运行远程烟雾测试。

## Firewall

`/mcp` 使用 Vercel Firewall 的固定窗口 IP 限流。不要启用全站 Bot Challenge 或 AI Bot Blocking；ChatGPT 本身是机器客户端，这类规则可能阻断合法 MCP 调用。
