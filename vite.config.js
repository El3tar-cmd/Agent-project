import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const VITE_PORT   = parseInt(env.VITE_PORT)   || 5000;
  const SERVER_PORT = parseInt(env.PORT)         || 3131;

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: VITE_PORT,
      strictPort: false,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: `http://localhost:${SERVER_PORT}`,
          changeOrigin: true,
        },
        "/terminal": {
          target: `ws://localhost:${SERVER_PORT}`,
          ws: true,
          changeOrigin: true,
        },
        "/.screenshots": {
          target: `http://localhost:${SERVER_PORT}`,
          changeOrigin: true,
        },
        "/.uploads": {
          target: `http://localhost:${SERVER_PORT}`,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
    },
  };
});
