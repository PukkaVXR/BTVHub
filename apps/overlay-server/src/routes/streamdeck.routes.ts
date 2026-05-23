import { getMacros, getSetting, getSourceGroup, getSourceGroups } from "../db.js";
import { getCurrentObsScene, getObsStatus, listObsSceneSources } from "../obs-client.js";
import { getOverlayOrigin } from "../server-urls.js";
import { getTwitchStatus } from "../twitch-service.js";
import type { RouteModule } from "./types.js";

export const registerStreamDeckRoutes: RouteModule = (app, ctx) => {
  app.get("/api/stream-deck/status", async () => {
    const obs = getObsStatus();
    const twitch = getTwitchStatus();
    const overlays = ctx.bus.getSnapshot();
    const alerts = ctx.alertQueue.getStatus();
    const activeSourceGroupId = getSetting("active_source_group_id");
    const activeSourceGroup = activeSourceGroupId ? getSourceGroup(activeSourceGroupId) : null;
    const ok = obs.connected && twitch.connected && overlays.clientCount > 0;
    return {
      ok,
      title: ok ? "BTV Ready" : "BTV Check",
      message: activeSourceGroup ? `Activity: ${activeSourceGroup.name}` : "No activity selected",
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "check" : "alert-triangle",
      states: {
        obs: obs.connected ? "connected" : "offline",
        twitch: twitch.connected ? "connected" : "offline",
        overlays: overlays.clientCount,
        alertsQueued: alerts.queued,
        alertPlaying: alerts.playing,
        activeSourceGroupId,
        activeSourceGroupName: activeSourceGroup?.name,
      },
    };
  });

  app.get("/api/stream-deck/obs", async () => {
    const obs = getObsStatus();
    const currentScene = await getCurrentObsScene();
    const sources = currentScene ? await listObsSceneSources(currentScene) : null;
    return {
      ok: obs.connected,
      title: obs.connected ? "OBS Online" : "OBS Offline",
      message: currentScene ? `Scene: ${currentScene}` : "No scene available",
      color: obs.connected ? "#00f593" : "#eb0400",
      icon: obs.connected ? "radio" : "alert-triangle",
      state: { ...obs, currentScene, sources: sources ?? [] },
    };
  });

  app.get("/api/stream-deck/macros", async () => ({
    ok: true,
    title: "Macros",
    color: "#5b8cff",
    icon: "zap",
    macros: getMacros().map((macro) => ({
      id: macro.id,
      name: macro.name,
      enabled: macro.enabled,
      stepCount: macro.steps.length,
      url: `${getOverlayOrigin()}/api/actions/macro/${encodeURIComponent(macro.id)}`,
      color: macro.enabled ? "#00f593" : "#6f7b8d",
      icon: macro.enabled ? "zap" : "pause",
    })),
  }));

  app.get("/api/stream-deck/source-groups", async () => {
    const activeId = getSetting("active_source_group_id");
    return {
      ok: true,
      title: "Activity Layouts",
      color: "#5b8cff",
      icon: "layers",
      activeId,
      groups: getSourceGroups().map((group) => ({
        id: group.id,
        name: group.name,
        sceneName: group.sceneName,
        sourceCount: group.sources.length,
        active: group.id === activeId,
        url: `${getOverlayOrigin()}/api/actions/source-group/${encodeURIComponent(group.id)}`,
        color: group.id === activeId ? "#00f593" : "#5b8cff",
        icon: group.id === activeId ? "check" : "layers",
      })),
    };
  });
};
