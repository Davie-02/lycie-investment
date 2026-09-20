import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { loadEnv, type Plugin } from "vite";

/**
 * Opens the connection to the API (DNS + TLS) while the page's own scripts are
 * still downloading, so the first data request doesn't pay that cost.
 */
function preconnectApi(apiBaseUrl: string): Plugin {
  return {
    name: "preconnect-api",
    transformIndexHtml() {
      try {
        const origin = new URL(apiBaseUrl).origin;
        return [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: "" }, injectTo: "head-prepend" }];
      } catch {
        return [];
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [react(), preconnectApi(env.VITE_API_BASE_URL ?? "http://localhost:3001/api")],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
