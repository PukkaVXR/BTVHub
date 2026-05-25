import { useCallback, useEffect, useState } from "react";
import type { WebhookHook } from "@btv/shared";
import { api, type WebhookInfo } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";
import { PageHeader } from "../ui";

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
    const res = await api.saveWebhook(hook);
    toast(`Saved - ${res.url}`);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    await api.deleteWebhook(id);
    toast("Deleted");
    load();
  };

  const setAction = (action: WebhookHook["action"]) => {
    if (!editing) return;
    setEditing({ ...editing, action, actionConfig: configTemplate(action) });
    setActionConfigJson(JSON.stringify(configTemplate(action), null, 2));
  };

  return (
    <>
      <PageHeader title="Webhooks" description="POST external events to trigger alerts, goals, effects, macros, or custom events." />

      <button
        type="button"
        className="btn btn-primary btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() =>
          startEditing({
            id: `hook-${Date.now()}`,
            name: "New Webhook",
            action: "alert",
            actionConfig: { eventType: "follow" },
          })
        }
      >
        New webhook
      </button>

      {editing && (
        <div className="card">
          <h2>
            Edit webhook <SaveIndicator status={saveStatus} label="Webhook" />
          </h2>
          <div className="form-row">
            <label>Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Secret header (X-BTV-Secret)</label>
            <input
              value={editing.secret ?? ""}
              onChange={(e) => setEditing({ ...editing, secret: e.target.value || undefined })}
            />
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
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Endpoints</h2>
        {hooks.map((h) => (
          <div key={h.id} style={{ marginBottom: 16 }}>
            <strong>{h.name}</strong>
            <div className="url-box">{h.url}</div>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Action: {h.action} | Config: <code>{JSON.stringify(h.actionConfig ?? {})}</code>
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEditing(h)}>
              Edit
            </button>{" "}
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(h.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Request log</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Hook</th>
              <th>Body</th>
            </tr>
          </thead>
          <tbody>
            {log.map((r) => (
              <tr key={r.created_at + r.hook_id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.hook_id}</td>
                <td style={{ maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis" }}>{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
