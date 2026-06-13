import {
  addViewerQueueEntry,
  clearViewerQueueEntries,
  getViewerQueueEntries,
  popNextViewerQueueEntry,
  removeViewerQueueEntry,
} from "../db.js";
import type { RouteModule } from "./types.js";
import { parseBody, ViewerIdentityBodySchema } from "../schemas/request.schema.js";

export const registerViewerQueueRoutes: RouteModule = (app) => {
  app.get("/api/viewer-queue", async () => ({ entries: getViewerQueueEntries() }));

  app.post("/api/viewer-queue", async (req, reply) => {
    const body = parseBody(reply, ViewerIdentityBodySchema, req.body);
    if (!body) return;
    const displayName = String(body.displayName ?? "").trim();
    const login = String(body.login ?? "").trim() || undefined;
    const userId = String(body.userId ?? login ?? displayName).trim();
    if (!userId || !displayName) {
      return reply.status(400).send({ ok: false, message: "Display name is required." });
    }
    return {
      ok: true,
      ...addViewerQueueEntry({
        userId,
        login,
        displayName,
        note: String(body.note ?? "").trim() || undefined,
      }),
    };
  });

  app.delete("/api/viewer-queue/:id", async (req, reply) => {
    const entry = removeViewerQueueEntry((req.params as { id: string }).id);
    if (!entry) return reply.status(404).send({ ok: false, message: "Queue entry not found" });
    return { ok: true, entry };
  });

  app.post("/api/viewer-queue/next", async (req, reply) => {
    const entry = popNextViewerQueueEntry();
    if (!entry) return reply.status(404).send({ ok: false, message: "Queue is empty" });
    return { ok: true, entry };
  });

  app.post("/api/viewer-queue/clear", async () => ({ ok: true, cleared: clearViewerQueueEntries() }));
};
