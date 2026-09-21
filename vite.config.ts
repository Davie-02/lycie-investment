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

/** The real API address, used for the two long-lived streams that skip the site's proxy (see below). */
const RENDER_API_FALLBACK = "https://lycie-investment-api.onrender.com/api";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // SAME-DOMAIN API. When building on Vercel, the browser talks to "/api" on the
  // website's own address, and vercel.json forwards that to the Render API. The
  // session cookie is then FIRST-PARTY, so login works in every browser without
  // the token fallback. Set VITE_DIRECT_API=true in Vercel to switch this off and
  // call the API's own address directly again (no other change needed).
  //
  // Two streams (live updates, Lycie's typing answers) stay on the direct address:
  // they are long-lived and anonymous, so there is nothing to gain from proxying them.
  const sameDomain = process.env.VERCEL === "1" && process.env.VITE_DIRECT_API !== "true";
  const directApi = env.VITE_API_BASE_URL?.startsWith("http") ? env.VITE_API_BASE_URL : RENDER_API_FALLBACK;

  return {
  define: sameDomain
    ? {
        "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api"),
        "import.meta.env.VITE_STREAM_BASE_URL": JSON.stringify(directApi),
      }
    : {},
  build: {
    rollupOptions: {
      output: {
        // React and the router change rarely, so they live in their own file: returning visitors keep
        // it cached across deploys and only re-download the (much smaller) app code.
        manualChunks: { "vendor-react": ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
  plugins: [react(), preconnectApi(sameDomain ? directApi : env.VITE_API_BASE_URL ?? "http://localhost:3001/api")],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
