import type { WebhookHook } from "@btv/shared";

export const SECRET_MASK = "••••••••";

export function preserveMaskedSecret(body: WebhookHook, existing?: WebhookHook | null): WebhookHook {
  return {
    ...body,
    secret: body.secret === SECRET_MASK ? existing?.secret : body.secret,
  };
}
