import type { AlertRule, StreamEventType } from "@btv/shared";
import { getActivity, getAlertRules, upsertAlertRule } from "../db.js";
import { broadcastVisualAlertTest, findTestAlertProject } from "../visual-alert-test.js";
import type { RouteModule } from "./types.js";

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

  app.get("/api/activity", async () =>
    getActivity().flatMap((r) => {
      try {
        return [{ id: r.id, event: JSON.parse(r.event_json), at: r.created_at }];
      } catch {
        return [];
      }
    }),
  );

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
