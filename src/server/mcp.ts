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
import {
  buildInteractionTemplate,
  interactionTemplateRequestSchema,
  interactionTemplateToolInputSchema,
  TEMPLATE_CATALOG,
  templateCatalogOutputSchema
} from "./templates.js";

export const WIDGET_URI = "ui://inbridge/interaction-v9.html";

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
    { name: "inbridge", version: "0.9.0" },
    {
      instructions:
        "Prefer render_interaction_template when decision, confirmation, experiment_config, or theme_config matches the task. Use list_interaction_templates when unsure. Use render_interaction only for novel forms that need custom controls. After rendering, wait for the user to confirm or cancel in the inline panel."
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
            domain: "https://mcp.example.com",
            prefersBorder: true,
            csp: {
              connectDomains: [],
              resourceDomains: []
            }
          }
        }
      }
    ]
  }));

  server.registerTool(
    "list_interaction_templates",
    {
      title: "List InBridge interaction templates",
      description:
        "List the stable interaction templates available in InBridge and when to use them. Call this when a structured interaction is useful but the best template is unclear.",
      inputSchema: z.object({}).strict(),
      outputSchema: templateCatalogOutputSchema
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
      title: "Render an InBridge interaction template",
      description:
        "Render a validated, consistent inline interaction from a named template. Prefer this over render_interaction for common decisions, confirmations, experiment configuration, and theme configuration.",
      inputSchema: interactionTemplateToolInputSchema.shape,
      outputSchema: normalizedInteractionSchema,
      _meta: { ui: { resourceUri: WIDGET_URI } }
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
    "render_interaction",
    {
      title: "Render an interactive choice",
      description:
        "Render an inline decision panel when the user needs to choose or confirm one or more options. Use this instead of asking for a plain-text response when structured interaction is materially clearer.",
      inputSchema: interactionConfigSchema,
      outputSchema: normalizedInteractionSchema,
      _meta: { ui: { resourceUri: WIDGET_URI } }
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
