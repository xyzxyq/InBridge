import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/site",
  build: {
    outDir: path.resolve(process.cwd(), "dist/site"),
    emptyOutDir: false,
    sourcemap: false
  }
});
