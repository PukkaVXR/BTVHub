import { EffectSchema } from "@btv/shared";
import { deleteEffect, getEffects, upsertEffect } from "../db.js";
import type { RouteModule } from "./types.js";
import { parseBody } from "../schemas/request.schema.js";

export const registerEffectsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/effects", async () => getEffects());
  app.put("/api/effects/:id", async (req, reply) => {
    const body = parseBody(reply, EffectSchema, req.body);
    if (!body) return;
    upsertEffect(body);
    return { ok: true };
  });
  app.delete("/api/effects/:id", async (req) => {
    deleteEffect((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/effects/:id/fire", async (req) => {
    let ok = false;
    let error = "";
    try {
      ok = await ctx.effectRunner.fireManual((req.params as { id: string }).id);
    } catch (err) {
      app.log.error({ err }, "Effect fire failed");
      error = err instanceof Error ? err.message : "Effect failed";
    }
    return {
      ok,
      code: ok ? "EFFECT_FIRED" : "EFFECT_BLOCKED",
      title: ok ? "Effect Fired" : "Effect Blocked",
      message: ok ? "The effect was sent to overlays" : error || "Effect missing, on cooldown, or failed",
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "check" : "alert-triangle",
      retryable: !ok,
    };
  });
};
