import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/._*"]
  },
  build: {
    outDir: "dist/ui",
    emptyOutDir: true,
    lib: {
      entry: "src/ui/main.ts",
      formats: ["iife"],
      name: "InBridgeWidget",
      fileName: () => "widget.js"
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: "widget.[ext]"
      }
    }
  }
});
