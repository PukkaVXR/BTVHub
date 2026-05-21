import { useEffect, useMemo, useState } from "react";
import { api, type AutomationAction, type AutomationConfig, type MacroConfig, type SourceGroup } from "../api";
import { useToast } from "../hooks/useToast";

const emptyAutomation = (): AutomationConfig => ({
  id: `automation-${Date.now()}`,
  name: "New automation",
  enabled: true,
  intervalMs: 60000,
  action: "macro",
  actionConfig: {},
  runOnStart: false,
  runCount: 0,
});

function actionTemplate(action: AutomationAction): Record<string, unknown> {
  switch (action) {
    case "macro":
      return { macroId: "" };
    case "effect":
      return { effectId: "" };
    case "source_group":
      return { sourceGroupId: "" };
    case "command":
      return {
        command: "powershell.exe",
        args: ["-NoProfile", "-File", "scripts/example.ps1"],
        timeoutMs: 10000,
      };
    case "twitch_chat":
      return { message: "Automated reminder from BTV Hub" };
    default:
      return {};
  }
}

function formatInterval(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationConfig[]>([]);
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [effects, setEffects] = useState<Array<{ id: string; name: string }>>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [editing, setEditing] = useState<AutomationConfig | null>(null);
  const [configJson, setConfigJson] = useState("{}");
  const toast = useToast();

  const load = () => {
    void Promise.all([api.automations(), api.macros(), api.effects(), api.sourceGroups()]).then(
      ([a, m, e, s]) => {
        setAutomations(a);
        setMacros(m);
        setEffects(e.map((effect) => ({ id: effect.id, name: effect.name })));
        setSourceGroups(s);
      },
    );
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const parsedConfig = useMemo(() => {
    try {
      const parsed = JSON.parse(configJson);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }, [configJson]);

  const edit = (automation: AutomationConfig) => {
    setEditing(automation);
    setConfigJson(JSON.stringify(automation.actionConfig ?? {}, null, 2));
  };

  const save = async () => {
    if (!editing) return;
    let actionConfig: Record<string, unknown>;
    try {
      const parsed = JSON.parse(configJson);
      actionConfig = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      toast(err instanceof Error ? err.message : "Invalid action config JSON");
      return;
    }
    await api.saveAutomation({ ...editing, actionConfig });
    toast("Automation saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    await api.deleteAutomation(id);
    toast("Automation deleted");
    if (editing?.id === id) setEditing(null);
    load();
  };

  const runNow = async (automation: AutomationConfig) => {
    try {
      const res = await api.runAutomation(automation.id);
      toast(res.message);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Automation failed");
    }
  };

  const setAction = (action: AutomationAction) => {
    if (!editing) return;
    const next = actionTemplate(action);
    setEditing({ ...editing, action, actionConfig: next });
    setConfigJson(JSON.stringify(next, null, 2));
  };

  const setConfig = (patch: Record<string, unknown>) => {
    const next = { ...parsedConfig, ...patch };
    setConfigJson(JSON.stringify(next, null, 2));
  };

  return (
    <>
      <h1>Automations</h1>
      <p className="subtitle">Run macros, commands, chat messages, effects, or activity layouts on a repeating timer.</p>

      <div className="actions" style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => edit(emptyAutomation())}>
          New automation
        </button>
      </div>

      {editing && (
        <div className="card">
          <h2>Edit automation</h2>
          <div className="grid">
            <div>
              <label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label>Interval</label>
              <select
                value={editing.intervalMs}
                onChange={(e) => setEditing({ ...editing, intervalMs: Number(e.target.value) })}
              >
                <option value={5000}>Every 5 seconds</option>
                <option value={15000}>Every 15 seconds</option>
                <option value={30000}>Every 30 seconds</option>
                <option value={60000}>Every minute</option>
                <option value={300000}>Every 5 minutes</option>
                <option value={600000}>Every 10 minutes</option>
                <option value={1800000}>Every 30 minutes</option>
                <option value={3600000}>Every hour</option>
              </select>
            </div>
          </div>

          <label style={{ display: "block", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={editing.enabled}
              onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
            />{" "}
            Enabled
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={editing.runOnStart}
              onChange={(e) => setEditing({ ...editing, runOnStart: e.target.checked })}
            />{" "}
            Run shortly after server start
          </label>

          <div className="form-row">
            <label>Action</label>
            <select value={editing.action} onChange={(e) => setAction(e.target.value as AutomationAction)}>
              <option value="macro">Run macro</option>
              <option value="effect">Run interaction/effect</option>
              <option value="source_group">Activate activity layout</option>
              <option value="command">Run local command</option>
              <option value="twitch_chat">Send Twitch chat</option>
            </select>
          </div>

          {editing.action === "macro" && (
            <div className="form-row">
              <label>Macro</label>
              <select value={String(parsedConfig.macroId ?? "")} onChange={(e) => setConfig({ macroId: e.target.value })}>
                <option value="">Select macro</option>
                {macros.map((macro) => (
                  <option key={macro.id} value={macro.id}>{macro.name}</option>
                ))}
              </select>
            </div>
          )}

          {editing.action === "effect" && (
            <div className="form-row">
              <label>Interaction/effect</label>
              <select value={String(parsedConfig.effectId ?? "")} onChange={(e) => setConfig({ effectId: e.target.value })}>
                <option value="">Select effect</option>
                {effects.map((effect) => (
                  <option key={effect.id} value={effect.id}>{effect.name}</option>
                ))}
              </select>
            </div>
          )}

          {editing.action === "source_group" && (
            <div className="form-row">
              <label>Activity layout</label>
              <select value={String(parsedConfig.sourceGroupId ?? "")} onChange={(e) => setConfig({ sourceGroupId: e.target.value })}>
                <option value="">Select layout</option>
                {sourceGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}

          {editing.action === "twitch_chat" && (
            <div className="form-row">
              <label>Message</label>
              <input value={String(parsedConfig.message ?? "")} onChange={(e) => setConfig({ message: e.target.value })} />
            </div>
          )}

          <div className="form-row">
            <label>Action config JSON</label>
            <textarea
              rows={8}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              style={{ fontFamily: "monospace", lineHeight: 1.45 }}
            />
          </div>

          <div className="actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void runNow({ ...editing, actionConfig: parsedConfig })}>
              Run now
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Configured automations</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Action</th>
              <th>Interval</th>
              <th>Status</th>
              <th>Next run</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {automations.map((automation) => (
              <tr key={automation.id}>
                <td>{automation.name}</td>
                <td>{automation.action}</td>
                <td>{formatInterval(automation.intervalMs)}</td>
                <td>
                  {automation.enabled ? automation.lastStatus ?? "waiting" : "paused"}
                  {automation.lastMessage ? ` - ${automation.lastMessage}` : ""}
                </td>
                <td>{automation.nextRunAt ? new Date(automation.nextRunAt).toLocaleTimeString() : "-"}</td>
                <td>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void runNow(automation)}>
                    Run
                  </button>{" "}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => edit(automation)}>
                    Edit
                  </button>{" "}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(automation.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!automations.length && <p style={{ color: "var(--muted)", padding: 12 }}>No automations configured.</p>}
      </div>
    </>
  );
}
