import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WIDGET_URI } from "../src/server/mcp.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3100 + Math.floor(Math.random() * 500);
const remoteBaseUrl = process.env.INBRIDGE_BASE_URL?.replace(/\/$/, "");
const baseUrl = remoteBaseUrl ?? `http://127.0.0.1:${port}`;
const server = remoteBaseUrl
  ? undefined
  : spawn(process.execPath, [path.join(projectRoot, "dist/server/index.js")], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    });

let stderr = "";
server?.stderr?.on("data", (chunk) => {
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

const client = new Client({ name: "inbridge-smoke-test", version: "0.10.0" });

try {
  await waitForHealth();
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);

  const tools = await client.listTools();
  assert(tools.tools.some((tool) => tool.name === "render_interaction"));
  assert(tools.tools.some((tool) => tool.name === "list_interaction_templates"));
  assert(tools.tools.some((tool) => tool.name === "render_interaction_template"));

  const catalogResult = await client.callTool({
    name: "list_interaction_templates",
    arguments: {}
  });
  const catalog = catalogResult.structuredContent as { templates?: Array<{ id?: string }> } | undefined;
  assert.deepEqual(
    catalog?.templates?.map((template) => template.id),
    ["decision", "confirmation", "experiment_config", "theme_config", "comparison"]
  );

  const comparisonResult = await client.callTool({
    name: "render_interaction_template",
    arguments: {
      templateId: "comparison",
      interactionId: "smoke_comparison",
      options: [
        { value: "fast", title: "Fast", pros: ["Quick"] },
        { value: "safe", title: "Safe", cons: ["Slower"] }
      ],
      defaultValue: "safe"
    }
  });
  assert.equal(comparisonResult.isError, undefined);
  const comparisonControl = (comparisonResult.structuredContent as {
    controls?: Array<{ type?: string; defaultValue?: string }>;
  }).controls?.[0];
  assert.equal(comparisonControl?.type, "comparison_cards");
  assert.equal(comparisonControl?.defaultValue, "safe");

  const templateResult = await client.callTool({
    name: "render_interaction_template",
    arguments: {
      templateId: "experiment_config",
      interactionId: "smoke_experiment",
      defaultDirection: "marl",
      defaultEnvironments: ["cartpole"],
      defaultBudget: 75,
      defaultSeedCount: 8,
      defaultAblationVariables: ["network_architecture"]
    }
  });
  assert.equal(templateResult.isError, undefined);
  assert.equal((templateResult.structuredContent as { interactionId?: string })?.interactionId, "smoke_experiment");
  assert.equal((templateResult.structuredContent as { controls?: unknown[] })?.controls?.length, 9);
  assert.deepEqual(
    (templateResult.structuredContent as { steps?: Array<{ id?: string }> }).steps?.map((step) => step.id),
    ["basics", "training", "ablation_review"]
  );
  const templateControls = (templateResult.structuredContent as {
    controls?: Array<{ id?: string; visibleWhen?: { controlId?: string; operator?: string; value?: unknown } }>;
  }).controls;
  assert.deepEqual(templateControls?.find((control) => control.id === "ablation_variables")?.visibleWhen, {
    controlId: "ablation",
    operator: "equals",
    value: true
  });

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
        },
        {
          id: "topics",
          type: "checkbox_group",
          label: "方向",
          options: [
            { label: "RL", value: "rl" },
            { label: "MARL", value: "marl" }
          ]
        },
        {
          id: "density",
          type: "select",
          label: "密度",
          options: [
            { label: "低", value: "low" },
            { label: "高", value: "high" }
          ]
        },
        { id: "brightness", type: "range", label: "明暗", min: 0, max: 100 },
        { id: "note", type: "text", label: "备注" },
        { id: "seeds", type: "number", label: "种子数", min: 1, max: 20 },
        { id: "ablation", type: "switch", label: "消融实验" },
        { id: "primary", type: "color", label: "主色" }
      ],
      preview: {
        type: "summary",
        title: "当前配置",
        bindings: {
          方案: "plan",
          方向: "topics",
          明暗: "brightness",
          主色: "primary"
        }
      }
    }
  });

  assert.equal(result.isError, undefined);
  assert.equal((result.structuredContent as { interactionId?: string })?.interactionId, "smoke_choice");
  assert.equal((result.structuredContent as { controls?: unknown[] })?.controls?.length, 8);

  const resource = await client.readResource({ uri: WIDGET_URI });
  const widget = resource.contents[0];
  assert(widget);
  assert.equal(widget.mimeType, "text/html;profile=mcp-app");
  assert("text" in widget && widget.text.includes("<script>") && widget.text.length > 1_000);
  assert.equal(
    (widget._meta as { ui?: { domain?: string } } | undefined)?.ui?.domain,
    "https://mcp.example.com"
  );

  console.log(
    "Smoke test passed: health, template discovery, template rendering, custom rendering, and resources/read are operational."
  );
} finally {
  await client.close().catch(() => undefined);
  server?.kill();
}
