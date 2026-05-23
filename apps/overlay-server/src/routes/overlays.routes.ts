import { getOverlayOrigin } from "../server-urls.js";
import type { RouteModule } from "./types.js";

export const registerOverlaysRoutes: RouteModule = (app) => {
  app.get("/api/overlays", async () => {
    const base = getOverlayOrigin();
    return {
      overlays: [
        { id: "alerts", name: "Alerts", url: `${base}/o/alerts.html`, channels: ["alerts", "effects"] },
        { id: "chat", name: "Chat", url: `${base}/o/chat.html`, channels: ["chat"] },
        { id: "goals", name: "Goal Bar", url: `${base}/o/goals.html`, channels: ["goal"] },
        { id: "ticker", name: "Event Ticker", url: `${base}/o/ticker.html`, channels: ["ticker"] },
        { id: "now-playing", name: "Now Playing", url: `${base}/o/now-playing.html`, channels: ["nowPlaying"] },
        { id: "demo", name: "Demo / Debug", url: `${base}/o/demo.html`, channels: ["*"] },
      ],
    };
  });
};
