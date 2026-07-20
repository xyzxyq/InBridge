import { defineConfig } from "vite";

export default defineConfig({
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
