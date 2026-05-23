import { connectObs } from "../obs-client.js";
import { logSystem, setSetting } from "../db.js";
import type { RouteModule, ServerContext } from "./types.js";

export const registerEmergencyRoutes: RouteModule = (app, ctx) => {
  app.post("/api/emergency/:action", async (req) => {
    const { action } = req.params as {
      action:
        | "all"
        | "stop-sounds"
        | "hide-overlays"
        | "reset-overlays"
        | "disable-automations"
        | "enable-automations"
        | "disable-channel-points"
        | "enable-channel-points"
        | "reconnect-obs"
        | "reconnect-twitch";
    };

    switch (action) {
      case "all":
        ctx.alertQueue.clear();
        ctx.automationScheduler.stopAll();
        setSetting("automations_disabled", "1");
        setSetting("channel_point_actions_disabled", "1");
        broadcastOverlayEmergency(ctx, "all");
        logSystem("emergency", "warn", "Emergency stop all triggered");
        return emergencyResult("Emergency stop sent", "Alerts cleared, overlays reset, sounds stopped, automations paused, channel point actions disabled.");
      case "stop-sounds":
        broadcastOverlayEmergency(ctx, "stop_sounds");
        logSystem("emergency", "warn", "Emergency stop sounds triggered");
        return emergencyResult("Sounds stopped", "All connected overlays were asked to stop active sounds.");
      case "hide-overlays":
        broadcastOverlayEmergency(ctx, "hide_overlays");
        logSystem("emergency", "warn", "Emergency hide overlays triggered");
        return emergencyResult("Overlays hidden", "All connected overlays were asked to hide themselves.");
      case "reset-overlays":
        broadcastOverlayEmergency(ctx, "reset_overlay_state");
        logSystem("emergency", "info", "Emergency reset overlays triggered");
        return emergencyResult("Overlays reset", "All connected overlays were asked to clear temporary state and show themselves again.");
      case "disable-automations":
        ctx.automationScheduler.stopAll();
        setSetting("automations_disabled", "1");
        logSystem("emergency", "warn", "Automations disabled");
        return emergencyResult("Automations disabled", "Timer and event automations are paused.");
      case "enable-automations":
        setSetting("automations_disabled", "0");
        ctx.automationScheduler.startAll();
        logSystem("emergency", "info", "Automations enabled");
        return emergencyResult("Automations enabled", "Timer and event automations can run again.");
      case "disable-channel-points":
        setSetting("channel_point_actions_disabled", "1");
        logSystem("emergency", "warn", "Channel point actions disabled");
        return emergencyResult("Channel point actions disabled", "Channel point effects are paused.");
      case "enable-channel-points":
        setSetting("channel_point_actions_disabled", "0");
        logSystem("emergency", "info", "Channel point actions enabled");
        return emergencyResult("Channel point actions enabled", "Channel point effects can run again.");
      case "reconnect-obs": {
        const ok = await connectObs();
        logSystem("emergency", ok ? "info" : "error", ok ? "OBS reconnect succeeded" : "OBS reconnect failed");
        return emergencyResult(ok ? "OBS reconnected" : "OBS reconnect failed", ok ? "OBS WebSocket is connected." : "BTV could not reach OBS WebSocket.", ok);
      }
      case "reconnect-twitch":
        ctx.bootEventSub();
        logSystem("emergency", "info", "Twitch reconnect started");
        return emergencyResult("Twitch reconnect started", "BTV restarted Twitch EventSub.");
      default:
        return emergencyResult("Unknown emergency action", "No action was taken.", false);
    }
  });
};

function broadcastOverlayEmergency(ctx: ServerContext, action: "stop_sounds" | "hide_overlays" | "reset_overlay_state" | "all") {
  ctx.bus.broadcast({ kind: "overlay:emergency", action, at: new Date().toISOString() });
}

function emergencyResult(title: string, message: string, ok = true) {
  return {
    ok,
    code: ok ? "EMERGENCY_ACTION_SENT" : "EMERGENCY_ACTION_FAILED",
    title,
    message,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "check" : "alert-triangle",
    retryable: !ok,
  };
}
