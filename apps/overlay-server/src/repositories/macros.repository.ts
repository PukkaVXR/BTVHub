import type { DatabaseSync } from "node:sqlite";

export type MacroStep =
  | { type: "wait"; durationMs: number }
  | { type: "obs_scene"; sceneName: string }
  | { type: "obs_source_visibility"; sceneName: string; sourceName: string; visible: boolean }
  | {
      type: "obs_source_motion";
      sceneName: string;
      sourceName: string;
      mode?: "set" | "dvd" | "path";
      durationMs?: number;
      fps?: number;
      visible?: boolean;
      restore?: boolean;
      boundsWidth?: number;
      boundsHeight?: number;
      speedX?: number;
      speedY?: number;
      x?: number;
      y?: number;
      scale?: number;
      width?: number;
      height?: number;
      path?: Array<{ x: number; y: number; scale?: number }>;
    }
  | { type: "obs_text"; inputName: string; text: string }
  | { type: "obs_stream_start" }
  | { type: "obs_stream_stop" }
  | { type: "obs_record_start" }
  | { type: "obs_record_stop" }
  | { type: "obs_record_pause" }
  | { type: "obs_record_resume" }
  | { type: "obs_replay_buffer_start" }
  | { type: "obs_replay_buffer_stop" }
  | { type: "obs_replay_buffer_save" }
  | { type: "obs_filter"; sourceName: string; filterName: string; enabled: boolean }
  | { type: "twitch_chat"; message: string }
  | { type: "run_command"; command: string; args?: string[]; cwd?: string; timeoutMs?: number; successChatMessage?: string }
  | { type: "effect"; effectId: string }
  | { type: "clear_alerts" }
  | { type: "session_start"; title?: string }
  | { type: "session_stop" };

export interface MacroConfig {
  id: string;
  name: string;
  enabled: boolean;
  steps: MacroStep[];
}

interface MacrosRepositoryDeps {
  getDb: () => DatabaseSync;
}

function parseMacroSteps(raw: unknown): MacroStep[] {
  if (!raw) return [];
  try {
    const steps = JSON.parse(String(raw));
    return Array.isArray(steps) ? (steps as MacroStep[]) : [];
  } catch {
    return [];
  }
}

function rowToMacro(row: Record<string, unknown>): MacroConfig {
  return {
    id: String(row.id),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    steps: parseMacroSteps(row.steps_json),
  };
}

export function createMacrosRepository({ getDb }: MacrosRepositoryDeps) {
  function getMacros(): MacroConfig[] {
    return (getDb().prepare("SELECT * FROM macros ORDER BY name").all() as Array<Record<string, unknown>>).map(
      rowToMacro,
    );
  }

  function getMacro(id: string): MacroConfig | null {
    const row = getDb().prepare("SELECT * FROM macros WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToMacro(row) : null;
  }

  function upsertMacro(macro: MacroConfig): void {
    getDb().prepare(
      `INSERT INTO macros (id, name, enabled, steps_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled, steps_json=excluded.steps_json`,
    ).run(macro.id, macro.name, macro.enabled ? 1 : 0, JSON.stringify(macro.steps));
  }

  function deleteMacro(id: string): void {
    getDb().prepare("DELETE FROM macros WHERE id = ?").run(id);
  }

  return {
    getMacros,
    getMacro,
    upsertMacro,
    deleteMacro,
  };
}
