import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HOST, OAUTH_HTTPS_PORT, OVERLAY_PORT } from "@btv/shared";
import { getAuthorizeUrl } from "@btv/twitch";
import { initDb, getGoals, getGoal, getThemes, getTheme, upsertTheme, deleteTheme, getAlertRules, upsertAlertRule, getWidgets, upsertWidget, getWebhooks, getWebhook, upsertWebhook, deleteWebhook, getEffects, upsertEffect, deleteEffect, getMacros, getMacro, upsertMacro, deleteMacro, getSourceGroups, getSourceGroup, upsertSourceGroup, deleteSourceGroup, getAutomations, getAutomation, upsertAutomation, deleteAutomation, getActivity, getWebhookLog, getSetting, setSetting, setEncryptedSetting, updateGoal, startStreamSession, stopCurrentStreamSession, getCurrentStreamSession, getRecentStreamSessions, getStreamSessionSummary, getSessionEvents, getSessionSceneSpans, type SourceGroup, type AutomationConfig } from "./db.js";
import { OverlayBus } from "./bus.js";
import { AlertQueue } from "./alert-queue.js";
import { RulesEngine } from "./rules-engine.js";
import { EffectRunner } from "./effect-runner.js";
import { MacroRunner } from "./macro-runner.js";
import { AutomationScheduler } from "./automation-scheduler.js";
import {
  getTwitchConfig,
  handleTwitchCallback,
  startEventSub,
  getTwitchStatus,
  disconnectTwitch,
  isTwitchConfigured,
} from "./twitch-service.js";
import {
  getSpotifyAuthUrl,
  handleSpotifyCallback,
  startSpotifyPoller,
  getSpotifyStatus,
  disconnectSpotify,
} from "./spotify-service.js";
import {
  connectObs,
  getCurrentObsScene,
  getObsStatus,
  getObsSourceTransform,
  listObsScenes,
  listObsSceneSources,
  runObsSourceMotion,
  setObsInputSettings,
  setObsScene,
  setObsSourceVisible,
  setObsSourceTransform,
  setObsText,
  writableObsTransformSnapshot,
} from "./obs-client.js";
import {
  getHubOrigin,
  getOAuthHost,
  getOverlayOrigin,
  getOverlayWsUrl,
  getOAuthOrigin,
  getSpotifyAuthStartUrl,
  getSpotifyRedirectUri,
  getTwitchAuthStartUrl,
  getTwitchRedirectUri,
  setOAuthHost,
} from "./server-urls.js";
import { ensureTlsMaterial, getCertPaths } from "./tls.js";
import { handleWebhook } from "./webhook-handler.js";
import {
  ensureApiToken,
  getAllowedOrigins,
  isAllowedOrigin,
  requireTrustedLocalWrite,
} from "./auth.js";
import {
  deleteMediaAsset,
  deleteSoundAsset,
  listMediaAssets,
  listSoundAssets,
  saveMediaAsset,
  saveSoundAsset,
} from "./assets.js";
import type { AlertRule, Effect, Theme, WebhookHook, WidgetConfig } from "@btv/shared";
import type { StreamEventType } from "@btv/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const assetsDir = join(__dirname, "../../../assets");

initDb();

const tls = ensureTlsMaterial();
const app = Fastify({ logger: true });
const oauthApp = Fastify({
  logger: true,
  https: {
    key: tls.key,
    cert: tls.cert,
  },
});
const bus = new OverlayBus();
const alertQueue = new AlertQueue(bus);
const effectRunner = new EffectRunner(bus);
const macroRunner = new MacroRunner(alertQueue, effectRunner);
const rulesEngine = new RulesEngine(bus, alertQueue, effectRunner);
const automationScheduler = new AutomationScheduler(
  macroRunner,
  effectRunner,
  async (id) => {
    const result = await applySourceGroup(id);
    return { ok: result.ok, message: result.message };
  },
);

ensureApiToken();

function safeStatus<T>(label: string, fallback: T, read: () => T): T {
  try {
    return read();
  } catch (err) {
    app.log.warn({ err }, `${label} status unavailable`);
    return fallback;
  }
}

const twitchStatusFallback: ReturnType<typeof getTwitchStatus> = {
  configured: false,
  connected: false,
  hasClientSecret: false,
  login: null,
  displayName: null,
  userId: null,
  eventsubStatus: "status_error",
  chatSubscribed: false,
};

const spotifyStatusFallback: ReturnType<typeof getSpotifyStatus> = {
  configured: false,
  connected: false,
  hasClientSecret: false,
};

const obsStatusFallback: ReturnType<typeof getObsStatus> = {
  host: "127.0.0.1",
  port: 4455,
  hasPassword: false,
  connected: false,
};

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    cb(null, isAllowedOrigin(origin));
  },
};

await app.register(cors, corsOptions);
await oauthApp.register(cors, corsOptions);
app.addHook("preHandler", requireTrustedLocalWrite);
await app.register(fastifyStatic, { root: publicDir, prefix: "/" });
await app.register(fastifyStatic, { root: assetsDir, prefix: "/assets/", decorateReply: false });
await app.register(websocket);

