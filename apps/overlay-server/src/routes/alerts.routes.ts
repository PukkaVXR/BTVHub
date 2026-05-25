import type { AlertRule, StreamEvent, StreamEventType } from "@btv/shared";
import { getActivity, getActivityById, getAlertProject, getAlertRules, getTheme, upsertAlertRule } from "../db.js";
import { resolveAlertProjectVariation } from "../alert-variations.js";
import { withAutomationVariables } from "../alert-template-vars.js";
import { broadcastVisualAlertTest, findTestAlertProject } from "../visual-alert-test.js";
import type { RouteModule } from "./types.js";

function enqueueReplayAlert(ctx: Parameters<RouteModule>[1], event: StreamEvent): { ok: boolean; message: string } {
  const enrichedEvent = withAutomationVariables(event);
  const rule = getAlertRules().find((item) => item.enabled && item.eventType === enrichedEvent.type && (item.minAmount == null || (enrichedEvent.amount ?? 0) >= item.minAmount));
  if (!rule) return { ok: false, message: `No enabled alert rule matches ${enrichedEvent.type}` };

  const rawVisualProject = getAlertProject(rule.themeId) ?? getAlertProject(`alert-${rule.themeId}`) ?? undefined;
  const resolved = rawVisualProject ? resolveAlertProjectVariation(rawVisualProject, enrichedEvent) : undefined;
  const visualProject = resolved?.project;
  const theme = getTheme(rule.themeId) ?? getTheme("default");
  if (!theme && !visualProject) return { ok: false, message: "Matched alert rule has no usable visual project or legacy theme" };

  ctx.alertQueue.enqueue(
    {
      id: crypto.randomUUID(),
      channel: "alerts",
      priority: rule.priority,
      message: {
        kind: "alert:play",
        alert: {
          id: crypto.randomUUID(),
          event: enrichedEvent,
          themeId: visualProject?.id ?? theme!.id,
          html: theme?.html ?? "",
          css: theme?.css ?? "",
          js: theme?.js ?? "",
          soundUrl: rule.soundAsset ? `/assets/${rule.soundAsset}` : undefined,
          durationMs: visualProject?.durationMs ?? theme?.durationMs ?? 5000,
          visualProject,
        },
      },
    },
    0,
  );

  return { ok: true, message: `Replayed ${enrichedEvent.type} alert` };
}

export const registerAlertsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/alert-rules", async () => getAlertRules());
  app.put("/api/alert-rules/:id", async (req) => {
    upsertAlertRule(req.body as AlertRule);
    return { ok: true };
  });

  app.post("/api/alerts/clear", async () => ({
    ok: true,
    cleared: ctx.alertQueue.clear(),
    queue: ctx.alertQueue.getStatus(),
  }));

  app.post("/api/alerts/skip", async () => ({
    ok: ctx.alertQueue.skipCurrent(),
    queue: ctx.alertQueue.getStatus(),
  }));

  app.post("/api/alerts/pause", async () => {
    ctx.alertQueue.pause();
    return { ok: true, queue: ctx.alertQueue.getStatus() };
  });

  app.post("/api/alerts/resume", async () => {
    ctx.alertQueue.resume();
    return { ok: true, queue: ctx.alertQueue.getStatus() };
  });

  app.post("/api/alerts/replay-last", async () => ({
    ok: ctx.alertQueue.replayLast(),
    queue: ctx.alertQueue.getStatus(),
  }));

  app.post("/api/alerts/queue/:id/priority", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { priority?: number } | undefined;
    return {
      ok: ctx.alertQueue.setQueuedPriority(id, Number(body?.priority ?? 0)),
      queue: ctx.alertQueue.getStatus(),
    };
  });

  app.get("/api/activity", async () =>
    getActivity().flatMap((r) => {
      try {
        return [{ id: r.id, event: JSON.parse(r.event_json), at: r.created_at }];
      } catch {
        return [];
      }
    }),
  );

  app.post("/api/activity/:id/replay-alert", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = getActivityById(id);
    if (!row) return reply.status(404).send({ ok: false, message: "Activity event not found", queue: ctx.alertQueue.getStatus() });

    try {
      const event = JSON.parse(row.event_json) as StreamEvent;
      const result = enqueueReplayAlert(ctx, event);
      return { ...result, queue: ctx.alertQueue.getStatus() };
    } catch {
      return reply.status(400).send({ ok: false, message: "Activity event could not be replayed", queue: ctx.alertQueue.getStatus() });
    }
  });

  app.post("/api/test/alert/:eventType", async (req, reply) => {
    const { eventType } = req.params as { eventType: StreamEventType };
    try {
      const project = findTestAlertProject(eventType);
      if (!project) return reply.status(404).send({ error: "No visual alert project found" });
      const event = broadcastVisualAlertTest(ctx.bus, project, eventType);
      return { ok: true, event, projectId: project.id };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Test alert failed" });
    }
  });
};
