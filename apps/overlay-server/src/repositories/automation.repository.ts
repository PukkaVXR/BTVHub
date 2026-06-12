import type { DatabaseSync } from "node:sqlite";
import type { AutomationRule } from "@btv/shared";
import { AutomationRuleSchema } from "@btv/shared";

export type AutomationAction = "macro" | "effect" | "source_group" | "command" | "twitch_chat";

export interface AutomationConfig {
  id: string;
  name: string;
  enabled: boolean;
  intervalMs: number;
  action: AutomationAction;
  actionConfig: Record<string, unknown>;
  runOnStart: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  lastStatus?: "ok" | "failed" | "running";
  lastMessage?: string;
}

export interface AutomationRunRow {
  id: string;
  rule_id: string;
  event_id: string | null;
  status: string;
  message: string;
  created_at: string;
}

interface AutomationRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
  parseRecord: (raw: unknown) => Record<string, unknown>;
  parseJsonValue: <T>(raw: unknown, fallback: T) => T;
}

export function createAutomationRepository({
  getDb,
  withTransaction,
  parseRecord,
  parseJsonValue,
}: AutomationRepositoryDeps) {
  const rowToAutomation = (row: Record<string, unknown>): AutomationConfig => ({
    id: String(row.id),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    intervalMs: Number(row.interval_ms),
    action: String(row.action) as AutomationAction,
    actionConfig: parseRecord(row.action_config),
    runOnStart: Boolean(row.run_on_start),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : undefined,
    runCount: Number(row.run_count ?? 0),
    lastStatus: row.last_status ? (String(row.last_status) as AutomationConfig["lastStatus"]) : undefined,
    lastMessage: row.last_message ? String(row.last_message) : undefined,
  });

  const rowToAutomationRule = (row: Record<string, unknown>): AutomationRule =>
    AutomationRuleSchema.parse({
      id: String(row.id),
      name: String(row.name),
      enabled: Boolean(row.enabled),
      trigger: parseJsonValue(row.trigger_json, { type: "manual" }),
      conditions: parseJsonValue(row.conditions_json, []),
      actions: parseJsonValue(row.actions_json, []),
      cooldownMs: Number(row.cooldown_ms ?? 0),
      lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
      lastStatus: row.last_status ? String(row.last_status) : undefined,
      lastMessage: row.last_message ? String(row.last_message) : undefined,
      runCount: Number(row.run_count ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });

  function getAutomations(): AutomationConfig[] {
    return (getDb().prepare("SELECT * FROM automations ORDER BY name").all() as Array<Record<string, unknown>>).map(
      rowToAutomation,
    );
  }

  function getAutomation(id: string): AutomationConfig | null {
    const row = getDb().prepare("SELECT * FROM automations WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToAutomation(row) : null;
  }

  function upsertAutomation(automation: AutomationConfig): void {
    getDb().prepare(
      `INSERT INTO automations
        (id, name, enabled, interval_ms, action, action_config, run_on_start, last_run_at, next_run_at, run_count, last_status, last_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        enabled=excluded.enabled,
        interval_ms=excluded.interval_ms,
        action=excluded.action,
        action_config=excluded.action_config,
        run_on_start=excluded.run_on_start,
        last_run_at=excluded.last_run_at,
        next_run_at=excluded.next_run_at,
        run_count=excluded.run_count,
        last_status=excluded.last_status,
        last_message=excluded.last_message`,
    ).run(
      automation.id,
      automation.name,
      automation.enabled ? 1 : 0,
      automation.intervalMs,
      automation.action,
      JSON.stringify(automation.actionConfig ?? {}),
      automation.runOnStart ? 1 : 0,
      automation.lastRunAt ?? null,
      automation.nextRunAt ?? null,
      automation.runCount ?? 0,
      automation.lastStatus ?? null,
      automation.lastMessage ?? null,
    );
  }

  function deleteAutomation(id: string): void {
    getDb().prepare("DELETE FROM automations WHERE id = ?").run(id);
  }

  function getAutomationRules(): AutomationRule[] {
    return (getDb().prepare("SELECT * FROM automation_rules ORDER BY name").all() as Array<Record<string, unknown>>).map(
      rowToAutomationRule,
    );
  }

  function getAutomationRule(id: string): AutomationRule | null {
    const row = getDb().prepare("SELECT * FROM automation_rules WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToAutomationRule(row) : null;
  }

  function upsertAutomationRule(rule: AutomationRule): void {
    const parsed = AutomationRuleSchema.parse(rule);
    getDb().prepare(
      `INSERT INTO automation_rules
        (id, name, enabled, trigger_json, conditions_json, actions_json, cooldown_ms, last_run_at, last_status, last_message, run_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        enabled=excluded.enabled,
        trigger_json=excluded.trigger_json,
        conditions_json=excluded.conditions_json,
        actions_json=excluded.actions_json,
        cooldown_ms=excluded.cooldown_ms,
        last_run_at=excluded.last_run_at,
        last_status=excluded.last_status,
        last_message=excluded.last_message,
        run_count=excluded.run_count,
        updated_at=excluded.updated_at`,
    ).run(
      parsed.id,
      parsed.name,
      parsed.enabled ? 1 : 0,
      JSON.stringify(parsed.trigger),
      JSON.stringify(parsed.conditions),
      JSON.stringify(parsed.actions),
      parsed.cooldownMs,
      parsed.lastRunAt ?? null,
      parsed.lastStatus ?? null,
      parsed.lastMessage ?? null,
      parsed.runCount,
      parsed.createdAt,
      parsed.updatedAt,
    );
  }

  function deleteAutomationRule(id: string): void {
    withTransaction(() => {
      getDb().prepare("DELETE FROM automation_runs WHERE rule_id = ?").run(id);
      getDb().prepare("DELETE FROM automation_rules WHERE id = ?").run(id);
    });
  }

  function recordAutomationRuleRun(
    ruleId: string,
    eventId: string | null,
    status: "ok" | "failed" | "skipped",
    message: string,
  ): void {
    withTransaction(() => {
      const now = new Date().toISOString();
      getDb().prepare(
        `INSERT INTO automation_runs (id, rule_id, event_id, status, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(crypto.randomUUID(), ruleId, eventId, status, message, now);
      getDb().prepare(
        `DELETE FROM automation_runs WHERE id NOT IN (SELECT id FROM automation_runs ORDER BY created_at DESC LIMIT 200)`,
      ).run();

      const existing = getAutomationRule(ruleId);
      if (!existing) return;
      upsertAutomationRule({
        ...existing,
        lastRunAt: now,
        lastStatus: status,
        lastMessage: message,
        runCount: existing.runCount + (status === "ok" || status === "failed" ? 1 : 0),
        updatedAt: existing.updatedAt,
      });
    });
  }

  function getAutomationRuns(limit = 50): AutomationRunRow[] {
    return getDb()
      .prepare(
        `SELECT id, rule_id, event_id, status, message, created_at
         FROM automation_runs
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as AutomationRunRow[];
  }

  function getAutomationStateValue(key: string): unknown {
    const row = getDb().prepare("SELECT value_json FROM automation_state WHERE key = ?").get(key) as
      | { value_json: string }
      | undefined;
    if (!row) return undefined;
    return parseJsonValue(row.value_json, undefined);
  }

  function getAutomationStateSnapshot(): Record<string, unknown> {
    const rows = getDb().prepare("SELECT key, value_json FROM automation_state").all() as Array<{
      key: string;
      value_json: string;
    }>;
    return Object.fromEntries(rows.map((row) => [row.key, parseJsonValue(row.value_json, undefined)]));
  }

  function setAutomationStateValue(key: string, value: unknown): void {
    getDb().prepare(
      `INSERT INTO automation_state (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    ).run(key, JSON.stringify(value), new Date().toISOString());
  }

  function deleteAutomationStateValue(key: string): void {
    getDb().prepare("DELETE FROM automation_state WHERE key = ?").run(key);
  }

  return {
    getAutomations,
    getAutomation,
    upsertAutomation,
    deleteAutomation,
    getAutomationRules,
    getAutomationRule,
    upsertAutomationRule,
    deleteAutomationRule,
    recordAutomationRuleRun,
    getAutomationRuns,
    getAutomationStateValue,
    getAutomationStateSnapshot,
    setAutomationStateValue,
    deleteAutomationStateValue,
  };
}
