import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AutomationAction,
  type AutomationActionConfig,
  type AutomationCondition,
  type AutomationConfig,
  type AutomationRule,
  type AutomationRun,
  type ChatCommand,
  type MacroConfig,
  type SourceGroup,
} from "../api";
import type { StreamEventType } from "@btv/shared";
import { useToast } from "../hooks/useToast";
import { Button, Callout, EmptyState, PageHeader, StatusPill } from "../ui";

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
    case "obs_scene":
      return { type, sceneName: "" };
    case "obs_source_visibility":
      return { type, sceneName: "", sourceName: "", visible: true };
    case "obs_source_motion":
      return { type, sceneName: "", sourceName: "", mode: "set", x: 0, y: 0, scale: 1, restore: false };
    case "obs_filter":
      return { type, sourceName: "", filterName: "", enabled: true };
    case "obs_mute":
      return { type, inputName: "", muted: true };
    case "obs_recording":
      return { type, action: "start" };
    case "obs_streaming":
      return { type, action: "start" };
    case "obs_text":
      return { type, inputName: "", text: "Updated by {user}" };
    case "clear_alerts":
      return { type };
    case "twitch_chat":
      return { type, message: "Thanks {user}!" };
    case "overlay_event":
      return { type, channel: "effects", name: "automation", payload: {} };
    case "overlay_alert":
      return { type, themeId: "default", eventType: "unknown", message: "Automation alert for {user}", userName: "{user}", durationMs: 5000 };
    case "overlay_animation":
      return { type, channel: "effects", name: "automation", payload: {} };
    case "widget_text":
      return { type, widgetId: "ticker", text: "Updated by {user}" };
    case "variable_set":
      return { type, name: "counter", value: 0 };
    case "variable_increment":
      return { type, name: "counter", amount: 1 };
    case "variable_decrement":
      return { type, name: "counter", amount: 1 };
    case "variable_reset":
      return { type, name: "counter" };
    case "branch":
      return { type, conditions: [], thenActions: [], elseActions: [] };
    case "random_choice":
      return { type, choices: [{ weight: 1, actions: [] }] };
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
    case "variable_compare":
      return { type, name: "counter", operator: "exists" };
    default:
      return { type: "min_amount", amount: 1 };
  }
}

function describeRuleTrigger(rule: AutomationRule): string {
  if (rule.trigger.type === "stream_event") return rule.trigger.eventType;
  if (rule.trigger.type === "btv_event") return rule.trigger.eventType;
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
    case "obs_scene":
      return `scene:${action.sceneName || "unset"}`;
    case "obs_source_visibility":
      return `${action.visible ? "show" : "hide"}:${action.sourceName || "unset"}`;
    case "obs_source_motion":
      return `motion:${action.sourceName || "unset"}`;
    case "obs_filter":
      return `${action.enabled ? "enable" : "disable"} filter:${action.filterName || "unset"}`;
    case "obs_mute":
      return `${action.muted ? "mute" : "unmute"}:${action.inputName || "unset"}`;
    case "obs_recording":
      return `recording:${action.action}`;
    case "obs_streaming":
      return `streaming:${action.action}`;
    case "obs_text":
      return `text:${action.inputName || "unset"}`;
    case "clear_alerts":
      return "clear alerts";
    case "twitch_chat":
      return "twitch chat";
    case "overlay_event":
      return `overlay:${action.name}`;
    case "overlay_alert":
      return `alert:${action.eventType}`;
    case "overlay_animation":
      return `animation:${action.name}`;
    case "widget_text":
      return `widget:${action.widgetId}`;
    case "variable_set":
      return `set:${action.name}`;
    case "variable_increment":
      return `increment:${action.name}`;
    case "variable_decrement":
      return `decrement:${action.name}`;
    case "variable_reset":
      return `reset:${action.name}`;
    case "branch":
      return "branch";
    case "random_choice":
      return "random choice";
    case "wait":
      return `wait ${action.durationMs}ms`;
    default:
      return "action";
  }
}

