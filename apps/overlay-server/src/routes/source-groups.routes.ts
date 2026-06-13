import {
  deleteSourceGroup,
  getSourceGroup,
  getSourceGroups,
  upsertSourceGroup,
  type SourceGroup,
} from "../db.js";
import { getObsSourceTransform, writableObsTransformSnapshot } from "../obs-client.js";
import type { RouteModule } from "./types.js";
import { parseBody, SourceNamesBodySchema, UnknownRecordBodySchema } from "../schemas/request.schema.js";

export const registerSourceGroupsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/source-groups", async () => getSourceGroups());
  app.put("/api/source-groups/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = parseBody(reply, UnknownRecordBodySchema, req.body) as Partial<SourceGroup> | undefined;
    if (!body) return;
    const group: SourceGroup = {
      id,
      name: body.name?.trim() || "Untitled activity",
      sceneName: body.sceneName?.trim() || "",
      sources: Array.isArray(body.sources) ? body.sources : [],
      updatedAt: new Date().toISOString(),
    };
    upsertSourceGroup(group);
    return { ok: true, group };
  });
  app.delete("/api/source-groups/:id", async (req) => {
    deleteSourceGroup((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/source-groups/:id/capture", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const group = getSourceGroup(id);
    if (!group) return reply.status(404).send({ ok: false, message: "Activity layout not found" });
    const body = parseBody(reply, SourceNamesBodySchema, req.body);
    if (!body) return;
    const selected = new Set(body.sourceNames?.length ? body.sourceNames : group.sources.map((s) => s.sourceName));
    const sources = await Promise.all(
      [...selected].map(async (sourceName) => {
        const transform = await getObsSourceTransform(group.sceneName, sourceName);
        return { sourceName, transform: transform ? writableObsTransformSnapshot(transform) : undefined };
      }),
    );
    const updated = { ...group, sources, updatedAt: new Date().toISOString() };
    upsertSourceGroup(updated);
    return { ok: true, group: updated };
  });
  app.post("/api/actions/source-group/:id", async (req, reply) => {
    const result = await ctx.applySourceGroup((req.params as { id: string }).id);
    return reply.status(result.ok ? 200 : 503).send(result);
  });
};
