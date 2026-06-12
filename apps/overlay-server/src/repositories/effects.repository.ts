import type { DatabaseSync } from "node:sqlite";
import type { Effect } from "@btv/shared";

interface EffectsRepositoryDeps {
  getDb: () => DatabaseSync;
  parseRecord: (raw: unknown) => Record<string, unknown>;
}

export function createEffectsRepository({ getDb, parseRecord }: EffectsRepositoryDeps) {
  function getEffects(): Effect[] {
    return (getDb().prepare("SELECT * FROM effects").all() as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: row.type as Effect["type"],
      triggerType: row.trigger_type as Effect["triggerType"],
      triggerConfig: parseRecord(row.trigger_config),
      effectConfig: parseRecord(row.effect_config),
      cooldownMs: Number(row.cooldown_ms),
      enabled: Boolean(row.enabled),
    }));
  }

  function upsertEffect(effect: Effect): void {
    getDb().prepare(
      `INSERT INTO effects (id, name, type, trigger_type, trigger_config, effect_config, cooldown_ms, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, trigger_type=excluded.trigger_type,
         trigger_config=excluded.trigger_config, effect_config=excluded.effect_config, cooldown_ms=excluded.cooldown_ms, enabled=excluded.enabled`,
    ).run(
      effect.id,
      effect.name,
      effect.type,
      effect.triggerType,
      JSON.stringify(effect.triggerConfig),
      JSON.stringify(effect.effectConfig),
      effect.cooldownMs,
      effect.enabled ? 1 : 0,
    );
  }

  function deleteEffect(id: string): void {
    getDb().prepare("DELETE FROM effects WHERE id = ?").run(id);
  }

  return {
    getEffects,
    upsertEffect,
    deleteEffect,
  };
}
