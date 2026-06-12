import type { DatabaseSync } from "node:sqlite";
import type { AlertRule } from "@btv/shared";

interface AlertRulesRepositoryDeps {
  getDb: () => DatabaseSync;
}

export function createAlertRulesRepository({ getDb }: AlertRulesRepositoryDeps) {
  function getAlertRules(): AlertRule[] {
    return (getDb().prepare("SELECT * FROM alert_rules ORDER BY priority DESC").all() as Array<
      Record<string, unknown>
    >).map((row) => ({
      id: String(row.id),
      eventType: row.event_type as AlertRule["eventType"],
      themeId: String(row.theme_id),
      enabled: Boolean(row.enabled),
      cooldownMs: Number(row.cooldown_ms),
      minAmount: row.min_amount != null ? Number(row.min_amount) : undefined,
      soundAsset: row.sound_asset ? String(row.sound_asset) : undefined,
      priority: Number(row.priority),
    }));
  }

  function upsertAlertRule(rule: AlertRule): void {
    getDb().prepare(
      `INSERT INTO alert_rules (id, event_type, theme_id, enabled, cooldown_ms, min_amount, sound_asset, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET event_type=excluded.event_type, theme_id=excluded.theme_id, enabled=excluded.enabled,
         cooldown_ms=excluded.cooldown_ms, min_amount=excluded.min_amount, sound_asset=excluded.sound_asset, priority=excluded.priority`,
    ).run(
      rule.id,
      rule.eventType,
      rule.themeId,
      rule.enabled ? 1 : 0,
      rule.cooldownMs,
      rule.minAmount ?? null,
      rule.soundAsset ?? null,
      rule.priority,
    );
  }

  return {
    getAlertRules,
    upsertAlertRule,
  };
}
