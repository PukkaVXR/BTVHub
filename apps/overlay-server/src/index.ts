import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOST, OAUTH_HTTPS_PORT, OVERLAY_PORT } from "@btv/shared";
import { AlertQueue } from "./alert-queue.js";
import { AutomationScheduler } from "./automation-scheduler.js";
import { ensureApiToken, isAllowedOrigin, requireTrustedLocalWrite } from "./auth.js";
import { OverlayBus } from "./bus.js";
import { ChatTimerScheduler } from "./chat-timer-scheduler.js";
import { CoreEventBus } from "./core-event-bus.js";
import { initDb, getGoals, logSystem, setSetting } from "./db.js";
import { EffectRunner } from "./effect-runner.js";
import { EventAutomationEngine } from "./event-automation-engine.js";
import { MacroRunner } from "./macro-runner.js";
import { connectObs, getObsStatus, setObsSceneChangedHandler } from "./obs-client.js";
import { registerRoutes } from "./routes/index.js";
import { RulesEngine } from "./rules-engine.js";
import { getOAuthOrigin, getOverlayOrigin } from "./server-urls.js";
import { applySourceGroup } from "./services/source-groups.js";
import { getSpotifyStatus, startSpotifyPoller } from "./spotify-service.js";
import { ensureTlsMaterial, getCertPaths } from "./tls.js";
import {
  getTwitchStatus,
  isTwitchConfigured,
  startEventSub,
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
    const channels = url.searchParams.get("channels")?.split(",").filter(Boolean) ?? ["*"];
    bus.addClient(socket, channels, url.searchParams.get("route") ?? undefined);
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

setInterval(() => bus.pingAll(), 30000);
setInterval(() => {
  coreEvents.publishSystem("timer.minute", { intervalMs: 60_000 });
}, 60_000);

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
