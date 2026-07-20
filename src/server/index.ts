import { createHttpApp } from "./app.js";

export { createHttpApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

if (process.env.NODE_ENV !== "test") {
  createHttpApp().listen(port, "0.0.0.0", () => {
    console.log(`InBridge listening on http://localhost:${port}`);
  });
}
