import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    environmentOptions: {
      jsdom: { url: "http://localhost:3000" },
    },
    server: {
      deps: {
        // node:sqlite is a Node 22 built-in; Vite doesn't recognise the node: prefix
        // automatically, so we mark it external to skip bundling.
        external: [/^node:/],
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
