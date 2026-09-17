import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// circomlibjs and ffjavascript are written for Node: they reach for Buffer, process, events,
// util and crypto. Without these polyfills Vite stubs those out and the page renders blank.
export default defineConfig({
  plugins: [react(), nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  optimizeDeps: { include: ["circomlibjs"] },
});
