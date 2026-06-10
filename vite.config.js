import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3131",
      "/terminal": {
        target: "ws://localhost:3131",
        ws: true,
      }
    }
  }
});
