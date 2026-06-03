import type { AlertProject } from "@btv/shared";
import { listMediaAssets, listSoundAssets } from "../assets.js";
import { getActivity, getAlertProjects, getSetting, getStreamSessionSummary } from "../db.js";
import { getObsBrowserSourceStatuses, getObsStatus } from "../obs-client.js";
import { EXPECTED_OVERLAYS, overlayUrl } from "../overlay-definitions.js";
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
    const alertProjectChecks = analyzeAlertProjects(getAlertProjects(), ctx.assetsDir);
    const obsBrowserSources = obs.connected
      ? await getObsBrowserSourceStatuses(EXPECTED_OVERLAYS, getOverlayOrigin()) ?? []
      : [];
    const expectedOverlays = EXPECTED_OVERLAYS.map((overlay) => ({
      ...overlay,
      url: overlayUrl(overlay.route),
      reachable: overlay.channels.some((channel) => (overlays.channels[channel] ?? 0) > 0)
        || overlays.clients.some((client) => client.route === overlay.route && client.status === "connected"),
      obsSource: obsBrowserSources.find((source) => source.id === overlay.id),
    }));
    const alerts = ctx.alertQueue.getStatus();
    const session = getStreamSessionSummary();
    const checks = [
      { id: "overlay-server", label: "Overlay server", ok: true, detail: getOverlayOrigin() },
      { id: "overlay-clients", label: "OBS browser sources", ok: overlays.clientCount > 0, detail: `${overlays.clientCount} connected` },
      { id: "overlay-heartbeats", label: "Overlay heartbeats", ok: overlays.clients.every((client) => client.status === "connected"), detail: `${overlays.clients.filter((client) => client.status === "stale").length} stale` },
      { id: "overlay-reachability", label: "Browser source reachability", ok: expectedOverlays.some((overlay) => overlay.reachable), detail: `${expectedOverlays.filter((overlay) => overlay.reachable).length}/${expectedOverlays.length} expected overlays reachable` },
      { id: "alert-project-assets", label: "Alert project assets", ok: alertProjectChecks.errors === 0, detail: alertProjectChecks.errors ? `${alertProjectChecks.errors} broken asset reference(s)` : `${alertProjectChecks.projects.length} project(s) checked` },
      { id: "twitch", label: "Twitch", ok: twitch.connected, detail: twitch.displayName ?? twitch.login ?? twitch.eventsubStatus ?? "Not connected" },
      { id: "twitch-chat", label: "Twitch chat", ok: twitch.chat?.connected ?? false, detail: twitch.chat?.detail ?? "Connect Twitch to enable chat" },
      { id: "spotify", label: "Spotify", ok: spotify.connected, detail: spotify.connected ? "Connected" : "Not connected" },
      { id: "obs", label: "OBS WebSocket", ok: obs.connected, detail: `${obs.host}:${obs.port}` },
    ];

    return {
      ok: checks.every((check) => check.ok),
      generatedAt: new Date().toISOString(),
      checks,
      overlays,
      expectedOverlays,
      alertProjects: alertProjectChecks,
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

function analyzeAlertProjects(projects: AlertProject[], assetsDir: string): {
  errors: number;
  warnings: number;
  projects: Array<{
    id: string;
    name: string;
    eventType: string;
    errors: number;
    warnings: number;
    issues: Array<{ level: "error" | "warning"; message: string }>;
  }>;
} {
  const mediaByUrl = new Map(listMediaAssets(assetsDir).flatMap((asset) => [
    [asset.url, asset.name],
    [normalizeAssetUrl(asset.url), asset.name],
  ]));
  const soundsByUrl = new Map(listSoundAssets(assetsDir).flatMap((asset) => [
    [asset.url, asset.name],
    [normalizeAssetUrl(asset.url), asset.name],
  ]));

  const checkedProjects = projects.map((project) => {
    const issues: Array<{ level: "error" | "warning"; message: string }> = [];
    const mediaLayers = project.layers.filter((layer) => ["image", "gif", "video", "audio"].includes(layer.type));
    const videoLayers = project.layers.filter((layer) => layer.type === "video");
    const heavyFilterLayers = project.layers.filter((layer) => (layer.filter?.blur ?? 0) > 20 || (layer.filter?.glow ?? 0) > 50);
    const browserLayers = project.layers.filter((layer) => layer.type === "browser");
    const customScriptLayers = browserLayers.filter((layer) => layer.js.trim() || layer.sandbox === false);

    for (const layer of mediaLayers) {
      if (layer.type !== "image" && layer.type !== "gif" && layer.type !== "video" && layer.type !== "audio") continue;
      if (!layer.assetUrl) {
        issues.push({ level: "error", message: `${layer.name} has no asset URL.` });
        continue;
      }
      if (/^(https?:|data:|blob:)/i.test(layer.assetUrl)) continue;
      const lookupUrl = normalizeAssetUrl(layer.assetUrl);
      const found = layer.type === "audio" ? soundsByUrl.has(lookupUrl) : mediaByUrl.has(lookupUrl);
      if (!found) {
        issues.push({ level: "error", message: `${layer.name} points to a missing local asset: ${layer.assetUrl}` });
      }
    }

    if (mediaLayers.length > 8) issues.push({ level: "warning", message: `${mediaLayers.length} media layers may be heavy for OBS browser source playback.` });
    if (videoLayers.length > 2) issues.push({ level: "warning", message: `${videoLayers.length} video layers may stutter on lower-end stream PCs.` });
    if (heavyFilterLayers.length > 3) issues.push({ level: "warning", message: `${heavyFilterLayers.length} layers use heavy blur/glow effects.` });
    if (browserLayers.length) issues.push({ level: "warning", message: "Browser/custom HTML layers depend on iframe support in OBS browser sources." });
    if (customScriptLayers.length && !project.safeMode) issues.push({ level: "warning", message: "Custom JS layers can behave differently in OBS. Enable Safe mode before going live if this alert misbehaves." });
    if (customScriptLayers.length && project.safeMode) issues.push({ level: "warning", message: "Safe mode is enabled, so custom JS in browser layers will be disabled during playback." });
    if (project.durationMs > 30000) issues.push({ level: "warning", message: "Alert duration is over 30 seconds." });

    return {
      id: project.id,
      name: project.name,
      eventType: project.eventType,
      errors: issues.filter((issue) => issue.level === "error").length,
      warnings: issues.filter((issue) => issue.level === "warning").length,
      issues,
    };
  });

  return {
    errors: checkedProjects.reduce((sum, project) => sum + project.errors, 0),
    warnings: checkedProjects.reduce((sum, project) => sum + project.warnings, 0),
    projects: checkedProjects.filter((project) => project.issues.length > 0),
  };
}

function normalizeAssetUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}
