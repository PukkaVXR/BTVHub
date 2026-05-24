import { DEBUG_OVERLAY, EXPECTED_OVERLAYS, overlayUrl } from "../overlay-definitions.js";
import type { RouteModule } from "./types.js";

export const registerOverlaysRoutes: RouteModule = (app) => {
  app.get("/api/overlays", async () => {
    return {
      overlays: [...EXPECTED_OVERLAYS, DEBUG_OVERLAY].map((overlay) => ({
        id: overlay.id,
        name: overlay.name,
        url: overlayUrl(overlay.route),
        channels: overlay.channels,
      })),
    };
  });
};
