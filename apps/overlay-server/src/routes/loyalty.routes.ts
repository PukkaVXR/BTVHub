import {
  adjustLoyaltyViewerPoints,
  getLoyaltyViewer,
  getLoyaltyViewers,
  setLoyaltyViewerPoints,
} from "../db.js";
import type { RouteModule } from "./types.js";
import { LoyaltyUpdateBodySchema, parseBody } from "../schemas/request.schema.js";

export const registerLoyaltyRoutes: RouteModule = (app) => {
  app.get("/api/loyalty/viewers", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(500, Math.max(1, Number(query.limit ?? 100)));
    return { viewers: getLoyaltyViewers(limit) };
  });

  app.get("/api/loyalty/viewers/:id", async (req, reply) => {
    const viewer = getLoyaltyViewer((req.params as { id: string }).id);
    if (!viewer) return reply.status(404).send({ ok: false, message: "Viewer not found" });
    return { ok: true, viewer };
  });

  app.post("/api/loyalty/viewers/:id/points", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(reply, LoyaltyUpdateBodySchema, req.body);
    if (!body) return;
    const mode = body.mode === "set" ? "set" : "adjust";
    const value = Number(mode === "set" ? body.points : body.delta);
    if (!Number.isFinite(value)) return reply.status(400).send({ ok: false, message: "Point value is required." });
    const viewer = mode === "set" ? setLoyaltyViewerPoints(id, value) : adjustLoyaltyViewerPoints(id, value);
    if (!viewer) return reply.status(404).send({ ok: false, message: "Viewer not found" });
    return { ok: true, viewer };
  });
};
