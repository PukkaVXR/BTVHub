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
  app.put("/api/webhooks/:id", async (req) => {
    const body = req.body as WebhookHook;
    const existing = getWebhook(body.id);
    upsertWebhook(preserveMaskedSecret(body, existing));
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
    const result = await handleWebhook(
      hookId,
      req.body,
      secret,
      ctx.rulesEngine,
      ctx.effectRunner,
      ctx.macroRunner,
      ctx.bus,
    );
    if (!result.ok) return reply.status(result.error === "Invalid secret" ? 401 : 404).send(result);
    return result;
  });
};
