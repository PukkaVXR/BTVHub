import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOST, OAUTH_HTTPS_PORT, OVERLAY_PORT } from "@btv/shared";
import { AlertQueue } from "./alert-queue.js";
import { AutomationScheduler } from "./automation-scheduler.js";
import { ensureApiToken, isAllowedOrigin, issueApiTokenToTrustedHub, requireTrustedLocalWrite } from "./auth.js";
import { OverlayBus } from "./bus.js";
import { ChatTimerScheduler } from "./chat-timer-scheduler.js";
import { CoreEventBus } from "./core-event-bus.js";
import { initDb, getGoals, logSystem, setSetting } from "./db.js";
import { EffectRunner } from "./effect-runner.js";
import { EventAutomationEngine } from "./event-automation-engine.js";
import { MacroRunner } from "./macro-runner.js";
import { connectObs, disconnectObs, getObsStatus, setObsSceneChangedHandler } from "./obs-client.js";
import { registerRoutes } from "./routes/index.js";
import { RulesEngine } from "./rules-engine.js";
import { getOAuthOrigin, getOverlayOrigin } from "./server-urls.js";
import { applySourceGroup } from "./services/source-groups.js";
import { getSpotifyStatus, startSpotifyPoller, stopSpotifyPoller } from "./spotify-service.js";
import { ensureTlsMaterial, getCertPaths } from "./tls.js";
import {
  getTwitchStatus,
  isTwitchConfigured,
  startEventSub,
  stopEventSub,
} from "./twitch-service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const assetsDir = join(__dirname, "../../../assets");

initDb();
ensureApiToken();

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
const coreEvents = new CoreEventBus();
const alertQueue = new AlertQueue(bus);
const effectRunner = new EffectRunner(bus);
const macroRunner = new MacroRunner(alertQueue, effectRunner);
const eventAutomationEngine = new EventAutomationEngine(
  macroRunner,
  effectRunner,
  bus,
  alertQueue,
  applySourceGroup,
);
coreEvents.subscribe((event) => eventAutomationEngine.handleCoreEvent(event));
setObsSceneChangedHandler((sceneName) => {
  coreEvents.publish({
    id: crypto.randomUUID(),
    type: "obs.scene_changed",
    source: "obs",
    timestamp: new Date().toISOString(),
    payload: { sceneName },
    metadata: { sceneName },
  });
});
const rulesEngine = new RulesEngine(bus, alertQueue, effectRunner, coreEvents, eventAutomationEngine);
const automationScheduler = new AutomationScheduler(
  macroRunner,
  effectRunner,
  applySourceGroup,
);
const chatTimerScheduler = new ChatTimerScheduler();

function errorDetails(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { message: String(err) };
}

function installReliabilityHandlers(server: { setErrorHandler: (handler: (...args: any[]) => unknown) => void; setNotFoundHandler: (handler: (...args: any[]) => unknown) => void }, source: string): void {
  server.setErrorHandler((err, req, reply) => {
    const error = err as Error & { statusCode?: number };
    const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;
    logSystem("server", statusCode >= 500 ? "error" : "warn", `${source} request failed`, {
      method: req.method,
      url: req.url,
      statusCode,
      ...errorDetails(error),
    });
    req.log.error({ err: error, statusCode }, "Request failed");
    reply.status(statusCode).send({
      ok: false,
      code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED",
      message: statusCode >= 500 ? "Internal Server Error" : error.message,
    });
  });

  server.setNotFoundHandler((req, reply) => {
    logSystem("server", "warn", `${source} route not found`, {
      method: req.method,
      url: req.url,
    });
    reply.status(404).send({
      ok: false,
      code: "NOT_FOUND",
      message: "Route not found",
    });
  });
}

process.on("unhandledRejection", (reason) => {
  logSystem("process", "error", "Unhandled promise rejection", errorDetails(reason));
  app.log.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logSystem("process", "error", "Uncaught exception", errorDetails(err));
  app.log.fatal({ err }, "Uncaught exception");
});

installReliabilityHandlers(app, "HTTP");
installReliabilityHandlers(oauthApp, "OAuth");

let shuttingDown = false;
const backgroundIntervals: Array<ReturnType<typeof setInterval>> = [];

