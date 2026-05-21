import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const overlayHttp = process.env.BTV_OVERLAY_URL ?? "http://127.0.0.1:4782";
const oauthHttps = process.env.BTV_OAUTH_URL ?? "https://127.0.0.1:4783";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@btv/overlay-sdk": resolve(__dirname, "../../packages/overlay-sdk/src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4781,
    strictPort: true,
    proxy: {
      "/api": { target: overlayHttp, changeOrigin: true },
      "/hooks": { target: overlayHttp, changeOrigin: true },
      "/auth/twitch": { target: oauthHttps, changeOrigin: true, secure: false },
      "/auth/spotify": { target: overlayHttp, changeOrigin: true },
    },
  },
});
