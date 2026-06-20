import { useState } from "react";
import {
  api,
  type AutomationConfig,
  type AutomationRule,
  type AutomationRun,
  type ChatCommand,
  type MacroConfig,
  type SourceGroup,
} from "../api";
import type { StreamEventType } from "@btv/shared";
import { AutomationRunHistory } from "../components/automations/AutomationRunHistory";
import { EventRuleConditionsEditor } from "../components/automations/EventRuleConditionsEditor";
import { EventRuleActionsEditor } from "../components/automations/EventRuleActionsEditor";
import { EventRuleList } from "../components/automations/EventRuleList";
import { EventRuleTestControls } from "../components/automations/EventRuleTestControls";
import { EventRuleTriggerEditor } from "../components/automations/EventRuleTriggerEditor";
import { ScheduledAutomationsPanel } from "../components/automations/ScheduledAutomationsPanel";
import { useToast } from "../hooks/useToast";
import { usePollingQuery } from "../hooks/usePollingQuery";
import { Button, EmptyState, PageHeader, SplitWorkspace } from "../ui";

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

export default function AutomationsPage() {
  const [editing, setEditing] = useState<AutomationConfig | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [configJson, setConfigJson] = useState("{}");
  const [testEventJson, setTestEventJson] = useState(
    JSON.stringify(
      {
        type: "follow",
        user: { id: "test", login: "testuser", displayName: "TestUser" },
        message: "Phase 1 test event",
        amount: 1,
        payload: { roles: ["moderator"] },
      },
      null,
      2,
    ),
  );
  const [ruleTestResult, setRuleTestResult] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [automationTab, setAutomationTab] = useState<"rules" | "scheduled">("rules");
  const toast = useToast();
  const { data, refresh, setData } = usePollingQuery({
    query: async () => {
      const [automations, rules, runs, macros, effects, sourceGroups, chatCommands] = await Promise.all([
        api.automations(),
        api.automationRules(),
        api.automationRuns(),
        api.macros(),
        api.effects(),
        api.sourceGroups(),
        api.chatCommands(),
      ]);
      return {
        automations,
        rules,
        runs,
        macros,
        effects: effects.map((effect) => ({ id: effect.id, name: effect.name })),
        sourceGroups,
        chatCommands,
      };
    },
    initialData: {
      automations: [] as AutomationConfig[],
      rules: [] as AutomationRule[],
      runs: [] as AutomationRun[],
      macros: [] as MacroConfig[],
      effects: [] as Array<{ id: string; name: string }>,
      sourceGroups: [] as SourceGroup[],
      chatCommands: [] as ChatCommand[],
    },
    intervalMs: 10_000,
  });
  const { automations, rules, runs, macros, effects, sourceGroups, chatCommands } = data;

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
    void refresh();
  };

  const remove = async (id: string) => {
    await api.deleteAutomation(id);
    toast("Automation deleted");
    if (editing?.id === id) setEditing(null);
    void refresh();
  };

  const runNow = async (automation: AutomationConfig) => {
    try {
      const res = await api.runAutomation(automation.id);
      toast(res.message);
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Automation failed");
    }
  };

  const toggleAutomationEnabled = async (automation: AutomationConfig, enabled: boolean) => {
    const next = { ...automation, enabled };
    setData((current) => ({
      ...current,
      automations: current.automations.map((item) => (item.id === automation.id ? next : item)),
    }));
    if (editing?.id === automation.id) setEditing(next);
    try {
      await api.saveAutomation(next);
      toast(enabled ? "Automation enabled" : "Automation paused");
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update automation");
      void refresh();
    }
  };

  const saveRule = async () => {
    if (!editingRule) return;
    await api.saveAutomationRule({ ...editingRule, updatedAt: new Date().toISOString() });
    toast("Event rule saved");
    setEditingRule(null);
    void refresh();
  };

  const removeRule = async (id: string) => {
    await api.deleteAutomationRule(id);
    toast("Event rule deleted");
    if (editingRule?.id === id) setEditingRule(null);
    void refresh();
  };

  const runRule = async (rule: AutomationRule) => {
    try {
      const res = await api.runAutomationRule(rule.id);
      setRuleTestResult({ tone: "success", message: res.message });
      toast(res.message);
      void refresh();
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
      void refresh();
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
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test event failed");
    }
  };

  const dispatchDashboardEvent = async () => {
    try {
      const res = await api.dispatchEvent({ type: "dashboard.manual", payload: { source: "AutomationsPage" } });
      toast(`Core event dispatched: ${res.event.type}`);
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Core event failed");
    }
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
            <p className="subtitle">
              Trigger actions from Twitch/chat/manual events with cooldowns. This is the Phase 1 foundation.
            </p>
            <div className="actions" style={{ marginBottom: 16 }}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setRuleTestResult(null);
                  setEditingRule(emptyRule());
                }}
              >
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

            <SplitWorkspace
              className="automation-rule-workspace"
              sidebarClassName="automation-rule-list"
              detailClassName="automation-rule-detail"
              sidebarLabel="Event automation rules"
              sidebar={
                <EventRuleList
                  rules={rules}
                  selectedRuleId={editingRule?.id}
                  onSelect={(rule) => {
                    setRuleTestResult(null);
                    setEditingRule(rule);
                  }}
                />
              }
              detail={
                editingRule ? (
                  <div className="card automation-builder-card" style={{ marginBottom: 16 }}>
                    <h2>{editingRule.id.startsWith("rule-") ? "Edit event rule" : editingRule.name}</h2>
                    <div className="grid">
                      <div>
                        <label>Name</label>
                        <input
                          value={editingRule.name}
                          onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                        />
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

                    <EventRuleTriggerEditor
                      trigger={editingRule.trigger}
                      chatCommands={chatCommands}
                      onChange={(trigger) => setEditingRule({ ...editingRule, trigger })}
                    />

                    <EventRuleConditionsEditor
                      conditions={editingRule.conditions}
                      onChange={(conditions) => setEditingRule({ ...editingRule, conditions })}
                    />

                    <EventRuleActionsEditor
                      actions={editingRule.actions}
                      macros={macros}
                      effects={effects}
                      sourceGroups={sourceGroups}
                      onChange={(actions) => setEditingRule({ ...editingRule, actions })}
                    />
                    <EventRuleTestControls
                      rule={editingRule}
                      result={ruleTestResult}
                      testEventJson={testEventJson}
                      onTestEventJsonChange={setTestEventJson}
                      onTest={(rule) => void runRuleTest(rule)}
                      onSave={() => void saveRule()}
                      onCancel={() => setEditingRule(null)}
                      onRun={(rule) => void runRule(rule)}
                      onDelete={(id) => void removeRule(id)}
                    />
                  </div>
                ) : (
                  <EmptyState
                    title="Select a rule"
                    description="Pick a rule from the list or create a new one to edit trigger, conditions, actions, and tests."
                  />
                )
              }
            />
          </div>

          <AutomationRunHistory rules={rules} runs={runs} />
        </>
      )}

      {automationTab === "scheduled" && (
        <ScheduledAutomationsPanel
          automations={automations}
          editing={editing}
          configJson={configJson}
          macros={macros}
          effects={effects}
          sourceGroups={sourceGroups}
          onEdit={edit}
          onEditingChange={setEditing}
          onConfigJsonChange={setConfigJson}
          onSave={() => void save()}
          onRunNow={(automation) => void runNow(automation)}
          onToggleEnabled={(automation, enabled) => void toggleAutomationEnabled(automation, enabled)}
          onDelete={(id) => void remove(id)}
        />
      )}
    </>
  );
}
