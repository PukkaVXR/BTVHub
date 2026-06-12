import { useCallback, useEffect, useState } from "react";
import type { WebhookHook } from "@btv/shared";
import { api, type WebhookInfo } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";
import { Button, CopyField, EmptyState, FormField, PageHeader, StatusPill } from "../ui";

function configTemplate(action: WebhookHook["action"]): Record<string, unknown> {
  switch (action) {
    case "alert":
      return { eventType: "follow" };
    case "goal_increment":
      return { goalId: "follow-goal" };
    case "effect":
      return { effectId: "jumpscare" };
    case "macro":
      return { macroId: "panic-clear" };
    case "custom_event":
    default:
      return {};
  }
}

function formatWebhookBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function truncateBody(body: string): string {
  const formatted = formatWebhookBody(body);
  return formatted.length > 700 ? `${formatted.slice(0, 700)}\n... truncated ...` : formatted;
}

function generateWebhookSecret(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<WebhookInfo[]>([]);
  const [log, setLog] = useState<Array<{ hook_id: string; body: string; created_at: string }>>([]);
  const [editing, setEditing] = useState<WebhookHook | null>(null);
  const [actionConfigJson, setActionConfigJson] = useState("{}");
  const toast = useToast();

  const load = () => {
    void Promise.all([api.webhooks(), api.webhookLog()]).then(([h, l]) => {
      setHooks(h);
      setLog(l);
    });
  };

  useEffect(() => load(), []);

  const startEditing = (hook: WebhookHook) => {
    setEditing(hook);
    setActionConfigJson(JSON.stringify(hook.actionConfig ?? {}, null, 2));
  };

  const macroFromEditor = (): WebhookHook | null => {
    if (!editing) return null;
    try {
      const actionConfig = JSON.parse(actionConfigJson) as Record<string, unknown>;
      return { ...editing, actionConfig };
    } catch {
      return null;
    }
  };

  const persistWebhook = useCallback(async () => {
    const hook = macroFromEditor();
    if (!hook) return;
    if (!hook.secret?.trim()) return;
    await api.saveWebhook(hook);
  }, [editing, actionConfigJson]);

  const saveStatus = useAutoSave(editing ? { editing, actionConfigJson } : null, persistWebhook, {
    enabled: editing != null,
  });

  const save = async () => {
    const hook = macroFromEditor();
    if (!hook) {
      toast("Invalid action config JSON");
      return;
    }
    if (!hook.secret?.trim()) {
      toast("Generate a webhook secret before saving");
      return;
    }
    try {
      const res = await api.saveWebhook({ ...hook, secret: hook.secret.trim() });
      toast(`Saved - ${res.url}`);
      setEditing(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Webhook save failed");
    }
  };

  const remove = async (id: string) => {
    await api.deleteWebhook(id);
    toast("Deleted");
    if (editing?.id === id) {
      setEditing(null);
    }
    load();
  };

  const setAction = (action: WebhookHook["action"]) => {
    if (!editing) return;
    setEditing({ ...editing, action, actionConfig: configTemplate(action) });
    setActionConfigJson(JSON.stringify(configTemplate(action), null, 2));
  };

  const editingInfo = editing ? hooks.find((hook) => hook.id === editing.id) : null;

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="POST external events to trigger alerts, goals, effects, macros, or custom events."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              startEditing({
                id: `hook-${Date.now()}`,
                name: "New Webhook",
                secret: generateWebhookSecret(),
                action: "alert",
                actionConfig: { eventType: "follow" },
              })
            }
          >
            New webhook
          </Button>
        }
      />

      <div className="webhook-workspace">
        <aside className="webhook-list" aria-label="Webhook endpoints">
          {hooks.map((hook) => (
            <button
              key={hook.id}
              type="button"
              className={editing?.id === hook.id ? "active" : ""}
              onClick={() => startEditing(hook)}
            >
              <span>{hook.name}</span>
              <small>{hook.action}</small>
              <StatusPill tone={hook.secret ? "success" : "neutral"} label={hook.secret ? "Secret configured" : "No secret"} />
            </button>
          ))}
          {!hooks.length && (
            <EmptyState title="No webhooks yet" description="Create one to let external tools trigger BTV actions." />
          )}
        </aside>

        <main className="webhook-detail">
      {editing ? (
        <div className="card webhook-editor-card">
          <div className="webhook-editor-header">
            <h2>Edit webhook</h2>
            <SaveIndicator status={saveStatus} label="Webhook" />
          </div>
          {editingInfo?.url ? <CopyField label="Webhook URL" value={editingInfo.url} /> : null}
          <div className="form-row">
            <label>Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="ui-callout ui-callout--warning">
            Webhooks now require authentication. Send either <code>X-BTV-Secret</code> with this secret,
            or <code>X-BTV-Signature</code> as an HMAC SHA-256 signature of the JSON payload.
          </div>
          <FormField
            label="Secret header (X-BTV-Secret)"
            hint={editing.secret ? "Configured. Generate a new value to rotate the secret, then update the external sender." : "Required before this webhook can be saved or triggered."}
          >
            <input
              value={editing.secret ?? ""}
              onChange={(e) => setEditing({ ...editing, secret: e.target.value || undefined })}
            />
          </FormField>
          <div className="actions" style={{ marginTop: 8, marginBottom: 12 }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing({ ...editing, secret: generateWebhookSecret() })}>
              Generate / rotate secret
            </Button>
            {editing.secret ? <StatusPill tone="success" label="Secret configured" /> : <StatusPill tone="danger" label="Secret required" />}
          </div>
          <div className="form-row">
            <label>Action</label>
            <select value={editing.action} onChange={(e) => setAction(e.target.value as WebhookHook["action"])}>
              <option value="alert">Trigger alert</option>
              <option value="goal_increment">Increment goal</option>
              <option value="effect">Run effect</option>
              <option value="macro">Run macro</option>
              <option value="custom_event">Custom event</option>
            </select>
          </div>
          <div className="form-row">
            <label>Action config JSON</label>
            <textarea
              rows={6}
              value={actionConfigJson}
              onChange={(e) => setActionConfigJson(e.target.value)}
              style={{ fontFamily: "monospace", lineHeight: 1.5 }}
            />
          </div>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionConfigJson(JSON.stringify(configTemplate("alert"), null, 2))}>
              Alert config
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionConfigJson(JSON.stringify(configTemplate("goal_increment"), null, 2))}>
              Goal config
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionConfigJson(JSON.stringify(configTemplate("effect"), null, 2))}>
              Effect config
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionConfigJson(JSON.stringify(configTemplate("macro"), null, 2))}>
              Macro config
            </button>
          </div>
          <div className="actions">
            <Button type="button" variant="primary" size="sm" onClick={() => void save()}>
              Save
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => void remove(editing.id)}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState title="Select a webhook" description="Choose an endpoint from the list or create a new one to configure its action and secret." />
      )}
        </main>
      </div>

      <div className="card webhook-log-card">
        <h2>Request log</h2>
        <div className="webhook-log-list">
          {log.map((row) => (
            <details key={row.created_at + row.hook_id} className="webhook-log-item">
              <summary>
                <span>{new Date(row.created_at).toLocaleString()}</span>
                <strong>{hooks.find((hook) => hook.id === row.hook_id)?.name ?? row.hook_id}</strong>
                <small>{truncateBody(row.body).replace(/\s+/g, " ").slice(0, 140)}</small>
              </summary>
              <pre>{truncateBody(row.body)}</pre>
            </details>
          ))}
          {!log.length && <EmptyState title="No webhook requests yet" description="Requests will appear here after an external sender posts to a webhook URL." />}
        </div>
      </div>
    </>
  );
}