// Twitch OAuth on HTTPS :4783 — redirect mistaken /auth/twitch hits on HTTP :4782
app.addHook("onRequest", async (req, reply) => {
  const path = req.url.split("?")[0];
  if (path.startsWith("/auth/twitch")) {
    return reply.redirect(`${getOAuthOrigin()}${req.url}`);
  }
});

// WebSocket bus
app.register(async (fastify) => {
  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? "", getOverlayOrigin());
    const channels = url.searchParams.get("channels")?.split(",").filter(Boolean) ?? ["*"];
    bus.addClient(socket, channels);
  });
});

// Health
app.get("/api/health", async () => ({
  ok: true,
  overlayUrl: getOverlayOrigin(),
  overlayWsUrl: getOverlayWsUrl(),
  oauthUrl: getOAuthOrigin(),
  certDir: getCertPaths().certDir,
  allowedOrigins: getAllowedOrigins(),
  apiTokenConfigured: true,
  twitch: safeStatus("Twitch", twitchStatusFallback, getTwitchStatus),
  spotify: safeStatus("Spotify", spotifyStatusFallback, getSpotifyStatus),
  obs: safeStatus("OBS", obsStatusFallback, getObsStatus),
}));

app.get("/api/preflight", async () => {
  const activity = getActivity(10).flatMap((r) => {
    try {
      return [{
        id: r.id,
        event: JSON.parse(r.event_json),
        at: r.created_at,
      }];
    } catch {
      return [];
    }
  });
  const twitch = safeStatus("Twitch", twitchStatusFallback, getTwitchStatus);
  const spotify = safeStatus("Spotify", spotifyStatusFallback, getSpotifyStatus);
  const obs = safeStatus("OBS", obsStatusFallback, getObsStatus);
  const overlays = bus.getSnapshot();
  const alerts = alertQueue.getStatus();
  const session = getStreamSessionSummary();
  const checks = [
    {
      id: "overlay-server",
      label: "Overlay server",
      ok: true,
      detail: getOverlayOrigin(),
    },
    {
      id: "overlay-clients",
      label: "OBS browser sources",
      ok: overlays.clientCount > 0,
      detail: `${overlays.clientCount} connected`,
    },
    {
      id: "twitch",
      label: "Twitch",
      ok: twitch.connected,
      detail: twitch.displayName ?? twitch.login ?? twitch.eventsubStatus ?? "Not connected",
    },
    {
      id: "spotify",
      label: "Spotify",
      ok: spotify.connected,
      detail: spotify.connected ? "Connected" : "Not connected",
    },
    {
      id: "obs",
      label: "OBS WebSocket",
      ok: obs.connected,
      detail: `${obs.host}:${obs.port}`,
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    generatedAt: new Date().toISOString(),
    checks,
    overlays,
    alerts,
    session,
    twitch,
    spotify,
    obs,
    activity,
  };
});

app.get("/api/sessions/current", async () => getStreamSessionSummary());

app.get("/api/sessions", async () => ({
  sessions: getRecentStreamSessions(),
}));

app.get("/api/sessions/:id", async (req) => {
  const { id } = req.params as { id: string };
  return {
    summary: getStreamSessionSummary(id),
    events: getSessionEvents(id),
    sceneSpans: getSessionSceneSpans(id),
  };
});

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

app.get("/api/sessions/:id/export.csv", async (req, reply) => {
  const { id } = req.params as { id: string };
  const summary = getStreamSessionSummary(id);
  const events = getSessionEvents(id);
  const sceneSpans = getSessionSceneSpans(id);
  const lines = [
    ["section", "field", "value", "extra", "started_at", "ended_at"].map(csvCell).join(","),
    ["session", "title", summary.session?.title ?? "", "", summary.session?.started_at ?? "", summary.session?.ended_at ?? ""].map(csvCell).join(","),
    ["session", "duration_ms", summary.durationMs, "", "", ""].map(csvCell).join(","),
    ["totals", "events", summary.totals.events, "", "", ""].map(csvCell).join(","),
    ["totals", "follows", summary.totals.follows, "", "", ""].map(csvCell).join(","),
    ["totals", "subs", summary.totals.subs, "", "", ""].map(csvCell).join(","),
    ["totals", "bits", summary.totals.cheers, "", "", ""].map(csvCell).join(","),
    ["totals", "raids", summary.totals.raids, "", "", ""].map(csvCell).join(","),
    ["totals", "channel_points", summary.totals.channelPoints, "", "", ""].map(csvCell).join(","),
    ["totals", "chat_messages", summary.totals.chatMessages, "", "", ""].map(csvCell).join(","),
    ...summary.eventsByType.map((row) =>
      ["event_type", row.eventType, row.count, row.amount, "", ""].map(csvCell).join(","),
    ),
    ...events.map((event) =>
      [
        "event",
        event.event_type,
        event.user_display_name ?? event.user_login ?? "",
        event.amount ?? "",
        event.created_at,
        "",
      ].map(csvCell).join(","),
    ),
    ...sceneSpans.map((span) =>
      ["scene", span.scene_name, "", "", span.started_at, span.ended_at ?? ""].map(csvCell).join(","),
    ),
  ];
  return reply
    .header("Content-Type", "text/csv; charset=utf-8")
    .header("Content-Disposition", `attachment; filename="btv-session-${id}.csv"`)
    .send(lines.join("\n"));
});

app.post("/api/sessions/start", async (req) => {
  const body = req.body as { title?: string };
  const session = startStreamSession(body.title);
  return {
    ok: true,
    code: "SESSION_STARTED",
    title: "Session Started",
    message: session.title,
    color: "#00f593",
    icon: "play",
    session: getStreamSessionSummary(session.id),
  };
});

app.post("/api/sessions/stop", async () => {
  const session = stopCurrentStreamSession();
  return {
    ok: Boolean(session),
    code: session ? "SESSION_STOPPED" : "NO_ACTIVE_SESSION",
    title: session ? "Session Stopped" : "No Active Session",
    message: session ? session.title : "Start a session first",
    color: session ? "#00f593" : "#eb0400",
    icon: session ? "stop" : "alert-triangle",
    session: session ? getStreamSessionSummary(session.id) : getStreamSessionSummary(),
  };
});

app.get("/api/stream-deck/status", async () => {
  const obs = getObsStatus();
  const twitch = getTwitchStatus();
  const overlays = bus.getSnapshot();
  const alerts = alertQueue.getStatus();
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
    state: {
      ...obs,
      currentScene,
      sources: sources ?? [],
    },
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

// Overlay URLs registry
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

// Themes
app.get("/api/themes", async () => getThemes());
app.get("/api/themes/:id", async (req) => {
  const { id } = req.params as { id: string };
  return getTheme(id) ?? { error: "Not found" };
});
app.put("/api/themes/:id", async (req) => {
  const { id } = req.params as { id: string };
  const body = req.body as Theme;
  upsertTheme({ ...body, id });
  return { ok: true };
});
app.delete("/api/themes/:id", async (req) => {
  const { id } = req.params as { id: string };
  if (id === "default") return { error: "Cannot delete default theme" };
  deleteTheme(id);
  return { ok: true };
});

app.get("/api/assets/sounds", async () => ({
  sounds: listSoundAssets(assetsDir),
}));

app.post("/api/assets/sounds", async (req, reply) => {
  const body = req.body as { name: string; data: string };
  if (!body?.name || !body?.data) {
    return reply.status(400).send({ error: "name and data (base64) required" });
  }
  try {
    const buf = Buffer.from(body.data, "base64");
    if (buf.length > 15 * 1024 * 1024) {
      return reply.status(400).send({ error: "File too large (max 15MB)" });
    }
    return saveSoundAsset(assetsDir, body.name, buf);
  } catch (err) {
    return reply.status(400).send({
      error: err instanceof Error ? err.message : "Upload failed",
    });
  }
});

app.delete("/api/assets/sounds/:name", async (req) => {
  deleteSoundAsset(assetsDir, (req.params as { name: string }).name);
  return { ok: true };
});

app.get("/api/assets/media", async () => ({
  media: listMediaAssets(assetsDir),
}));

app.post("/api/assets/media", async (req, reply) => {
  const body = req.body as { name: string; data: string };
  if (!body?.name || !body?.data) {
    return reply.status(400).send({ error: "name and data (base64) required" });
  }
  try {
    const buf = Buffer.from(body.data, "base64");
    if (buf.length > 50 * 1024 * 1024) {
      return reply.status(400).send({ error: "File too large (max 50MB)" });
    }
    return saveMediaAsset(assetsDir, body.name, buf);
  } catch (err) {
    return reply.status(400).send({
      error: err instanceof Error ? err.message : "Upload failed",
    });
  }
});

app.delete("/api/assets/media/:name", async (req) => {
  deleteMediaAsset(assetsDir, (req.params as { name: string }).name);
  return { ok: true };
});

// Alert rules
app.get("/api/alert-rules", async () => getAlertRules());
app.put("/api/alert-rules/:id", async (req) => {
  const body = req.body as AlertRule;
  upsertAlertRule(body);
  return { ok: true };
});

// Widgets
app.get("/api/widgets", async () => getWidgets());
app.get("/api/widgets/chat-config", async () => {
  const w = getWidgets().find((x) => x.type === "chat");
  const cfg = (w?.config ?? {}) as Record<string, unknown>;
  return {
    maxMessages: Number(cfg.maxMessages ?? 20),
    fadeMs: Number(cfg.fadeMs ?? 8000),
  };
});
app.get("/api/widgets/ticker-config", async () => {
  const w = getWidgets().find((x) => x.type === "ticker");
  const cfg = (w?.config ?? {}) as Record<string, unknown>;
  return { maxEvents: Number(cfg.maxEvents ?? 15) };
});
app.put("/api/widgets/:id", async (req) => {
  const body = req.body as WidgetConfig;
  upsertWidget(body);
  return { ok: true };
});

// Goals
app.get("/api/goals", async () => getGoals());
app.put("/api/goals/:id", async (req) => {
  const { id } = req.params as { id: string };
  const body = req.body as { current?: number; target?: number; label?: string };
  const g = getGoal(id);
  if (!g) return { error: "Not found" };
  updateGoal(
    id,
    body.current ?? g.current_count,
    body.target ?? g.target_count,
    body.label,
  );
  const updated = getGoal(id)!;
  bus.broadcast({
    kind: "goal:update",
    goal: {
      id: updated.id,
      label: body.label ?? updated.label,
      current: updated.current_count,
      target: updated.target_count,
      type: updated.type as "follow" | "sub",
    },
  }, "goal");
  return { ok: true };
});

// Webhooks
app.get("/api/webhooks", async () =>
  getWebhooks().map((h) => ({
    ...h,
    url: `${getOverlayOrigin()}/hooks/${h.id}`,
    secret: h.secret ? "••••••••" : undefined,
  })),
);
app.put("/api/webhooks/:id", async (req) => {
  const body = req.body as WebhookHook;
  const existing = getWebhook(body.id);
  const secret = body.secret === "••••••••" ? existing?.secret : body.secret;
  upsertWebhook({ ...body, secret });
  return { ok: true, url: `${getOverlayOrigin()}/hooks/${body.id}` };
});
app.delete("/api/webhooks/:id", async (req) => {
  deleteWebhook((req.params as { id: string }).id);
  return { ok: true };
});
app.get("/api/webhooks/log", async () => getWebhookLog());

app.post("/hooks/:hookId", async (req, reply) => {
  const { hookId } = req.params as { hookId: string };
  const secret = req.headers["x-btv-secret"] as string | undefined;
  const result = await handleWebhook(
    hookId,
    req.body,
    secret,
    rulesEngine,
    effectRunner,
    macroRunner,
    bus,
  );
  if (!result.ok) return reply.status(result.error === "Invalid secret" ? 401 : 404).send(result);
  return result;
});

// Effects
app.get("/api/effects", async () => getEffects());
app.put("/api/effects/:id", async (req) => {
  upsertEffect(req.body as Effect);
  return { ok: true };
});
app.delete("/api/effects/:id", async (req) => {
  deleteEffect((req.params as { id: string }).id);
  return { ok: true };
});
app.post("/api/effects/:id/fire", async (req) => {
  let ok = false;
  let error = "";
  try {
    ok = await effectRunner.fireManual((req.params as { id: string }).id);
  } catch (err) {
    app.log.error({ err }, "Effect fire failed");
    error = err instanceof Error ? err.message : "Effect failed";
  }
  return {
    ok,
    code: ok ? "EFFECT_FIRED" : "EFFECT_BLOCKED",
    title: ok ? "Effect Fired" : "Effect Blocked",
    message: ok ? "The effect was sent to overlays" : error || "Effect missing, on cooldown, or failed",
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "check" : "alert-triangle",
    retryable: !ok,
  };
});

app.post("/api/alerts/clear", async () => ({
  ok: true,
  cleared: alertQueue.clear(),
  queue: alertQueue.getStatus(),
}));

app.get("/api/macros", async () => getMacros());

app.put("/api/macros/:id", async (req) => {
  const { id } = req.params as { id: string };
  const body = req.body as ReturnType<typeof getMacros>[number];
  upsertMacro({ ...body, id });
  return { ok: true };
});

app.delete("/api/macros/:id", async (req) => {
  deleteMacro((req.params as { id: string }).id);
  return { ok: true };
});

app.get("/api/automations", async () => getAutomations());

app.put("/api/automations/:id", async (req) => {
  const id = (req.params as { id: string }).id;
  const body = req.body as Partial<AutomationConfig>;
  const existing = getAutomation(id);
  const automation: AutomationConfig = {
    id,
    name: body.name?.trim() || "Untitled automation",
    enabled: body.enabled ?? true,
    intervalMs: Math.max(5_000, Number(body.intervalMs ?? 60_000)),
    action: body.action ?? "macro",
    actionConfig: body.actionConfig && typeof body.actionConfig === "object" ? body.actionConfig : {},
    runOnStart: Boolean(body.runOnStart),
    lastRunAt: existing?.lastRunAt,
    nextRunAt: existing?.nextRunAt,
    runCount: existing?.runCount ?? 0,
    lastStatus: existing?.lastStatus,
    lastMessage: existing?.lastMessage,
  };
  upsertAutomation(automation);
  automationScheduler.reschedule(id);
  return { ok: true, automation: getAutomation(id) };
});

app.delete("/api/automations/:id", async (req) => {
  const id = (req.params as { id: string }).id;
  automationScheduler.clear(id);
  deleteAutomation(id);
  return { ok: true };
});

app.post("/api/automations/:id/run", async (req, reply) => {
  const result = await automationScheduler.runNow((req.params as { id: string }).id);
  return reply.status(result.ok ? 200 : 409).send({
    ok: result.ok,
    code: result.ok ? "AUTOMATION_RUN" : "AUTOMATION_FAILED",
    title: result.ok ? "Automation Run" : "Automation Failed",
    message: result.message,
    color: result.ok ? "#00f593" : "#eb0400",
    icon: result.ok ? "check" : "alert-triangle",
    retryable: !result.ok,
  });
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

app.get("/api/actions/macro/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const macro = getMacro(id);
  if (!macro) {
    return reply.status(404).type("text/html").send(`<!doctype html>
      <html lang="en">
        <head><title>Macro not found</title></head>
        <body style="font-family: system-ui, sans-serif; background: #0e0e10; color: #efeff1; padding: 24px;">
          <h1>Macro not found</h1>
          <p>No macro exists with id <code>${escapeHtml(id)}</code>.</p>
        </body>
      </html>`);
  }

  return reply.type("text/html").send(`<!doctype html>
    <html lang="en">
      <head>
        <title>${escapeHtml(macro.name)} - BTV Macro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="font-family: system-ui, sans-serif; background: #0e0e10; color: #efeff1; padding: 24px;">
        <main style="max-width: 560px;">
          <h1 style="margin: 0 0 8px;">${escapeHtml(macro.name)}</h1>
          <p style="color: #adadb8;">This macro action uses POST. Click Run to trigger it from this local page.</p>
          <button id="run" type="button" style="background: #9147ff; color: white; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer;">
            Run macro
          </button>
          <pre id="result" style="margin-top: 16px; white-space: pre-wrap; background: #18181b; border: 1px solid #2d2d35; border-radius: 8px; padding: 12px;"></pre>
        </main>
        <script>
          const button = document.getElementById("run");
          const result = document.getElementById("result");
          button.addEventListener("click", async () => {
            button.disabled = true;
            result.textContent = "Running...";
            try {
              const res = await fetch(location.pathname, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}"
              });
              const json = await res.json();
              result.textContent = JSON.stringify(json, null, 2);
            } catch (err) {
              result.textContent = err instanceof Error ? err.message : "Macro failed";
            } finally {
              button.disabled = false;
            }
          });
        </script>
      </body>
    </html>`);
});

app.post("/api/actions/macro/:id", async (req, reply) => {
  const result = await macroRunner.run((req.params as { id: string }).id);
  return reply.status(result.ok ? 200 : 409).send(result);
});

app.get("/api/source-groups", async () => getSourceGroups());

app.put("/api/source-groups/:id", async (req) => {
  const id = (req.params as { id: string }).id;
  const body = req.body as Partial<SourceGroup>;
  const group: SourceGroup = {
    id,
    name: body.name?.trim() || "Untitled activity",
    sceneName: body.sceneName?.trim() || "",
    sources: Array.isArray(body.sources) ? body.sources : [],
    updatedAt: new Date().toISOString(),
  };
  upsertSourceGroup(group);
  return { ok: true, group };
});

app.delete("/api/source-groups/:id", async (req) => {
  deleteSourceGroup((req.params as { id: string }).id);
  return { ok: true };
});

app.post("/api/source-groups/:id/capture", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const group = getSourceGroup(id);
  if (!group) return reply.status(404).send({ ok: false, message: "Activity layout not found" });
  const body = req.body as { sourceNames?: string[] };
  const selected = new Set(body.sourceNames?.length ? body.sourceNames : group.sources.map((s) => s.sourceName));
  const sources = await Promise.all(
    [...selected].map(async (sourceName) => {
      const transform = await getObsSourceTransform(group.sceneName, sourceName);
      return {
        sourceName,
        transform: transform ? writableObsTransformSnapshot(transform) : undefined,
      };
    }),
  );
  const updated = { ...group, sources, updatedAt: new Date().toISOString() };
  upsertSourceGroup(updated);
  return { ok: true, group: updated };
});

app.post("/api/actions/source-group/:id", async (req, reply) => {
  const result = await applySourceGroup((req.params as { id: string }).id);
  return reply.status(result.ok ? 200 : 503).send(result);
});

async function applySourceGroup(id: string): Promise<{
  ok: boolean;
  code: string;
  title: string;
  message: string;
  color: string;
  icon: string;
  retryable: boolean;
  state?: Record<string, unknown>;
}> {
  const group = getSourceGroup(id);
  if (!group) {
    return {
      ok: false,
      code: "SOURCE_GROUP_NOT_FOUND",
      title: "Layout Missing",
      message: "No activity layout exists with that id",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    };
  }

  const sceneSources = await listObsSceneSources(group.sceneName);
  if (!sceneSources) {
    return {
      ok: false,
      code: "OBS_SCENE_UNAVAILABLE",
      title: "Scene Unavailable",
      message: `Could not read sources for ${group.sceneName}`,
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: true,
    };
  }

  const included = new Map(group.sources.map((source) => [source.sourceName, source]));
  let changed = 0;
  for (const source of sceneSources) {
    const groupSource = included.get(source.sourceName);
    const shouldShow = Boolean(groupSource);
    if (source.sceneItemEnabled !== shouldShow) {
      const ok = await setObsSourceVisible(group.sceneName, source.sourceName, shouldShow);
      if (ok) changed += 1;
    }
    if (groupSource?.transform) {
      const ok = await setObsSourceTransform(
        group.sceneName,
        source.sourceName,
        writableObsTransformSnapshot(groupSource.transform),
      );
      if (ok) changed += 1;
    }
  }

  setSetting("active_source_group_id", group.id);
  setSetting("active_source_group_name", group.name);
  setSetting("active_source_group_scene", group.sceneName);

  return {
    ok: true,
    code: "SOURCE_GROUP_APPLIED",
    title: "Activity Live",
    message: `${group.name}: ${group.sources.length} source${group.sources.length === 1 ? "" : "s"} active`,
    color: "#00f593",
    icon: "layers",
    retryable: false,
    state: {
      sceneName: group.sceneName,
      groupId: group.id,
      changed,
    },
  };
}

app.get("/api/obs/scenes", async (req, reply) => {
  const scenes = await listObsScenes();
  if (!scenes) {
    return reply.status(503).send({
      ok: false,
      code: "OBS_DISCONNECTED",
      title: "OBS Offline",
      message: "Could not reach OBS WebSocket",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: true,
      scenes: [],
    });
  }
  return {
    ok: true,
    currentScene: await getCurrentObsScene(),
    scenes,
  };
});

app.get("/api/obs/scenes/:sceneName/sources", async (req, reply) => {
  const { sceneName } = req.params as { sceneName: string };
  const sources = await listObsSceneSources(sceneName);
  if (!sources) {
    return reply.status(503).send({
      ok: false,
      code: "OBS_SCENE_UNAVAILABLE",
      title: "Scene Unavailable",
      message: `Could not read sources for ${sceneName}`,
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: true,
      sources: [],
    });
  }
  return {
    ok: true,
    sceneName,
    sources,
  };
});

app.post("/api/actions/obs/scene", async (req, reply) => {
  const body = req.body as { sceneName?: string };
  const sceneName = body.sceneName?.trim();
  if (!sceneName) {
    return reply.status(400).send({
      ok: false,
      code: "SCENE_REQUIRED",
      title: "No Scene",
      message: "sceneName is required",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    });
  }

  const ok = await setObsScene(sceneName);
  return reply.status(ok ? 200 : 503).send({
    ok,
    code: ok ? "OBS_SCENE_CHANGED" : "OBS_DISCONNECTED",
    title: ok ? "Scene Live" : "OBS Offline",
    message: ok ? `Switched to ${sceneName}` : "Could not reach OBS WebSocket",
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "check" : "alert-triangle",
    retryable: !ok,
    state: {
      obsConnected: ok,
      scene: ok ? sceneName : undefined,
    },
  });
});

app.post("/api/actions/obs/source-visibility", async (req, reply) => {
  const body = req.body as { sceneName?: string; sourceName?: string; visible?: boolean };
  const sceneName = body.sceneName?.trim();
  const sourceName = body.sourceName?.trim();
  if (!sceneName || !sourceName || typeof body.visible !== "boolean") {
    return reply.status(400).send({
      ok: false,
      code: "SOURCE_VISIBILITY_REQUIRED",
      title: "Missing Source",
      message: "sceneName, sourceName, and visible are required",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    });
  }

  const ok = await setObsSourceVisible(sceneName, sourceName, body.visible);
  return reply.status(ok ? 200 : 503).send({
    ok,
    code: ok ? "OBS_SOURCE_VISIBILITY_CHANGED" : "OBS_SOURCE_UNAVAILABLE",
    title: ok ? "Source Updated" : "Source Unavailable",
    message: ok
      ? `${sourceName} is ${body.visible ? "visible" : "hidden"}`
      : `Could not update ${sourceName} in ${sceneName}`,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "eye" : "alert-triangle",
    retryable: !ok,
    state: {
      obsConnected: ok,
      sceneName,
      sourceName,
      visible: body.visible,
    },
  });
});

app.post("/api/actions/obs/source-motion", async (req, reply) => {
  const body = req.body as {
    sceneName?: string;
    sourceName?: string;
    mode?: "set" | "dvd" | "path";
    durationMs?: number;
    fps?: number;
    visible?: boolean;
    restore?: boolean;
    boundsWidth?: number;
    boundsHeight?: number;
    speedX?: number;
    speedY?: number;
    x?: number;
    y?: number;
    scale?: number;
    width?: number;
    height?: number;
    path?: Array<{ x: number; y: number; scale?: number }>;
  };
  const sceneName = body.sceneName?.trim();
  const sourceName = body.sourceName?.trim();
  if (!sceneName || !sourceName) {
    return reply.status(400).send({
      ok: false,
      code: "SOURCE_MOTION_REQUIRED",
      title: "Missing Source",
      message: "sceneName and sourceName are required",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    });
  }

  const ok = await runObsSourceMotion({ ...body, sceneName, sourceName });
  return reply.status(ok ? 200 : 503).send({
    ok,
    code: ok ? "OBS_SOURCE_MOTION_COMPLETE" : "OBS_SOURCE_MOTION_FAILED",
    title: ok ? "Motion Complete" : "Motion Failed",
    message: ok
      ? `${sourceName} ${body.mode ?? "set"} motion completed`
      : `Could not move ${sourceName} in ${sceneName}`,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "move" : "alert-triangle",
    retryable: !ok,
    state: {
      obsConnected: ok,
      sceneName,
      sourceName,
      mode: body.mode ?? "set",
    },
  });
});

app.post("/api/actions/obs/text", async (req, reply) => {
  const body = req.body as { inputName?: string; text?: string };
  const inputName = body.inputName?.trim();
  if (!inputName || body.text == null) {
    return reply.status(400).send({
      ok: false,
      code: "TEXT_INPUT_REQUIRED",
      title: "Missing Text",
      message: "inputName and text are required",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    });
  }

  const ok = await setObsText(inputName, body.text);
  return reply.status(ok ? 200 : 503).send({
    ok,
    code: ok ? "OBS_TEXT_UPDATED" : "OBS_INPUT_UNAVAILABLE",
    title: ok ? "Text Updated" : "Input Unavailable",
    message: ok ? `${inputName} updated` : `Could not update ${inputName}`,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "type" : "alert-triangle",
    retryable: !ok,
    state: {
      obsConnected: ok,
      inputName,
    },
  });
});

app.post("/api/actions/obs/input-settings", async (req, reply) => {
  const body = req.body as {
    inputName?: string;
    inputSettings?: Record<string, unknown>;
    overlay?: boolean;
  };
  const inputName = body.inputName?.trim();
  if (!inputName || !body.inputSettings || typeof body.inputSettings !== "object") {
    return reply.status(400).send({
      ok: false,
      code: "INPUT_SETTINGS_REQUIRED",
      title: "Missing Settings",
      message: "inputName and inputSettings are required",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    });
  }

  const ok = await setObsInputSettings(inputName, body.inputSettings, body.overlay ?? true);
  return reply.status(ok ? 200 : 503).send({
    ok,
    code: ok ? "OBS_INPUT_SETTINGS_UPDATED" : "OBS_INPUT_UNAVAILABLE",
    title: ok ? "Input Updated" : "Input Unavailable",
    message: ok ? `${inputName} updated` : `Could not update ${inputName}`,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "sliders" : "alert-triangle",
    retryable: !ok,
    state: {
      obsConnected: ok,
      inputName,
    },
  });
});

// Activity & test
app.get("/api/activity", async () =>
  getActivity().flatMap((r) => {
    try {
      return [{
        id: r.id,
        event: JSON.parse(r.event_json),
        at: r.created_at,
      }];
    } catch {
      return [];
    }
  }),
);

app.post("/api/test/alert/:eventType", async (req, reply) => {
  const { eventType } = req.params as { eventType: StreamEventType };
  try {
    await rulesEngine.fireTestAlert(eventType);
    return { ok: true };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({
      error: err instanceof Error ? err.message : "Test alert failed",
    });
  }
});

// Integrations config
app.get("/api/integrations", async (_req, reply) => {
  try {
    return {
      oauthHost: getOAuthHost(),
      twitch: {
        ...getTwitchStatus(),
        clientId: getSetting("twitch_client_id") ?? "",
        redirectUri: getTwitchRedirectUri(),
        authStartUrl: getTwitchAuthStartUrl(),
      },
      spotify: {
        ...getSpotifyStatus(),
        clientId: getSetting("spotify_client_id") ?? "",
        redirectUri: getSpotifyRedirectUri(),
        authStartUrl: getSpotifyAuthStartUrl(),
      },
      obs: getObsStatus(),
    };
  } catch (err) {
    app.log.error(err);
    return reply.status(500).send({
      error: err instanceof Error ? err.message : "Failed to load integrations",
    });
  }
});

app.put("/api/integrations/oauth-host", async (req) => {
  const body = req.body as { host: string };
  setOAuthHost(body.host);
  return {
    ok: true,
    oauthHost: getOAuthHost(),
    twitchRedirectUri: getTwitchRedirectUri(),
    spotifyRedirectUri: getSpotifyRedirectUri(),
  };
});

app.put("/api/integrations/twitch", async (req) => {
  const body = req.body as { clientId: string; clientSecret?: string };
  setSetting("twitch_client_id", body.clientId);
  if (body.clientSecret?.trim()) {
    setEncryptedSetting("twitch_client_secret", body.clientSecret);
  }
  return { ok: true, redirectUri: getTwitchRedirectUri() };
});

app.put("/api/integrations/spotify", async (req) => {
  const body = req.body as { clientId: string; clientSecret?: string };
  setSetting("spotify_client_id", body.clientId);
  if (body.clientSecret?.trim()) {
    setEncryptedSetting("spotify_client_secret", body.clientSecret);
  }
  return { ok: true };
});

app.put("/api/integrations/obs", async (req) => {
  const body = req.body as { host: string; port: number; password?: string };
  setSetting("obs_host", body.host);
  setSetting("obs_port", String(body.port));
  if (body.password?.trim()) {
    setEncryptedSetting("obs_password", body.password);
  }
  const ok = await connectObs();
  return { ok };
});

oauthApp.get("/auth/twitch", async (_req, reply) => {
  const config = getTwitchConfig();
  if (!config) return reply.status(400).send({ error: "Configure Twitch client ID/secret first" });
  const state = crypto.randomUUID();
  setSetting("oauth_state", state);
  app.log.info({ redirectUri: config.redirectUri }, "Twitch OAuth redirect_uri");
  return reply.redirect(getAuthorizeUrl(config, state));
});

oauthApp.get("/auth/twitch/callback", async (req, reply) => {
  const query = req.query as {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  };

  if (query.error) {
    const desc = encodeURIComponent(query.error_description ?? query.error);
    return reply.redirect(
      `${getHubOrigin()}/integrations?twitch_error=${query.error}&desc=${desc}`,
    );
  }

  if (!query.code || query.state !== getSetting("oauth_state")) {
    return reply.redirect(`${getHubOrigin()}/integrations?error=oauth`);
  }
  await handleTwitchCallback(query.code);
  bootEventSub();
  return reply.redirect(`${getHubOrigin()}/integrations?twitch=connected`);
});

app.post("/api/integrations/twitch/disconnect", async () => {
  disconnectTwitch();
  return { ok: true };
});

app.post("/api/integrations/spotify/disconnect", async () => {
  disconnectSpotify();
  return { ok: true };
});

// Spotify OAuth on HTTP :4782 (Spotify requires loopback http://127.0.0.1, not https://4783)
app.get("/auth/spotify", async (_req, reply) => {
  const state = crypto.randomUUID();
  setSetting("spotify_oauth_state", state);
  return reply.redirect(getSpotifyAuthUrl(state));
});

app.get("/auth/spotify/callback", async (req, reply) => {
  const query = req.query as { code?: string; state?: string; error?: string };
  if (query.error) {
    return reply.redirect(
      `${getHubOrigin()}/integrations?spotify_error=${encodeURIComponent(query.error)}`,
    );
  }
  if (!query.code || query.state !== getSetting("spotify_oauth_state")) {
    return reply.redirect(`${getHubOrigin()}/integrations?error=oauth`);
  }
  try {
    await handleSpotifyCallback(query.code);
    startSpotifyPoller(bus);
    return reply.redirect(`${getHubOrigin()}/integrations?spotify=connected`);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Spotify connect failed");
    return reply.redirect(`${getHubOrigin()}/integrations?spotify_error=${msg}`);
  }
});

function bootEventSub(): void {
  startEventSub(
    (e) => void rulesEngine.handleEvent(e),
    (s) => {
      setSetting("twitch_eventsub_status", s);
      if (s.startsWith("sub_error:")) app.log.warn({ status: s }, "EventSub subscription issue");
    },
  );
}

// Boot services if already authenticated
if (isTwitchConfigured()) {
  bootEventSub();
}
if (getSpotifyStatus().connected) {
  startSpotifyPoller(bus);
}
automationScheduler.startAll();

setInterval(() => bus.pingAll(), 30000);

// Broadcast initial goal state
for (const g of getGoals()) {
  bus.broadcast({
    kind: "goal:update",
    goal: {
      id: g.id,
      label: g.label,
      current: g.current_count,
      target: g.target_count,
      type: g.type as "follow" | "sub",
    },
  }, "goal");
}

oauthApp.get("/", async () => ({
  ok: true,
  service: "BTV OAuth (HTTPS) — Twitch only",
  twitchRedirect: getTwitchRedirectUri(),
  spotifyRedirect: getSpotifyRedirectUri(),
  spotifyNote: "Spotify uses HTTP on port 4782",
}));

// Legacy/wrong links to https://127.0.0.1:4783/auth/spotify → correct HTTP endpoint
oauthApp.get("/auth/spotify", async (_req, reply) => {
  return reply.redirect(`${getOverlayOrigin()}/auth/spotify`);
});

oauthApp.get("/auth/spotify/callback", async (req, reply) => {
  return reply.redirect(`${getOverlayOrigin()}${req.url}`);
});

try {
  await app.listen({ host: HOST, port: OVERLAY_PORT });
  await oauthApp.listen({ host: HOST, port: OAUTH_HTTPS_PORT });
  if (getObsStatus().hasPassword) {
    void connectObs();
  }
  console.log(`Overlay server (HTTP)  ${getOverlayOrigin()}`);
  console.log(`OAuth server (HTTPS)   ${getOAuthOrigin()}`);
  console.log(`TLS certificate: ${getCertPaths().certDir}`);
  console.log(`Open ${getOAuthOrigin()} once and accept the certificate before Connect Twitch.`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
