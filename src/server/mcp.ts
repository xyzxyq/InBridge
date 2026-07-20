import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeInteraction } from "./normalize.js";
import { interactionConfigSchema, normalizedInteractionSchema } from "./schemas.js";

export const WIDGET_URI = "ui://inbridge/interaction-v6.html";

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
    { name: "inbridge", version: "0.6.0" },
    {
      instructions:
        "Use render_interaction when the user needs to choose among multiple options and an inline control is more effective than a plain-text reply."
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
