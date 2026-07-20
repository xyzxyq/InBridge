import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, Request, RequestHandler } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

type HttpError = Error & {
  body?: unknown;
  status?: number;
  statusCode?: number;
  type?: string;
};

function headerValue(request: Request, name: string): string | undefined {
  const value = request.header(name);
  return value && REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

export function requestId(responseLocals: Record<string, unknown>): string {
  return typeof responseLocals.requestId === "string" ? responseLocals.requestId : "unknown";
}

export const observeAndSecureRequests: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();
  const id = headerValue(request, "x-request-id") ?? headerValue(request, "x-vercel-id") ?? randomUUID();
  const path = request.path === "/mcp" || request.path === "/health" ? request.path : "/other";

  response.locals.requestId = id;
  response.set({
    "Cache-Control": "no-store",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": id
  });

  console.info(
    JSON.stringify({
      level: "info",
      event: "http.request.started",
      requestId: id,
      method: request.method,
      path
    })
  );

  response.on("finish", () => {
    console.info(
      JSON.stringify({
        level: "info",
        event: "http.request.completed",
        requestId: id,
        method: request.method,
        path,
        status: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100
      })
    );
  });

  next();
};

export const safeHttpErrorHandler: ErrorRequestHandler = (error: HttpError, _request, response, next) => {
  const id = requestId(response.locals);
  const isMalformedJson = error instanceof SyntaxError && error.body !== undefined;
  const isBodyTooLarge = error.type === "entity.too.large" || error.status === 413 || error.statusCode === 413;
  const status = isBodyTooLarge ? 413 : isMalformedJson ? 400 : 500;
  const message = isBodyTooLarge
    ? "Request body exceeds the 64kb limit"
    : isMalformedJson
      ? "Malformed JSON request body"
      : "Internal server error";

  console.error(
    JSON.stringify({
      level: "error",
      event: "http.request.failed",
      requestId: id,
      status,
      errorName: error.name,
      errorMessage: message
    })
  );

  if (response.headersSent) return next(error);
  response.status(status).json({ error: message, requestId: id });
};