async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logSystem("process", "info", "Overlay server shutting down", { reason });

  for (const interval of backgroundIntervals) clearInterval(interval);
  automationScheduler.stopAll();
  chatTimerScheduler.stop();
  alertQueue.shutdown();
  stopSpotifyPoller();
  stopEventSub();
  bus.closeAll();

  await disconnectObs();
  await Promise.allSettled([app.close(), oauthApp.close()]);
  logSystem("process", "info", "Overlay server shutdown complete", { reason });
}

function installSignalShutdown(signal: NodeJS.Signals): void {
  process.once(signal, () => {
    void shutdown(signal).finally(() => process.exit(0));
  });
}

installSignalShutdown("SIGINT");
installSignalShutdown("SIGTERM");

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
  scopes: [],
  chatSubscribed: false,
  chat: {
    status: "error",
    connected: false,
    canRead: false,
    canWrite: false,
    detail: "Twitch status unavailable",
  },
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

const PUBLIC_OVERLAY_CHANNELS = new Set([
  "alerts",
  "effects",
  "chat",
  "goal",
  "ticker",
  "eventList",
  "nowPlaying",
]);

function isPublicOverlayRoute(route: string | null): boolean {
  return Boolean(route?.startsWith("/o/"));
}

function sanitizePublicOverlayChannels(channels: string[]): string[] {
  const requested = channels.length ? channels : Array.from(PUBLIC_OVERLAY_CHANNELS);
  return Array.from(new Set(requested.filter((channel) => PUBLIC_OVERLAY_CHANNELS.has(channel))));
}

function bootEventSub(): void {
  startEventSub(
    (e) => void rulesEngine.handleEvent(e),
    (s) => {
      setSetting("twitch_eventsub_status", s);
      logSystem(
        "twitch",
        s.startsWith("sub_error:") ? "error" : "info",
        "Twitch EventSub status changed",
        { status: s },
      );
      if (s.startsWith("sub_error:")) app.log.warn({ status: s }, "EventSub subscription issue");
    },
  );
}

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    cb(null, isAllowedOrigin(origin));
  },
};

await app.register(cors, corsOptions);
await oauthApp.register(cors, corsOptions);
app.get("/api/auth/token", issueApiTokenToTrustedHub);
app.addHook("preHandler", requireTrustedLocalWrite);
await app.register(fastifyStatic, { root: publicDir, prefix: "/" });
await app.register(fastifyStatic, { root: assetsDir, prefix: "/assets/", decorateReply: false });
await app.register(websocket);

app.addHook("onRequest", async (req, reply) => {
  const path = req.url.split("?")[0];
  if (path.startsWith("/auth/twitch")) {
    return reply.redirect(`${getOAuthOrigin()}${req.url}`);
  }
});

app.register(async (fastify) => {
  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? "", getOverlayOrigin());
    const route = url.searchParams.get("route");
    if (!isPublicOverlayRoute(route)) {
      logSystem("overlay", "warn", "Rejected non-public overlay WebSocket connection", { route });
      socket.close(1008, "Public overlay route required");
      return;
    }
    const channels = sanitizePublicOverlayChannels(
      url.searchParams.get("channels")?.split(",").filter(Boolean) ?? [],
    );
    if (!channels.length) {
      logSystem("overlay", "warn", "Rejected overlay WebSocket connection with no public channels", { route });
      socket.close(1008, "No public overlay channels requested");
      return;
    }
    bus.addClient(socket, channels, route ?? undefined);
  });
});

registerRoutes(app, oauthApp, {
  assetsDir,
  bus,
  coreEvents,
  alertQueue,
  effectRunner,
  macroRunner,
  rulesEngine,
  automationScheduler,
  eventAutomationEngine,
  applySourceGroup,
  bootEventSub,
  safeStatus,
  twitchStatusFallback,
  spotifyStatusFallback,
  obsStatusFallback,
});

if (isTwitchConfigured()) {
  bootEventSub();
}
if (getSpotifyStatus().connected) {
  startSpotifyPoller(bus);
}
automationScheduler.startAll();
chatTimerScheduler.start();
logSystem("recovery", "info", "Alert queue starts empty after restart", {
  persisted: false,
  reason: "Queued/current alerts are live stream state and are not replayed automatically.",
});
logSystem("recovery", "info", "Automation and chat timer schedules resumed", {
  automations: "rescheduled from stored definitions",
  chatTimers: "last run timestamps are persisted",
});

backgroundIntervals.push(setInterval(() => bus.pingAll(), 30000));
backgroundIntervals.push(
  setInterval(() => {
    coreEvents.publishSystem("timer.minute", { intervalMs: 60_000 });
  }, 60_000),
);

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
