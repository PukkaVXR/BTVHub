import { getActivity, getSetting, getStreamSessionSummary } from "../db.js";
import { getObsStatus } from "../obs-client.js";
import { getCertPaths } from "../tls.js";
import { getAllowedOrigins } from "../auth.js";
import { getOAuthOrigin, getOverlayOrigin, getOverlayWsUrl } from "../server-urls.js";
import { getSpotifyStatus } from "../spotify-service.js";
import { getTwitchStatus } from "../twitch-service.js";
import type { RouteModule } from "./types.js";

export const registerHealthRoutes: RouteModule = (app, ctx) => {
  app.get("/api/health", async () => ({
    ok: true,
    overlayUrl: getOverlayOrigin(),
    overlayWsUrl: getOverlayWsUrl(),
    oauthUrl: getOAuthOrigin(),
    certDir: getCertPaths().certDir,
    allowedOrigins: getAllowedOrigins(),
    apiTokenConfigured: true,
    twitch: ctx.safeStatus("Twitch", ctx.twitchStatusFallback, getTwitchStatus),
    spotify: ctx.safeStatus("Spotify", ctx.spotifyStatusFallback, getSpotifyStatus),
    obs: ctx.safeStatus("OBS", ctx.obsStatusFallback, getObsStatus),
  }));

  app.get("/api/preflight", async () => {
    const activity = getActivity(10).flatMap((r) => {
      try {
        return [{ id: r.id, event: JSON.parse(r.event_json), at: r.created_at }];
      } catch {
        return [];
      }
    });
    const twitch = ctx.safeStatus("Twitch", ctx.twitchStatusFallback, getTwitchStatus);
    const spotify = ctx.safeStatus("Spotify", ctx.spotifyStatusFallback, getSpotifyStatus);
    const obs = ctx.safeStatus("OBS", ctx.obsStatusFallback, getObsStatus);
    const overlays = ctx.bus.getSnapshot();
    const expectedOverlays = [
      { id: "alerts", label: "Alerts", route: "/o/alerts.html", channels: ["alerts", "effects"] },
      { id: "chat", label: "Chat", route: "/o/chat.html", channels: ["chat"] },
      { id: "goals", label: "Goal Bar", route: "/o/goals.html", channels: ["goal"] },
      { id: "ticker", label: "Event Ticker", route: "/o/ticker.html", channels: ["ticker"] },
      { id: "now-playing", label: "Now Playing", route: "/o/now-playing.html", channels: ["nowPlaying"] },
    ].map((overlay) => ({
      ...overlay,
      reachable: overlay.channels.some((channel) => (overlays.channels[channel] ?? 0) > 0)
        || overlays.clients.some((client) => client.route === overlay.route && client.status === "connected"),
    }));
    const alerts = ctx.alertQueue.getStatus();
    const session = getStreamSessionSummary();
    const checks = [
      { id: "overlay-server", label: "Overlay server", ok: true, detail: getOverlayOrigin() },
      { id: "overlay-clients", label: "OBS browser sources", ok: overlays.clientCount > 0, detail: `${overlays.clientCount} connected` },
      { id: "overlay-heartbeats", label: "Overlay heartbeats", ok: overlays.clients.every((client) => client.status === "connected"), detail: `${overlays.clients.filter((client) => client.status === "stale").length} stale` },
      { id: "overlay-reachability", label: "Browser source reachability", ok: expectedOverlays.some((overlay) => overlay.reachable), detail: `${expectedOverlays.filter((overlay) => overlay.reachable).length}/${expectedOverlays.length} expected overlays reachable` },
      { id: "twitch", label: "Twitch", ok: twitch.connected, detail: twitch.displayName ?? twitch.login ?? twitch.eventsubStatus ?? "Not connected" },
      { id: "spotify", label: "Spotify", ok: spotify.connected, detail: spotify.connected ? "Connected" : "Not connected" },
      { id: "obs", label: "OBS WebSocket", ok: obs.connected, detail: `${obs.host}:${obs.port}` },
    ];

    return {
      ok: checks.every((check) => check.ok),
      generatedAt: new Date().toISOString(),
      checks,
      overlays,
      expectedOverlays,
      emergency: {
        automationsDisabled: getSetting("automations_disabled") === "1",
        channelPointActionsDisabled: getSetting("channel_point_actions_disabled") === "1",
      },
      alerts,
      session,
      twitch,
      spotify,
      obs,
      activity,
    };
  });
};
