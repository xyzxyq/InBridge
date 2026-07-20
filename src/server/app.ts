import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";

export function configureHttpApp(app: Express) {
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "inbridge", version: "0.5.0" });
  });

  app.post("/mcp", async (request, response) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    response.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      console.error("MCP request failed", error);
      if (!response.headersSent) {
        response.status(500).json({ error: "Internal MCP server error" });
      }
    }
  });

  app.get("/mcp", (_request, response) => {
    response.status(405).set("Allow", "POST").json({ error: "Use POST for stateless MCP requests" });
  });

  return app;
}

export function createHttpApp() {
  return configureHttpApp(express());
}
