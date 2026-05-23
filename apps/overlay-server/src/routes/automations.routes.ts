import { createStreamEvent, type StreamEventType } from "@btv/shared";
import {
  deleteAutomation,
  deleteAutomationRule,
  getAutomation,
  getAutomationRule,
  getAutomationRules,
  getAutomationRuns,
  getAutomations,
  upsertAutomation,
  upsertAutomationRule,
  type AutomationConfig,
} from "../db.js";
import { automationFromBody, AutomationRuleSchema } from "../schemas/automation.schema.js";
import type { RouteModule } from "./types.js";

export const registerAutomationsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/automations", async () => getAutomations());
  app.put("/api/automations/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const automation = automationFromBody(id, req.body as Partial<AutomationConfig>, getAutomation(id));
    upsertAutomation(automation);
    ctx.automationScheduler.reschedule(id);
    return { ok: true, automation: getAutomation(id) };
  });
  app.delete("/api/automations/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    ctx.automationScheduler.clear(id);
    deleteAutomation(id);
    return { ok: true };
  });
  app.post("/api/automations/:id/run", async (req, reply) => {
    const result = await ctx.automationScheduler.runNow((req.params as { id: string }).id);
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

  app.get("/api/automation-rules", async () => getAutomationRules());
  app.get("/api/automation-runs", async () => getAutomationRuns());
  app.put("/api/automation-rules/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const existing = getAutomationRule(id);
    const now = new Date().toISOString();
    const parsed = AutomationRuleSchema.safeParse({
      id,
      name: "Untitled event rule",
      enabled: true,
      trigger: { type: "manual" },
      conditions: [],
      actions: [],
      cooldownMs: 0,
      runCount: existing?.runCount ?? 0,
      lastRunAt: existing?.lastRunAt,
      lastStatus: existing?.lastStatus,
      lastMessage: existing?.lastMessage,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(req.body as Record<string, unknown>),
    });
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid automation rule" });
    upsertAutomationRule(parsed.data);
    return { ok: true, rule: getAutomationRule(id) };
  });
  app.delete("/api/automation-rules/:id", async (req) => {
    deleteAutomationRule((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/automation-rules/:id/run", async (req, reply) => {
    const result = await ctx.eventAutomationEngine.runManual((req.params as { id: string }).id);
    return reply.status(result.ok ? 200 : 409).send({
      ok: result.ok,
      code: result.ok ? "AUTOMATION_RULE_RUN" : "AUTOMATION_RULE_FAILED",
      title: result.ok ? "Rule Run" : "Rule Failed",
      message: result.message,
      color: result.ok ? "#00f593" : "#eb0400",
      icon: result.ok ? "check" : "alert-triangle",
      retryable: !result.ok,
    });
  });
  app.post("/api/events/test", async (req, reply) => {
    const body = req.body as {
      type?: StreamEventType;
      user?: { id?: string; login?: string; displayName?: string };
      message?: string;
      amount?: number;
      payload?: Record<string, unknown>;
    };
    try {
      const event = createStreamEvent({
        source: "manual",
        type: body.type ?? "follow",
        user: body.user
          ? {
              id: body.user.id ?? "test",
              login: body.user.login ?? "testuser",
              displayName: body.user.displayName ?? "TestUser",
            }
          : undefined,
        message: body.message,
        amount: body.amount,
        payload: body.payload ?? {},
      });
      await ctx.rulesEngine.handleEvent(event);
      return { ok: true, event };
    } catch (err) {
      app.log.error(err);
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Test event failed" });
    }
  });
};