function formatInterval(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function automationStatusTone(status: AutomationConfig["lastStatus"] | undefined, enabled: boolean): "success" | "warning" | "danger" | "neutral" {
  if (!enabled) return "neutral";
  if (status === "ok") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "neutral";
}

function chatCommandOptions(commands: ChatCommand[]): Array<{ value: string; label: string }> {
  return commands.flatMap((command) => [
    { value: command.command, label: `${command.command} - ${command.enabled ? "enabled" : "disabled"}` },
    ...command.aliases.map((alias) => ({ value: alias, label: `${alias} - alias for ${command.command}` })),
  ]);
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationConfig[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [effects, setEffects] = useState<Array<{ id: string; name: string }>>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [chatCommands, setChatCommands] = useState<ChatCommand[]>([]);
  const [editing, setEditing] = useState<AutomationConfig | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [configJson, setConfigJson] = useState("{}");
  const [testEventJson, setTestEventJson] = useState(JSON.stringify({
    type: "follow",
    user: { id: "test", login: "testuser", displayName: "TestUser" },
    message: "Phase 1 test event",
    amount: 1,
    payload: { roles: ["moderator"] },
  }, null, 2));
  const [ruleTestResult, setRuleTestResult] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [automationTab, setAutomationTab] = useState<"rules" | "scheduled">("rules");
  const toast = useToast();

  const load = () => {
    void Promise.all([
      api.automations(),
      api.automationRules(),
      api.automationRuns(),
      api.macros(),
      api.effects(),
      api.sourceGroups(),
      api.chatCommands(),
    ]).then(
      ([a, r, runList, m, e, s, commands]) => {
        setAutomations(a);
        setRules(r);
        setRuns(runList);
        setMacros(m);
        setEffects(e.map((effect) => ({ id: effect.id, name: effect.name })));
        setSourceGroups(s);
        setChatCommands(commands);
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
  const commandOptions = useMemo(() => chatCommandOptions(chatCommands), [chatCommands]);

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

  const toggleAutomationEnabled = async (automation: AutomationConfig, enabled: boolean) => {
    const next = { ...automation, enabled };
    setAutomations((current) => current.map((item) => item.id === automation.id ? next : item));
    if (editing?.id === automation.id) setEditing(next);
    try {
      await api.saveAutomation(next);
      toast(enabled ? "Automation enabled" : "Automation paused");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update automation");
      load();
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
      setRuleTestResult({ tone: "success", message: res.message });
      toast(res.message);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rule failed";
      setRuleTestResult({ tone: "danger", message });
      toast(message);
    }
  };

  const runRuleTest = async (rule: AutomationRule) => {
    try {
      const parsed = JSON.parse(testEventJson) as import("../api").TestStreamEvent;
      const res = await api.testAutomationRule(rule.id, parsed);
      setRuleTestResult({ tone: "success", message: res.message });
      toast(res.message);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rule test failed";
      setRuleTestResult({ tone: "danger", message });
      toast(message);
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

  const dispatchDashboardEvent = async () => {
    try {
      const res = await api.dispatchEvent({ type: "dashboard.manual", payload: { source: "AutomationsPage" } });
      toast(`Core event dispatched: ${res.event.type}`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Core event failed");
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
      <PageHeader title="Automations" description="Phase 1 event rules plus the older repeating timer jobs." />

      <div className="section-tabs" aria-label="Automation sections">
        <button
          type="button"
          className={`section-tabs__item${automationTab === "rules" ? " section-tabs__item--active" : ""}`}
          onClick={() => setAutomationTab("rules")}
        >
          <span>Event rules</span>
          <small>{rules.length}</small>
        </button>
        <button
          type="button"
          className={`section-tabs__item${automationTab === "scheduled" ? " section-tabs__item--active" : ""}`}
          onClick={() => setAutomationTab("scheduled")}
        >
          <span>Scheduled jobs</span>
          <small>{automations.length}</small>
        </button>
      </div>

      {automationTab === "rules" && (
      <>
      <div className="card automation-rule-card">
        <h2>Event automation rules</h2>
        <p className="subtitle">Trigger actions from Twitch/chat/manual events with cooldowns. This is the Phase 1 foundation.</p>
        <div className="actions" style={{ marginBottom: 16 }}>
          <Button type="button" variant="primary" size="sm" onClick={() => { setRuleTestResult(null); setEditingRule(emptyRule()); }}>
            New event rule
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void fireTestEvent("follow")}>
            Test follow
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void fireTestEvent("chat")}>
            Test chat
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void dispatchDashboardEvent()}>
            Test dashboard event
          </Button>
        </div>

        <div className="automation-rule-workspace">
          <aside className="automation-rule-list" aria-label="Event automation rules">
            {rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                className={editingRule?.id === rule.id ? "active" : ""}
                onClick={() => { setRuleTestResult(null); setEditingRule(rule); }}
              >
                <span>{rule.name}</span>
                <small>{describeRuleTrigger(rule)} · {rule.actions.length ? rule.actions.map(describeAction).join(", ") : "no actions"}</small>
                <StatusPill tone={rule.enabled ? "info" : "neutral"} label={rule.enabled ? rule.lastStatus ?? "waiting" : "paused"} />
              </button>
            ))}
            {!rules.length && (
              <EmptyState title="No event rules yet" description="Create one to react to Twitch events, chat commands, webhooks, or manual triggers." />
            )}
          </aside>

          <section className="automation-rule-detail">
        {editingRule ? (
          <div className="card automation-builder-card" style={{ marginBottom: 16 }}>
            <h2>{editingRule.id.startsWith("rule-") ? "Edit event rule" : editingRule.name}</h2>
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

            <div className="automation-builder-step">
              <strong>1. Trigger</strong>
              <span>Choose what wakes this rule up.</span>
            </div>
            <div className="grid">
              <div>
                <label>Trigger</label>
                <select
                  value={editingRule.trigger.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setEditingRule({
                      ...editingRule,
                      trigger:
                        type === "chat_command"
                          ? { type, command: commandOptions[0]?.value ?? "!hello" }
                          : type === "manual"
                            ? { type }
                            : type === "btv_event"
                              ? { type, eventType: "obs.scene_changed" }
                              : { type: "stream_event", eventType: "follow" },
                    });
                  }}
                >
                  <option value="stream_event">Stream event</option>
                  <option value="btv_event">Core BTV event</option>
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
              {editingRule.trigger.type === "btv_event" && (
                <div>
                  <label>Core event type</label>
                  <select
                    value={editingRule.trigger.eventType}
                    onChange={(e) => setEditingRule({ ...editingRule, trigger: { type: "btv_event", eventType: e.target.value } })}
                  >
                    {[
                      "obs.scene_changed",
                      "timer.minute",
                      "webhook.alert",
                      "webhook.goal_increment",
                      "webhook.effect",
                      "webhook.macro",
                      "webhook.custom_event",
                      "dashboard.manual",
                      "emergency.all",
                    ].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}
              {editingRule.trigger.type === "chat_command" && (() => {
                const trigger = editingRule.trigger;
                return (
                  <div>
                    <label>Command</label>
                    {commandOptions.length ? (
                      <select
                        value={trigger.command}
                        onChange={(e) => setEditingRule({ ...editingRule, trigger: { type: "chat_command", command: e.target.value } })}
                      >
                        {!commandOptions.some((option) => option.value === trigger.command) && (
                          <option value={trigger.command}>{trigger.command || "Custom command"}</option>
                        )}
                        {commandOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={trigger.command}
                        onChange={(e) => setEditingRule({ ...editingRule, trigger: { type: "chat_command", command: e.target.value } })}
                        placeholder="!hello"
                      />
                    )}
                    <p className="subtitle">Actions can use {"{command}"} and {"{args}"} from the chat message.</p>
                  </div>
                );
              })()}
            </div>

            <div className="automation-builder-step">
              <strong>2. Conditions</strong>
              <span>Optional gates that must pass before actions run.</span>
            </div>
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
                      <option value="variable_compare">Variable compare</option>
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
                        onChange={(e) => updateCondition(index, { type: "user_role", role: e.target.value as Extract<AutomationCondition, { type: "user_role" }>["role"] })}
                      >
                        <option value="moderator">Moderator</option>
                        <option value="broadcaster">Broadcaster</option>
                        <option value="subscriber">Subscriber</option>
                        <option value="vip">VIP</option>
                      </select>
                    </div>
                  )}
                  {condition.type === "variable_compare" && (
                    <>
                      <div>
                        <label>Variable</label>
                        <input value={condition.name} onChange={(e) => updateCondition(index, { ...condition, name: e.target.value })} />
                      </div>
                      <div>
                        <label>Operator</label>
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, { ...condition, operator: e.target.value as typeof condition.operator })}
                        >
                          <option value="exists">Exists</option>
                          <option value="equals">Equals</option>
                          <option value="not_equals">Not equals</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                        </select>
                      </div>
                      <div>
                        <label>Value</label>
                        <input
                          value={String(condition.value ?? "")}
                          onChange={(e) => updateCondition(index, { ...condition, value: e.target.value })}
                        />
                      </div>
                    </>
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

            <div className="automation-builder-step">
              <strong>3. Actions</strong>
              <span>What BTV should do when the trigger and conditions match.</span>
            </div>
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
                    <option value="obs_scene">Switch OBS scene</option>
                    <option value="obs_source_visibility">Show / hide OBS source</option>
                    <option value="obs_source_motion">Set / move OBS source</option>
                    <option value="obs_filter">Enable / disable OBS filter</option>
                    <option value="obs_mute">Mute / unmute OBS input</option>
                    <option value="obs_recording">Control OBS recording</option>
                    <option value="obs_streaming">Control OBS streaming</option>
                    <option value="obs_text">Set OBS text</option>
                    <option value="clear_alerts">Clear alert queue</option>
                    <option value="twitch_chat">Send Twitch chat</option>
                    <option value="overlay_event">Send overlay event</option>
                    <option value="overlay_alert">Trigger overlay alert</option>
                    <option value="overlay_animation">Trigger overlay animation</option>
                    <option value="widget_text">Update widget text</option>
                    <option value="variable_set">Set variable</option>
                    <option value="variable_increment">Increment variable</option>
                    <option value="variable_decrement">Decrement variable</option>
                    <option value="variable_reset">Reset variable</option>
                    <option value="branch">Branch / if</option>
                    <option value="random_choice">Random choice</option>
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
                {action.type === "obs_scene" && (
                  <div className="form-row">
                    <label>Scene name</label>
                    <input value={action.sceneName} onChange={(e) => updateEventAction(index, { type: "obs_scene", sceneName: e.target.value })} />
                  </div>
                )}
                {action.type === "obs_source_visibility" && (
                  <div className="grid">
                    <div>
                      <label>Scene name</label>
                      <input value={action.sceneName} onChange={(e) => updateEventAction(index, { ...action, sceneName: e.target.value })} />
                    </div>
                    <div>
                      <label>Source name</label>
                      <input value={action.sourceName} onChange={(e) => updateEventAction(index, { ...action, sourceName: e.target.value })} />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={action.visible}
                        onChange={(e) => updateEventAction(index, { ...action, visible: e.target.checked })}
                      />{" "}
                      Show source
                    </label>
                  </div>
                )}
                {action.type === "obs_source_motion" && (
                  <div className="grid">
                    <div>
                      <label>Scene name</label>
                      <input value={action.sceneName} onChange={(e) => updateEventAction(index, { ...action, sceneName: e.target.value })} />
                    </div>
                    <div>
                      <label>Source name</label>
                      <input value={action.sourceName} onChange={(e) => updateEventAction(index, { ...action, sourceName: e.target.value })} />
                    </div>
                    <div>
                      <label>Mode</label>
                      <select
                        value={action.mode}
                        onChange={(e) => updateEventAction(index, { ...action, mode: e.target.value as typeof action.mode })}
                      >
                        <option value="set">Set transform</option>
                        <option value="dvd">DVD bounce</option>
                        <option value="path">Path motion</option>
                      </select>
                    </div>
                    <div>
                      <label>X</label>
                      <input type="number" value={action.x ?? 0} onChange={(e) => updateEventAction(index, { ...action, x: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label>Y</label>
                      <input type="number" value={action.y ?? 0} onChange={(e) => updateEventAction(index, { ...action, y: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label>Scale</label>
                      <input
                        type="number"
                        step="0.1"
                        value={action.scale ?? 1}
                        onChange={(e) => updateEventAction(index, { ...action, scale: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label>Duration (ms)</label>
                      <input
                        type="number"
                        value={action.durationMs ?? 0}
                        onChange={(e) => updateEventAction(index, { ...action, durationMs: Number(e.target.value) })}
                      />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(action.visible)}
                        onChange={(e) => updateEventAction(index, { ...action, visible: e.target.checked })}
                      />{" "}
                      Show source first
                    </label>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(action.restore)}
                        onChange={(e) => updateEventAction(index, { ...action, restore: e.target.checked })}
                      />{" "}
                      Restore after motion
                    </label>
                  </div>
                )}
                {action.type === "obs_filter" && (
                  <div className="grid">
                    <div>
                      <label>Source name</label>
                      <input value={action.sourceName} onChange={(e) => updateEventAction(index, { ...action, sourceName: e.target.value })} />
                    </div>
                    <div>
                      <label>Filter name</label>
                      <input value={action.filterName} onChange={(e) => updateEventAction(index, { ...action, filterName: e.target.value })} />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={action.enabled}
                        onChange={(e) => updateEventAction(index, { ...action, enabled: e.target.checked })}
                      />{" "}
                      Enable filter
                    </label>
                  </div>
                )}
                {action.type === "obs_mute" && (
                  <div className="grid">
                    <div>
                      <label>Input/source name</label>
                      <input value={action.inputName} onChange={(e) => updateEventAction(index, { ...action, inputName: e.target.value })} />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={action.muted}
                        onChange={(e) => updateEventAction(index, { ...action, muted: e.target.checked })}
                      />{" "}
                      Mute input
                    </label>
                  </div>
                )}
                {action.type === "obs_recording" && (
                  <div className="form-row">
                    <label>Recording action</label>
                    <select
                      value={action.action}
                      onChange={(e) => updateEventAction(index, { type: "obs_recording", action: e.target.value as typeof action.action })}
                    >
                      <option value="start">Start recording</option>
                      <option value="stop">Stop recording</option>
                      <option value="pause">Pause recording</option>
                      <option value="resume">Resume recording</option>
                    </select>
                  </div>
                )}
                {action.type === "obs_streaming" && (
                  <div className="form-row">
                    <label>Streaming action</label>
                    <select
                      value={action.action}
                      onChange={(e) => updateEventAction(index, { type: "obs_streaming", action: e.target.value as typeof action.action })}
                    >
                      <option value="start">Start stream</option>
                      <option value="stop">Stop stream</option>
                    </select>
                  </div>
                )}
                {action.type === "obs_text" && (
                  <div className="grid">
                    <div>
                      <label>Text input name</label>
                      <input value={action.inputName} onChange={(e) => updateEventAction(index, { ...action, inputName: e.target.value })} />
                    </div>
                    <div>
                      <label>Text</label>
                      <input value={action.text} onChange={(e) => updateEventAction(index, { ...action, text: e.target.value })} />
                    </div>
                  </div>
                )}
                {action.type === "clear_alerts" && (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>Clears the active alert queue when this rule runs.</p>
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
                {action.type === "overlay_alert" && (
                  <div className="grid">
                    <div>
                      <label>Theme ID</label>
                      <input value={action.themeId} onChange={(e) => updateEventAction(index, { ...action, themeId: e.target.value })} />
                    </div>
                    <div>
                      <label>Event type</label>
                      <select
                        value={action.eventType}
                        onChange={(e) => updateEventAction(index, { ...action, eventType: e.target.value as StreamEventType })}
                      >
                        {["unknown", "follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points", "chat"].map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>User name</label>
                      <input value={action.userName} onChange={(e) => updateEventAction(index, { ...action, userName: e.target.value })} />
                    </div>
                    <div>
                      <label>Message</label>
                      <input value={action.message} onChange={(e) => updateEventAction(index, { ...action, message: e.target.value })} />
                    </div>
                    <div>
                      <label>Duration (ms)</label>
                      <input
                        type="number"
                        value={action.durationMs}
                        onChange={(e) => updateEventAction(index, { ...action, durationMs: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
                {action.type === "overlay_animation" && (
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
                {action.type === "widget_text" && (
                  <div className="grid">
                    <div>
                      <label>Widget ID</label>
                      <input value={action.widgetId} onChange={(e) => updateEventAction(index, { ...action, widgetId: e.target.value })} />
                    </div>
                    <div>
                      <label>Text</label>
                      <input value={action.text} onChange={(e) => updateEventAction(index, { ...action, text: e.target.value })} />
                    </div>
                  </div>
                )}
                {(action.type === "variable_set" || action.type === "variable_increment" || action.type === "variable_decrement" || action.type === "variable_reset") && (
                  <div className="grid">
                    <div>
                      <label>Variable</label>
                      <input value={action.name} onChange={(e) => updateEventAction(index, { ...action, name: e.target.value })} />
                    </div>
                    {action.type === "variable_set" && (
                      <div>
                        <label>Value</label>
                        <input value={String(action.value)} onChange={(e) => updateEventAction(index, { ...action, value: e.target.value })} />
                      </div>
                    )}
                    {(action.type === "variable_increment" || action.type === "variable_decrement") && (
                      <div>
                        <label>Amount</label>
                        <input
                          type="number"
                          value={action.amount}
                          onChange={(e) => updateEventAction(index, { ...action, amount: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                )}
                {(action.type === "branch" || action.type === "random_choice") && (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>
                    Advanced action saved with its default JSON shape. Edit the saved rule JSON later when the advanced editor lands.
                  </p>
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

            <div className="automation-builder-step">
              <strong>4. Test & save</strong>
              <span>Run this rule with the current payload, then save when it behaves correctly.</span>
            </div>
            {ruleTestResult && (
              <Callout tone={ruleTestResult.tone} title={ruleTestResult.tone === "success" ? "Rule test passed" : "Rule test failed"}>
                {ruleTestResult.message}
              </Callout>
            )}
            <div className="actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void runRuleTest(editingRule)}>
                Test rule
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void saveRule()}>
                Save rule
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingRule(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void runRule(editingRule)}>
                Run now
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeRule(editingRule.id)}>
                Delete rule
              </button>
            </div>

            <details className="alert-compact-section automation-advanced-payload">
              <summary>Advanced test payload JSON</summary>
              <div className="form-row" style={{ marginTop: 12 }}>
                <label>Test event payload</label>
                <textarea
                  rows={8}
                  value={testEventJson}
                  onChange={(e) => setTestEventJson(e.target.value)}
                  style={{ fontFamily: "monospace", lineHeight: 1.45 }}
                />
              </div>
            </details>
          </div>
        ) : (
          <EmptyState title="Select a rule" description="Pick a rule from the list or create a new one to edit trigger, conditions, actions, and tests." />
        )}
          </section>
        </div>
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
      </>
      )}

      {automationTab === "scheduled" && (
      <>
      <p className="subtitle">Timer jobs run macros, commands, chat messages, effects, or activity layouts on a repeating schedule.</p>

      <div className="actions" style={{ marginBottom: 16 }}>
        <Button type="button" variant="primary" size="sm" onClick={() => edit(emptyAutomation())}>
          New automation
        </Button>
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
                      onChange={(e) => void toggleAutomationEnabled(automation, e.target.checked)}
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
        {!automations.length && <EmptyState title="No scheduled jobs yet" description="Create one to run macros, chat reminders, effects, or layouts on a timer." />}
      </div>
      </>
      )}
    </>
  );
}
