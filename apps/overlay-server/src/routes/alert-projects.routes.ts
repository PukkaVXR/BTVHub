import { AlertProjectSchema } from "@btv/shared";
import {
  deleteAlertProject,
  getAlertProject,
  getAlertProjects,
  upsertAlertProject,
} from "../db.js";
import { broadcastVisualAlertTest } from "../visual-alert-test.js";
import { parseBody, StreamEventTestBodySchema, UnknownRecordBodySchema } from "../schemas/request.schema.js";
import type { RouteModule } from "./types.js";

export const registerAlertProjectsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/alert-projects", async () => getAlertProjects());

  app.get("/api/alert-projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = getAlertProject(id);
    if (!project) return reply.status(404).send({ error: "Alert project not found" });
    return project;
  });

  app.put("/api/alert-projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = getAlertProject(id);
    const now = new Date().toISOString();
    const body = parseBody(reply, UnknownRecordBodySchema, req.body);
    if (!body) return;
    const parsed = AlertProjectSchema.safeParse({
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...body,
      id,
    });
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid alert project" });
    }
    upsertAlertProject(parsed.data);
    return { ok: true, project: getAlertProject(id) };
  });

  app.delete("/api/alert-projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    deleteAlertProject(id);
    return { ok: true };
  });

  app.post("/api/alert-projects/:id/test", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = getAlertProject(id);
    if (!project) return reply.status(404).send({ error: "Alert project not found" });

    const body = parseBody(reply, StreamEventTestBodySchema, req.body);
    if (!body) return;
    const event = broadcastVisualAlertTest(ctx.bus, project, body?.eventType ?? project.eventType, body?.testPayload, body?.variationId);

    return { ok: true, event };
  });
};
