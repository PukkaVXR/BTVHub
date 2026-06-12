import { getOverlayOrigin } from "../server-urls.js";
import { handleWebhook } from "../webhook-handler.js";
import { deleteWebhook, getWebhook, getWebhookLog, getWebhooks, upsertWebhook } from "../db.js";
import { preserveMaskedSecret, SECRET_MASK } from "../schemas/webhook.schema.js";
import type { WebhookHook } from "@btv/shared";
import type { RouteModule } from "./types.js";

export const registerWebhooksRoutes: RouteModule = (app, ctx) => {
  app.get("/api/webhooks", async () =>
    getWebhooks().map((h) => ({
      ...h,
      url: `${getOverlayOrigin()}/hooks/${h.id}`,
      secret: h.secret ? SECRET_MASK : undefined,
    })),
  );
  app.put("/api/webhooks/:id", async (req, reply) => {
    const body = req.body as WebhookHook;
    const existing = getWebhook(body.id);
    const next = preserveMaskedSecret(body, existing);
    if (!next.secret?.trim()) {
      return reply.status(400).send({
        ok: false,
        error: "Webhook secret is required. Generate a secret before saving this webhook.",
      });
    }
    upsertWebhook({ ...next, secret: next.secret.trim() });
    return { ok: true, url: `${getOverlayOrigin()}/hooks/${body.id}` };
  });
  app.delete("/api/webhooks/:id", async (req) => {
    deleteWebhook((req.params as { id: string }).id);
    return { ok: true };
  });
  app.get("/api/webhooks/log", async () => getWebhookLog());
  app.post("/hooks/:hookId", async (req, reply) => {
    const { hookId } = req.params as { hookId: string };
    const secret = req.headers["x-btv-secret"] as string | undefined;
    const signature = req.headers["x-btv-signature"] as string | undefined;
    const forwardedFor = req.headers["x-forwarded-for"];
    const clientKey = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim() || req.ip;
    const result = await handleWebhook(
      hookId,
      req.body,
      secret,
      signature,
      clientKey,
      ctx.rulesEngine,
      ctx.effectRunner,
      ctx.macroRunner,
      ctx.bus,
      ctx.coreEvents,
    );
    if (!result.ok) {
      const status = result.error === "Rate limited" ? 429 : result.error === "Hook not found" ? 404 : 401;
      return reply.status(status).send(result);
    }
    return result;
  });
};
