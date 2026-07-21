import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { normalizeInteraction } from "./normalize.js";
import { interactionConfigSchema, normalizedInteractionSchema } from "./schemas.js";
import { resolvePublicBaseUrl } from "./public-url.js";
import {
  buildInteractionTemplate,
  interactionTemplateRequestSchema,
  interactionTemplateToolInputSchema,
  TEMPLATE_CATALOG,
  templateCatalogOutputSchema
} from "./templates.js";

export const WIDGET_URI = "ui://inbridge/interaction-v12.html";
export const PUBLIC_BASE_URL = resolvePublicBaseUrl();
export const APP_ICON_URL = `${PUBLIC_BASE_URL}/icon.png?v=2`;

const RENDER_TOOL_META = {
  ui: { resourceUri: WIDGET_URI, visibility: ["model", "app"] as Array<"model" | "app"> },
  "openai/outputTemplate": WIDGET_URI,
  "openai/visibility": "public",
  "openai/toolInvocation/invoking": "正在准备交互选项…",
  "openai/toolInvocation/invoked": "交互选项已准备好"
};

const LEGACY_RENDER_TOOL_META = {
  ...RENDER_TOOL_META,
  ui: { resourceUri: WIDGET_URI, visibility: ["app"] as Array<"app"> },
  "openai/visibility": "private"
};

const RENDER_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true
};

const APP_ICONS = [
  {
    src: APP_ICON_URL,
    mimeType: "image/png",
    sizes: ["981x1040"]
  }
];

const projectRoot = process.cwd();

async function loadWidgetHtml(): Promise<string> {
  const [javascript, css] = await Promise.all([
    readFile(path.join(projectRoot, "dist/ui/widget.js"), "utf8"),
    readFile(path.join(projectRoot, "dist/ui/widget.css"), "utf8").catch(() => "")
  ]);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${css}</style>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script>${javascript}</script>
  </body>
</html>`;
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "inbridge", version: "0.13.1", icons: APP_ICONS },
    {
      instructions:
        "Use InBridge proactively whenever the user needs to choose among options, compare plans, configure multiple parameters, set preferences, approve or reject an action, or provide other structured input. Prefer an interactive panel over a long plain-text option list when it reduces ambiguity or effort. For decision, confirmation, experiment_config, theme_config, or comparison, call render_interaction_template directly—do not call list_interaction_templates first. For novel forms, call ask_user_interactively. After rendering, stop and wait for the user to confirm or cancel before continuing. Use list_interaction_templates only as a rare fallback when no template can be inferred. Preserve mathematical notation as LaTeX, preferably with $...$ inline and $$...$$ for display."
    }
  );

  registerAppResource(server, "inbridge-interaction", WIDGET_URI, {}, async () => ({
    contents: [
      {
        uri: WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await loadWidgetHtml(),
        _meta: {
          ui: {
            domain: PUBLIC_BASE_URL,
            prefersBorder: true,
            csp: {
              connectDomains: [],
              resourceDomains: []
            }
          },
          "openai/widgetDescription":
            "InBridge 在当前对话中显示一次性结构化选择，并保留用户触发该交互的原始消息。",
          "openai/widgetPrefersBorder": true,
          "openai/widgetDomain": PUBLIC_BASE_URL
        }
      }
    ]
  }));

  server.registerTool(
    "list_interaction_templates",
    {
      title: "Rare fallback: inspect InBridge templates",
      description:
        "Rare fallback only: inspect the InBridge template catalog when no suitable template can be inferred from the task. Do not call this before ordinary decisions, confirmations, experiment configuration, theme configuration, or plan comparisons; call render_interaction_template directly for those intents.",
      inputSchema: z.object({}).strict(),
      outputSchema: templateCatalogOutputSchema,
      annotations: RENDER_TOOL_ANNOTATIONS
    },
    async () => ({
      structuredContent: { templates: TEMPLATE_CATALOG },
      content: [
        {
          type: "text",
          text: `Available InBridge templates: ${TEMPLATE_CATALOG.map((template) => template.id).join(", ")}.`
        }
      ]
    })
  );

  registerAppTool(
    server,
    "render_interaction_template",
    {
      title: "Ask the user with a ready-made interactive panel",
      description:
        "Proactively ask the user through a validated inline UI instead of listing options in plain text. Call this directly, without list_interaction_templates, for these intents: decision (single or multiple choice), confirmation (approve/reject/cancel), experiment_config (multi-step experiment settings), theme_config (visual settings with live preview), or comparison (rich side-by-side plans). After calling, stop and wait for the user to confirm or cancel in the panel.",
      inputSchema: interactionTemplateToolInputSchema.shape,
      outputSchema: normalizedInteractionSchema,
      annotations: RENDER_TOOL_ANNOTATIONS,
      _meta: RENDER_TOOL_META
    },
    async (input) => {
      const request = interactionTemplateRequestSchema.parse(input);
      const normalized = buildInteractionTemplate(request);
      return {
        structuredContent: normalized,
        content: [
          {
            type: "text",
            text: `Displayed ${input.templateId} template ${normalized.interactionId}. Wait for the user to confirm or cancel in the inline panel.`
          }
        ]
      };
    }
  );

  registerAppTool(
    server,
    "ask_user_interactively",
    {
      title: "Ask the user interactively",
      description:
        "Proactively ask the user for structured input in an inline interactive panel when no built-in template fits. Use when the user must choose or compare options, configure several fields, set preferences, review a live preview, or explicitly confirm an action. Supports radio, checkbox, select, range, text, number, switch, color, comparison cards, conditional fields, and multi-step flows. Prefer this over a long or ambiguous plain-text question; after calling, stop and wait for confirmation or cancellation.",
      inputSchema: interactionConfigSchema,
      outputSchema: normalizedInteractionSchema,
      annotations: RENDER_TOOL_ANNOTATIONS,
      _meta: RENDER_TOOL_META
    },
    async (input) => {
      const normalized = normalizeInteraction(input);
      return {
        structuredContent: normalized,
        content: [
          {
            type: "text",
            text: `Displayed interaction ${normalized.interactionId}. Wait for the user to confirm or cancel in the inline panel.`
          }
        ]
      };
    }
  );

  registerAppTool(
    server,
    "render_interaction",
    {
      title: "Legacy custom interaction renderer",
      description:
        "Deprecated compatibility alias for ask_user_interactively. New model-initiated interactions must use ask_user_interactively.",
      inputSchema: interactionConfigSchema,
      outputSchema: normalizedInteractionSchema,
      annotations: RENDER_TOOL_ANNOTATIONS,
      _meta: LEGACY_RENDER_TOOL_META
    },
    async (input) => {
      const normalized = normalizeInteraction(input);
      return {
        structuredContent: normalized,
        content: [
          {
            type: "text",
            text: `Displayed interaction ${normalized.interactionId}. Wait for the user to confirm or cancel in the inline panel.`
          }
        ]
      };
    }
  );

  return server;
}
