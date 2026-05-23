import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AutomationAction,
  type AutomationActionConfig,
  type AutomationCondition,
  type AutomationConfig,
  type AutomationRule,
  type AutomationRun,
  type MacroConfig,
  type SourceGroup,
} from "../api";
import type { StreamEventType } from "@btv/shared";
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

const emptyRule = (): AutomationRule => {
  const now = new Date().toISOString();
  return {
    id: `rule-${Date.now()}`,
    name: "New event rule",
    enabled: true,
    trigger: { type: "stream_event", eventType: "follow" },
    conditions: [],
    actions: [],
    cooldownMs: 0,
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  };
};

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

function eventActionTemplate(type: AutomationActionConfig["type"]): AutomationActionConfig {
  switch (type) {
    case "macro":
      return { type, macroId: "" };
    case "effect":
      return { type, effectId: "" };
    case "source_group":
      return { type, sourceGroupId: "" };
    case "twitch_chat":
      return { type, message: "Thanks {user}!" };
    case "overlay_event":
      return { type, channel: "effects", name: "automation", payload: {} };
    case "wait":
      return { type, durationMs: 1000 };
    default:
      return { type: "wait", durationMs: 1000 };
  }
}

function conditionTemplate(type: AutomationCondition["type"]): AutomationCondition {
  switch (type) {
    case "min_amount":
      return { type, amount: 1 };
    case "message_includes":
      return { type, text: "hello" };
    case "user_role":
      return { type, role: "moderator" };
    default:
      return { type: "min_amount", amount: 1 };
  }
}

function describeRuleTrigger(rule: AutomationRule): string {
  if (rule.trigger.type === "stream_event") return rule.trigger.eventType;
  if (rule.trigger.type === "chat_command") return rule.trigger.command;
  return "manual";
}

