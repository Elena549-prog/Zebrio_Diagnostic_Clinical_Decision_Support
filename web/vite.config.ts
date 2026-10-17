import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api/* to the Arbor backend so the UI and agent engine
// share one origin in the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true,
        // SSE: don't buffer the streaming endpoints.
        ws: false,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
