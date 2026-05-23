import type { FastifyInstance } from "fastify";
import type { AlertQueue } from "../alert-queue.js";
import type { AutomationScheduler } from "../automation-scheduler.js";
import type { OverlayBus } from "../bus.js";
import type { EffectRunner } from "../effect-runner.js";
import type { EventAutomationEngine } from "../event-automation-engine.js";
import type { MacroRunner } from "../macro-runner.js";
import type { RulesEngine } from "../rules-engine.js";
import type { ApplySourceGroupResult } from "../services/source-groups.js";
import type { getObsStatus } from "../obs-client.js";
import type { getSpotifyStatus } from "../spotify-service.js";
import type { getTwitchStatus } from "../twitch-service.js";

export interface ServerContext {
  assetsDir: string;
  bus: OverlayBus;
  alertQueue: AlertQueue;
  effectRunner: EffectRunner;
  macroRunner: MacroRunner;
  rulesEngine: RulesEngine;
  automationScheduler: AutomationScheduler;
  eventAutomationEngine: EventAutomationEngine;
  applySourceGroup: (id: string) => Promise<ApplySourceGroupResult>;
  bootEventSub: () => void;
  safeStatus: <T>(label: string, fallback: T, read: () => T) => T;
  twitchStatusFallback: ReturnType<typeof getTwitchStatus>;
  spotifyStatusFallback: ReturnType<typeof getSpotifyStatus>;
  obsStatusFallback: ReturnType<typeof getObsStatus>;
}

export type RouteModule = (app: FastifyInstance, ctx: ServerContext) => void;
