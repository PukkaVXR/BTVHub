import type { DatabaseSync } from "node:sqlite";
import type { WebhookHook } from "@btv/shared";

export interface WebhookLogRow {
  id: string;
  hook_id: string;
  body: string;
  created_at: string;
}

interface WebhooksRepositoryDeps {
  getDb: () => DatabaseSync;
  parseRecord: (raw: unknown) => Record<string, unknown>;
  encrypt: (value: string) => string;
  decrypt: (value: string) => string;
}

export function createWebhooksRepository({ getDb, parseRecord, encrypt, decrypt }: WebhooksRepositoryDeps) {
  const readSecret = (value: unknown): string | undefined => {
    if (!value) return undefined;
    const raw = String(value);
    try {
      return decrypt(raw);
    } catch {
      return raw;
    }
  };

  const rowToWebhook = (row: Record<string, unknown>): WebhookHook => ({
    id: String(row.id),
    name: String(row.name),
    secret: readSecret(row.secret),
    action: row.action as WebhookHook["action"],
    actionConfig: parseRecord(row.action_config),
  });

  function getWebhooks(): WebhookHook[] {
    return (getDb().prepare("SELECT * FROM webhooks").all() as Array<Record<string, unknown>>).map(rowToWebhook);
  }

  function upsertWebhook(hook: WebhookHook): void {
    getDb().prepare(
      `INSERT INTO webhooks (id, name, secret, action, action_config) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, secret=excluded.secret, action=excluded.action, action_config=excluded.action_config`,
    ).run(
      hook.id,
      hook.name,
      hook.secret ? encrypt(hook.secret) : null,
      hook.action,
      JSON.stringify(hook.actionConfig),
    );
  }

  function deleteWebhook(id: string): void {
    getDb().prepare("DELETE FROM webhooks WHERE id = ?").run(id);
  }

  function getWebhook(id: string): WebhookHook | null {
    const row = getDb().prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToWebhook(row) : null;
  }

  function logWebhookRequest(hookId: string, body: string): void {
    getDb().prepare(`INSERT INTO webhook_log (id, hook_id, body, created_at) VALUES (?, ?, ?, ?)`).run(
      crypto.randomUUID(),
      hookId,
      body,
      new Date().toISOString(),
    );
  }

  function getWebhookLog(limit = 50): WebhookLogRow[] {
    return getDb()
      .prepare(`SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as unknown as WebhookLogRow[];
  }

  return {
    getWebhooks,
    upsertWebhook,
    deleteWebhook,
    getWebhook,
    logWebhookRequest,
    getWebhookLog,
  };
}
