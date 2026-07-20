import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { observeAndSecureRequests, requestId, safeHttpErrorHandler } from "./http.js";
import { createMcpServer } from "./mcp.js";

export function configureHttpApp(app: Express) {
  app.disable("x-powered-by");
  app.use(observeAndSecureRequests);
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "inbridge", version: "0.6.0" });
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
      console.error(
        JSON.stringify({
          level: "error",
          event: "mcp.request.failed",
          requestId: requestId(response.locals),
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: "MCP request failed"
        })
      );
      if (!response.headersSent) {
        response
          .status(500)
          .json({ error: "Internal MCP server error", requestId: requestId(response.locals) });
      }
    }
  });

  app.all("/mcp", (_request, response) => {
    response
      .status(405)
      .set("Allow", "POST")
      .json({ error: "Use POST for stateless MCP requests", requestId: requestId(response.locals) });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found", requestId: requestId(response.locals) });
  });

  app.use(safeHttpErrorHandler);

  return app;
}

export function createHttpApp() {
  return configureHttpApp(express());
}