function describeAction(action: AutomationActionConfig): string {
  switch (action.type) {
    case "macro":
      return `macro:${action.macroId || "unset"}`;
    case "effect":
      return `effect:${action.effectId || "unset"}`;
    case "source_group":
      return `layout:${action.sourceGroupId || "unset"}`;
    case "twitch_chat":
      return "twitch chat";
    case "overlay_event":
      return `overlay:${action.name}`;
    case "wait":
      return `wait ${action.durationMs}ms`;
    default:
      return action.type;
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
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [effects, setEffects] = useState<Array<{ id: string; name: string }>>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [editing, setEditing] = useState<AutomationConfig | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [configJson, setConfigJson] = useState("{}");
  const toast = useToast();

  const load = () => {
    void Promise.all([api.automations(), api.automationRules(), api.automationRuns(), api.macros(), api.effects(), api.sourceGroups()]).then(
      ([a, r, runList, m, e, s]) => {
        setAutomations(a);
        setRules(r);
        setRuns(runList);
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

  const saveRule = async () => {
    if (!editingRule) return;
    await api.saveAutomationRule({ ...editingRule, updatedAt: new Date().toISOString() });
    toast("Event rule saved");
    setEditingRule(null);
    load();
  };

  const removeRule = async (id: string) => {
    await api.deleteAutomationRule(id);
    toast("Event rule deleted");
    if (editingRule?.id === id) setEditingRule(null);
    load();
  };

  const runRule = async (rule: AutomationRule) => {
    try {
      const res = await api.runAutomationRule(rule.id);
      toast(res.message);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rule failed");
    }
  };

  const fireTestEvent = async (type: StreamEventType) => {
    try {
      const res = await api.testEvent({
        type,
        user: { id: "test", login: "testuser", displayName: "TestUser" },
        message: type === "chat" ? "!hello from BTV" : "Phase 1 test event",
        amount: type === "cheer" ? 100 : undefined,
        payload: {},
      });
      toast(`Test event dispatched: ${res.event.type}`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test event failed");
    }
  };

  const setConfig = (patch: Record<string, unknown>) => {
    const next = { ...parsedConfig, ...patch };
    setConfigJson(JSON.stringify(next, null, 2));
  };

  const updateCondition = (index: number, condition: AutomationCondition) => {
    if (!editingRule) return;
    const conditions = [...editingRule.conditions];
    conditions[index] = condition;
    setEditingRule({ ...editingRule, conditions });
  };

  const removeConditionAt = (index: number) => {
    if (!editingRule) return;
    setEditingRule({ ...editingRule, conditions: editingRule.conditions.filter((_, i) => i !== index) });
  };

  const updateEventAction = (index: number, action: AutomationActionConfig) => {
    if (!editingRule) return;
    const actions = [...editingRule.actions];
    actions[index] = action;
    setEditingRule({ ...editingRule, actions });
  };

  const removeEventActionAt = (index: number) => {
    if (!editingRule) return;
    setEditingRule({ ...editingRule, actions: editingRule.actions.filter((_, i) => i !== index) });
  };

  return (
    <>
      <h1>Automations</h1>
      <p className="subtitle">Phase 1 event rules plus the older repeating timer jobs.</p>

      <div className="card">
        <h2>Event automation rules</h2>
        <p className="subtitle">Trigger actions from Twitch/chat/manual events with cooldowns. This is the Phase 1 foundation.</p>
        <div className="actions" style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingRule(emptyRule())}>
            New event rule
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void fireTestEvent("follow")}>
            Test follow
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void fireTestEvent("chat")}>
            Test chat
          </button>
        </div>

        {editingRule && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h2>Edit event rule</h2>
            <div className="grid">
              <div>
                <label>Name</label>
                <input value={editingRule.name} onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })} />
              </div>
              <div>
                <label>Cooldown</label>
                <select
                  value={editingRule.cooldownMs}
                  onChange={(e) => setEditingRule({ ...editingRule, cooldownMs: Number(e.target.value) })}
                >
                  <option value={0}>No cooldown</option>
                  <option value={5000}>5 seconds</option>
                  <option value={15000}>15 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                </select>
              </div>
            </div>

            <label style={{ display: "block", marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={editingRule.enabled}
                onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
              />{" "}
              Enabled
            </label>

            <div className="grid">
              <div>
                <label>Trigger</label>
                <select
                  value={editingRule.trigger.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setEditingRule({
                      ...editingRule,
                      trigger: type === "chat_command" ? { type, command: "!hello" } : type === "manual" ? { type } : { type: "stream_event", eventType: "follow" },
                    });
                  }}
                >
                  <option value="stream_event">Stream event</option>
                  <option value="chat_command">Chat command</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>
              {editingRule.trigger.type === "stream_event" && (
                <div>
                  <label>Event type</label>
                  <select
                    value={editingRule.trigger.eventType}
                    onChange={(e) => setEditingRule({ ...editingRule, trigger: { type: "stream_event", eventType: e.target.value as StreamEventType } })}
                  >
                    {["follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points", "chat", "goal_milestone"].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}
              {editingRule.trigger.type === "chat_command" && (
                <div>
                  <label>Command</label>
                  <input
                    value={editingRule.trigger.command}
                    onChange={(e) => setEditingRule({ ...editingRule, trigger: { type: "chat_command", command: e.target.value } })}
                  />
                </div>
              )}
            </div>

            <h2>Conditions</h2>
            {editingRule.conditions.map((condition, index) => (
              <div className="card" key={`${condition.type}-${index}`} style={{ marginBottom: 12 }}>
                <div className="grid">
                  <div>
                    <label>Condition</label>
                    <select
                      value={condition.type}
                      onChange={(e) => updateCondition(index, conditionTemplate(e.target.value as AutomationCondition["type"]))}
                    >
                      <option value="min_amount">Minimum amount</option>
                      <option value="message_includes">Message includes</option>
                      <option value="user_role">User role</option>
                    </select>
                  </div>
                  {condition.type === "min_amount" && (
                    <div>
                      <label>Amount</label>
                      <input
                        type="number"
                        value={condition.amount}
                        onChange={(e) => updateCondition(index, { type: "min_amount", amount: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {condition.type === "message_includes" && (
                    <div>
                      <label>Text</label>
                      <input
                        value={condition.text}
                        onChange={(e) => updateCondition(index, { type: "message_includes", text: e.target.value })}
                      />
                    </div>
                  )}
                  {condition.type === "user_role" && (
                    <div>
                      <label>Role</label>
                      <select
                        value={condition.role}
                        onChange={(e) => updateCondition(index, { type: "user_role", role: e.target.value as AutomationCondition["role"] })}
                      >
                        <option value="moderator">Moderator</option>
                        <option value="broadcaster">Broadcaster</option>
                        <option value="subscriber">Subscriber</option>
                        <option value="vip">VIP</option>
                      </select>
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeConditionAt(index)}>
                  Remove condition
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: 16 }}
              onClick={() => setEditingRule({ ...editingRule, conditions: [...editingRule.conditions, conditionTemplate("min_amount")] })}
            >
              Add condition
            </button>

            <h2>Actions</h2>
            {editingRule.actions.map((action, index) => (
              <div className="card" key={`${action.type}-${index}`} style={{ marginBottom: 12 }}>
                <div className="form-row">
                  <label>Action {index + 1}</label>
                  <select
                    value={action.type}
                    onChange={(e) => updateEventAction(index, eventActionTemplate(e.target.value as AutomationActionConfig["type"]))}
                  >
                    <option value="macro">Run macro</option>
                    <option value="effect">Run interaction/effect</option>
                    <option value="source_group">Activate activity layout</option>
                    <option value="twitch_chat">Send Twitch chat</option>
                    <option value="overlay_event">Send overlay event</option>
                    <option value="wait">Wait</option>
                  </select>
                </div>

                {action.type === "macro" && (
                  <div className="form-row">
                    <label>Macro</label>
                    <select value={action.macroId} onChange={(e) => updateEventAction(index, { type: "macro", macroId: e.target.value })}>
                      <option value="">Select macro</option>
                      {macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}
                    </select>
                  </div>
                )}
                {action.type === "effect" && (
                  <div className="form-row">
                    <label>Interaction/effect</label>
                    <select value={action.effectId} onChange={(e) => updateEventAction(index, { type: "effect", effectId: e.target.value })}>
                      <option value="">Select effect</option>
                      {effects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
                    </select>
                  </div>
                )}
                {action.type === "source_group" && (
                  <div className="form-row">
                    <label>Activity layout</label>
                    <select value={action.sourceGroupId} onChange={(e) => updateEventAction(index, { type: "source_group", sourceGroupId: e.target.value })}>
                      <option value="">Select layout</option>
                      {sourceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </div>
                )}
                {action.type === "twitch_chat" && (
                  <div className="form-row">
                    <label>Message</label>
                    <input value={action.message} onChange={(e) => updateEventAction(index, { type: "twitch_chat", message: e.target.value })} />
                  </div>
                )}
                {action.type === "overlay_event" && (
                  <div className="grid">
                    <div>
                      <label>Channel</label>
                      <input value={action.channel} onChange={(e) => updateEventAction(index, { ...action, channel: e.target.value })} />
                    </div>
                    <div>
                      <label>Name</label>
                      <input value={action.name} onChange={(e) => updateEventAction(index, { ...action, name: e.target.value })} />
                    </div>
                  </div>
                )}
                {action.type === "wait" && (
                  <div className="form-row">
                    <label>Duration (ms)</label>
                    <input
                      type="number"
                      value={action.durationMs}
                      onChange={(e) => updateEventAction(index, { type: "wait", durationMs: Number(e.target.value) })}
                    />
                  </div>
                )}
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeEventActionAt(index)}>
                  Remove action
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: 16 }}
              onClick={() => setEditingRule({ ...editingRule, actions: [...editingRule.actions, eventActionTemplate("macro")] })}
            >
              Add action
            </button>

            <div className="actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveRule()}>
                Save rule
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingRule(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void runRule(editingRule)}>
                Run now
              </button>
            </div>
          </div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Action</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{describeRuleTrigger(rule)}</td>
                <td>{rule.actions.length ? rule.actions.map(describeAction).join(", ") : "none"}</td>
                <td>
                  {rule.enabled ? rule.lastStatus ?? "waiting" : "paused"}
                  {rule.lastMessage ? ` - ${rule.lastMessage}` : ""}
                </td>
                <td>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void runRule(rule)}>
                    Run
                  </button>{" "}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingRule(rule)}>
                    Edit
                  </button>{" "}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeRule(rule.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rules.length && <p style={{ color: "var(--muted)", padding: 12 }}>No event automation rules configured.</p>}
      </div>

      <div className="card">
        <h2>Automation run history</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Rule</th>
              <th>Status</th>
              <th>Message</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 25).map((run) => {
              const rule = rules.find((r) => r.id === run.rule_id);
              return (
                <tr key={run.id}>
                  <td>{new Date(run.created_at).toLocaleString()}</td>
                  <td>{rule?.name ?? run.rule_id}</td>
                  <td>{run.status}</td>
                  <td>{run.message}</td>
                  <td>{run.event_id ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!runs.length && <p style={{ color: "var(--muted)", padding: 12 }}>No automation runs yet.</p>}
      </div>

      <p className="subtitle">Timer jobs run macros, commands, chat messages, effects, or activity layouts on a repeating schedule.</p>

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
