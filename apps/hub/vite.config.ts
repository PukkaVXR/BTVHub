import { defineConfig } from "vite";
import type { ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const overlayHttp = process.env.BTV_OVERLAY_URL ?? "http://127.0.0.1:4782";
const oauthHttps = process.env.BTV_OAUTH_URL ?? "https://127.0.0.1:4783";
const trustedHubOrigin = "http://127.0.0.1:4781";

const apiProxy: ProxyOptions = {
  target: overlayHttp,
  changeOrigin: true,
  configure(proxy) {
    proxy.on("proxyReq", (proxyRequest) => {
      proxyRequest.setHeader("origin", trustedHubOrigin);
    });
  },
};

function manualChunks(id: string): string | undefined {
  const moduleId = id.replaceAll("\\", "/");

  if (moduleId.includes("/node_modules/react/") ||
      moduleId.includes("/node_modules/react-dom/") ||
      moduleId.includes("/node_modules/react-router/") ||
      moduleId.includes("/node_modules/react-router-dom/")) {
    return "vendor-react";
  }

  if (moduleId.includes("/src/pages/AlertEditorPage.tsx") || moduleId.includes("/src/components/alerts/")) {
    return "editor-alerts";
  }
  if (moduleId.includes("/src/pages/StreamDeckPage.tsx") || moduleId.includes("/src/components/streamDeck/") || moduleId.includes("/src/lib/apiNinja.ts")) {
    return "editor-stream-deck";
  }
  if (moduleId.includes("/src/pages/AutomationsPage.tsx") || moduleId.includes("/src/components/automations/")) {
    return "editor-automations";
  }
  if (moduleId.includes("/src/pages/CommandsPage.tsx") || moduleId.includes("/src/components/commands/")) {
    return "editor-commands";
  }
  if (moduleId.includes("/src/pages/OverlaysPage.tsx")) {
    return "editor-overlays";
  }
  if (moduleId.includes("/src/pages/InteractivePage.tsx")) {
    return "editor-interactive";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@btv/overlay-sdk": resolve(__dirname, "../../packages/overlay-sdk/src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4781,
    strictPort: true,
    proxy: {
      "/api": apiProxy,
      "/assets": { target: overlayHttp, changeOrigin: true },
      "/hooks": { target: overlayHttp, changeOrigin: true },
      "/auth/twitch": { target: oauthHttps, changeOrigin: true, secure: false },
      "/auth/spotify": { target: overlayHttp, changeOrigin: true },
    },
  },
});
