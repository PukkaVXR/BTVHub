import type { AutomationAction, AutomationConfig, MacroConfig, SourceGroup } from "../../api";
import { Button, EmptyState, StatusPill } from "../../ui";

type EffectOption = { id: string; name: string };

type ScheduledAutomationsPanelProps = {
  automations: AutomationConfig[];
  editing: AutomationConfig | null;
  configJson: string;
  macros: MacroConfig[];
  effects: EffectOption[];
  sourceGroups: SourceGroup[];
  onEdit: (automation: AutomationConfig) => void;
  onEditingChange: (automation: AutomationConfig | null) => void;
  onConfigJsonChange: (value: string) => void;
  onSave: () => void;
  onRunNow: (automation: AutomationConfig) => void;
  onToggleEnabled: (automation: AutomationConfig, enabled: boolean) => void;
  onDelete: (id: string) => void;
};

function emptyAutomation(): AutomationConfig {
  return {
    id: `automation-${Date.now()}`,
    name: "New automation",
    enabled: true,
    intervalMs: 60000,
    action: "macro",
    actionConfig: {},
    runOnStart: false,
    runCount: 0,
  };
}

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

function parseConfig(configJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(configJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
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

function automationStatusTone(
  status: AutomationConfig["lastStatus"] | undefined,
  enabled: boolean,
): "success" | "warning" | "danger" | "neutral" {
  if (!enabled) return "neutral";
  if (status === "ok") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "neutral";
}

export function ScheduledAutomationsPanel({
  automations,
  editing,
  configJson,
  macros,
  effects,
  sourceGroups,
  onEdit,
  onEditingChange,
  onConfigJsonChange,
  onSave,
  onRunNow,
  onToggleEnabled,
  onDelete,
}: ScheduledAutomationsPanelProps) {
  const parsedConfig = parseConfig(configJson);

  const setAction = (action: AutomationAction) => {
    if (!editing) return;
    const actionConfig = actionTemplate(action);
    onEditingChange({ ...editing, action, actionConfig });
    onConfigJsonChange(JSON.stringify(actionConfig, null, 2));
  };

  const setConfig = (patch: Record<string, unknown>) => {
    onConfigJsonChange(JSON.stringify({ ...parsedConfig, ...patch }, null, 2));
  };

  return (
    <>
      <p className="subtitle">Timer jobs run macros, commands, chat messages, effects, or activity layouts on a repeating schedule.</p>

      <div className="actions" style={{ marginBottom: 16 }}>
        <Button type="button" variant="primary" size="sm" onClick={() => onEdit(emptyAutomation())}>
          New automation
        </Button>
      </div>

      {editing && (
        <div className="card">
          <h2>Edit automation</h2>
          <div className="grid">
            <div>
              <label>Name</label>
              <input value={editing.name} onChange={(event) => onEditingChange({ ...editing, name: event.target.value })} />
            </div>
            <div>
              <label>Interval</label>
              <select
                value={editing.intervalMs}
                onChange={(event) => onEditingChange({ ...editing, intervalMs: Number(event.target.value) })}
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
              onChange={(event) => onEditingChange({ ...editing, enabled: event.target.checked })}
            />{" "}
            Enabled
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={editing.runOnStart}
              onChange={(event) => onEditingChange({ ...editing, runOnStart: event.target.checked })}
            />{" "}
            Run shortly after server start
          </label>

          <div className="form-row">
            <label>Action</label>
            <select value={editing.action} onChange={(event) => setAction(event.target.value as AutomationAction)}>
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
              <select value={String(parsedConfig.macroId ?? "")} onChange={(event) => setConfig({ macroId: event.target.value })}>
                <option value="">Select macro</option>
                {macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}
              </select>
            </div>
          )}

          {editing.action === "effect" && (
            <div className="form-row">
              <label>Interaction/effect</label>
              <select value={String(parsedConfig.effectId ?? "")} onChange={(event) => setConfig({ effectId: event.target.value })}>
                <option value="">Select effect</option>
                {effects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
              </select>
            </div>
          )}

          {editing.action === "source_group" && (
            <div className="form-row">
              <label>Activity layout</label>
              <select value={String(parsedConfig.sourceGroupId ?? "")} onChange={(event) => setConfig({ sourceGroupId: event.target.value })}>
                <option value="">Select layout</option>
                {sourceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
          )}

          {editing.action === "twitch_chat" && (
            <div className="form-row">
              <label>Message</label>
              <input value={String(parsedConfig.message ?? "")} onChange={(event) => setConfig({ message: event.target.value })} />
            </div>
          )}

          <div className="form-row">
            <label>Action config JSON</label>
            <textarea
              rows={8}
              value={configJson}
              onChange={(event) => onConfigJsonChange(event.target.value)}
              style={{ fontFamily: "monospace", lineHeight: 1.45 }}
            />
          </div>

          <div className="actions">
            <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={onSave}>Save</button>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onEditingChange(null)}>Cancel</button>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => onRunNow({ ...editing, actionConfig: parsedConfig })}
            >
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
              <th>Enabled</th>
              <th>Action</th>
              <th>Interval</th>
              <th>Last run status</th>
              <th>Next run</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {automations.map((automation) => (
              <tr key={automation.id}>
                <td>{automation.name}</td>
                <td>
                  <label className="automation-enabled-toggle">
                    <input
                      type="checkbox"
                      checked={automation.enabled}
                      onChange={(event) => onToggleEnabled(automation, event.target.checked)}
                    />
                    <span>{automation.enabled ? "On" : "Off"}</span>
                  </label>
                </td>
                <td>{automation.action}</td>
                <td>{formatInterval(automation.intervalMs)}</td>
                <td>
                  <StatusPill
                    tone={automationStatusTone(automation.lastStatus, automation.enabled)}
                    label={automation.enabled ? automation.lastStatus ?? "waiting" : "paused"}
                    detail={automation.lastMessage}
                  />
                </td>
                <td>{automation.nextRunAt && automation.enabled ? new Date(automation.nextRunAt).toLocaleTimeString() : "-"}</td>
                <td>
                  <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => onRunNow(automation)}>Run</button>{" "}
                  <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onEdit(automation)}>Edit</button>{" "}
                  <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => onDelete(automation.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!automations.length && (
          <EmptyState
            title="No scheduled jobs yet"
            description="Create one to run macros, chat reminders, effects, or layouts on a timer."
          />
        )}
      </div>
    </>
  );
}
