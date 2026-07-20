import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3100 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(projectRoot, "dist/server/index.js")], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The child process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy. ${stderr}`);
}

const client = new Client({ name: "inbridge-smoke-test", version: "0.1.0" });

try {
  await waitForHealth();
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);

  const tools = await client.listTools();
  assert(tools.tools.some((tool) => tool.name === "render_interaction"));

  const result = await client.callTool({
    name: "render_interaction",
    arguments: {
      interactionId: "smoke_choice",
      title: "选择一个方案",
      controls: [
        {
          id: "plan",
          type: "radio",
          label: "方案",
          required: true,
          options: [
            { label: "方案 A", value: "a" },
            { label: "方案 B", value: "b" }
          ]
        }
      ]
    }
  });

  assert.equal(result.isError, undefined);
  assert.equal((result.structuredContent as { interactionId?: string })?.interactionId, "smoke_choice");

  const resource = await client.readResource({ uri: "ui://inbridge/interaction-v1.html" });
  const widget = resource.contents[0];
  assert(widget);
  assert.equal(widget.mimeType, "text/html;profile=mcp-app");
  assert("text" in widget && widget.text.includes("<script>") && widget.text.length > 1_000);

  console.log("Smoke test passed: health, tools/list, tools/call, and resources/read are operational.");
} finally {
  await client.close().catch(() => undefined);
  server.kill();
}
