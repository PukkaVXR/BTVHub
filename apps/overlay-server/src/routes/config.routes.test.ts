import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerContext } from "./types.js";

const db = vi.hoisted(() => ({
  getConfigProfileSnapshot: vi.fn(),
  getGoals: vi.fn(),
  logSystem: vi.fn(),
  replaceConfigProfileSnapshot: vi.fn(),
}));

vi.mock("../db.js", () => ({
  getConfigProfileSnapshot: db.getConfigProfileSnapshot,
  getGoals: db.getGoals,
  logSystem: db.logSystem,
  replaceConfigProfileSnapshot: db.replaceConfigProfileSnapshot,
}));

import { registerConfigRoutes } from "./config.routes.js";

describe("registerConfigRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("exports a versioned config profile envelope", async () => {
    db.getConfigProfileSnapshot.mockReturnValue({
      settings: [{ key: "api_token", value: "secret-value" }],
      themes: [],
      alertRules: [],
      alertProjects: [],
      widgets: [],
      goals: [],
      effects: [],
      macros: [],
      automations: [],
      automationRules: [],
      sourceGroups: [],
      webhooks: [],
    });

    const app = Fastify();
    registerConfigRoutes(app, createContext());

    const response = await app.inject({ method: "GET", url: "/api/config/export" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      format: "btv.config-profile",
      version: 1,
      profile: {
        settings: [{ key: "api_token", value: "secret-value" }],
      },
    });
    expect(db.logSystem).toHaveBeenCalledWith("config", "info", "Configuration profile exported");

    await app.close();
  });

  it("imports the versioned profile, restarts automations, and broadcasts goals", async () => {
    db.getGoals.mockReturnValue([
      {
        id: "goal-1",
        label: "Follow goal",
        type: "follow",
        current_count: 12,
        target_count: 25,
      },
    ]);

    const context = createContext();
    const app = Fastify();
    registerConfigRoutes(app, context);

    const response = await app.inject({
      method: "POST",
      url: "/api/config/import",
      payload: {
        profile: {
          format: "btv.config-profile",
          version: 1,
          exportedAt: "2026-06-23T00:00:00.000Z",
          profile: {
            settings: [{ key: "dashboard_auth", value: "enabled" }],
            themes: [],
            alertRules: [],
            alertProjects: [],
            widgets: [],
            goals: [{ id: "goal-1", label: "Follow goal", type: "follow", current_count: 12, target_count: 25 }],
            effects: [],
            macros: [],
            automations: [],
            automationRules: [],
            sourceGroups: [],
            webhooks: [],
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(db.replaceConfigProfileSnapshot).toHaveBeenCalledWith({
      settings: [{ key: "dashboard_auth", value: "enabled" }],
      themes: [],
      alertRules: [],
      alertProjects: [],
      widgets: [],
      goals: [{ id: "goal-1", label: "Follow goal", type: "follow", current_count: 12, target_count: 25 }],
      effects: [],
      macros: [],
      automations: [],
      automationRules: [],
      sourceGroups: [],
      webhooks: [],
    });
    expect(context.automationScheduler.stopAll).toHaveBeenCalledTimes(1);
    expect(context.automationScheduler.startAll).toHaveBeenCalledTimes(1);
    expect(context.bus.broadcast).toHaveBeenCalledWith({
      kind: "goal:update",
      goal: {
        id: "goal-1",
        label: "Follow goal",
        current: 12,
        target: 25,
        type: "follow",
      },
    }, "goal");

    await app.close();
  });

  it("accepts legacy top-level exports and rejects malformed profiles", async () => {
    const context = createContext();
    const app = Fastify();
    registerConfigRoutes(app, context);

    const legacyResponse = await app.inject({
      method: "POST",
      url: "/api/config/import",
      payload: {
        profile: {
          settings: [{ key: "theme", value: "arcade" }],
          themes: [],
          alertRules: [],
          alertProjects: [],
          widgets: [],
          goals: [],
          effects: [],
          macros: [],
          automations: [],
          automationRules: [],
          sourceGroups: [],
          webhooks: [],
        },
      },
    });
    const invalidResponse = await app.inject({
      method: "POST",
      url: "/api/config/import",
      payload: { profile: { format: "btv.config-profile", version: 1, profile: { themes: [] } } },
    });

    expect(legacyResponse.statusCode).toBe(200);
    expect(db.replaceConfigProfileSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      settings: [{ key: "theme", value: "arcade" }],
    }));
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json()).toEqual({ error: "Valid BTV config profile export is required" });

    await app.close();
  });
});

function createContext(): ServerContext & {
  bus: { broadcast: ReturnType<typeof vi.fn> };
  automationScheduler: {
    startAll: ReturnType<typeof vi.fn>;
    stopAll: ReturnType<typeof vi.fn>;
  };
} {
  const bus = { broadcast: vi.fn() };
  const automationScheduler = {
    startAll: vi.fn(),
    stopAll: vi.fn(),
  };
  return {
    assetsDir: "",
    alertQueue: {} as never,
    applySourceGroup: vi.fn(),
    bootEventSub: vi.fn(),
    bus: bus as never,
    coreEvents: {} as never,
    effectRunner: {} as never,
    eventAutomationEngine: {} as never,
    macroRunner: {} as never,
    obsStatusFallback: {} as never,
    rulesEngine: {} as never,
    safeStatus: vi.fn(),
    spotifyStatusFallback: {} as never,
    automationScheduler: automationScheduler as never,
    twitchStatusFallback: {} as never,
  };
}
