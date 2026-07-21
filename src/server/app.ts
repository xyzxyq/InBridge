import path from "node:path";
import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { observeAndSecureRequests, requestId, safeHttpErrorHandler } from "./http.js";
import { createMcpServer } from "./mcp.js";

export function configureHttpApp(app: Express, siteRoot = path.join(process.cwd(), "dist/site")) {
  app.disable("x-powered-by");
  app.use(observeAndSecureRequests);
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "inbridge", version: "0.13.1" });
  });

  app.get("/icon.png", (_request, response, next) => {
    response
      .type("png")
      .set("Cache-Control", "public, max-age=86400, immutable")
      .sendFile(path.join(process.cwd(), "icon/icon.png"), (error) => {
        if (error) next(error);
      });
  });

  app.use(
    "/assets",
    express.static(path.join(siteRoot, "assets"), {
      immutable: true,
      maxAge: "1y",
      setHeaders(response) {
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    })
  );

  app.get("/", (_request, response, next) => {
    response
      .set({
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self' 'sha256-r0K+Chfh/HHe1lPm2Z60fThAtVMbGOGR0zbjvI42OiY='",
          "style-src 'self'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join("; ")
      })
      .sendFile(path.join(siteRoot, "index.html"), (error) => {
        if (error) next(error);
      });
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

export function createHttpApp(siteRoot?: string) {
  return configureHttpApp(express(), siteRoot);
}
