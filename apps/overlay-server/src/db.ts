import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AlertRule,
  Effect,
  Theme,
  WebhookHook,
  WidgetConfig,
  StreamEvent,
  AutomationRule,
  AlertProject,
} from "@btv/shared";
import { AlertProjectSchema, AutomationRuleSchema } from "@btv/shared";
import { decrypt, encrypt } from "./crypto.js";

const DB_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/btv.db",
);

let db: DatabaseSync;

export function initDb(): DatabaseSync {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      html TEXT NOT NULL,
      css TEXT NOT NULL,
      js TEXT,
      duration_ms INTEGER DEFAULT 5000
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      theme_id TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      cooldown_ms INTEGER DEFAULT 0,
      min_amount INTEGER,
      sound_asset TEXT,
      priority INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS widgets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      secret TEXT,
      action TEXT NOT NULL,
      action_config TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS effects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT NOT NULL DEFAULT '{}',
      effect_config TEXT NOT NULL DEFAULT '{}',
      cooldown_ms INTEGER DEFAULT 5000,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alert_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      timeline_json TEXT NOT NULL DEFAULT '{}',
      canvas_json TEXT NOT NULL DEFAULT '{}',
      layers_json TEXT NOT NULL DEFAULT '[]',
      variations_json TEXT NOT NULL DEFAULT '[]',
      chaos_json TEXT NOT NULL DEFAULT '{}',
      safe_mode INTEGER NOT NULL DEFAULT 0,
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS macros (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      steps_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS source_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scene_name TEXT NOT NULL,
      sources_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      interval_ms INTEGER NOT NULL,
      action TEXT NOT NULL,
      action_config TEXT NOT NULL DEFAULT '{}',
      run_on_start INTEGER DEFAULT 0,
      last_run_at TEXT,
      next_run_at TEXT,
      run_count INTEGER DEFAULT 0,
      last_status TEXT,
      last_message TEXT
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      trigger_json TEXT NOT NULL,
      conditions_json TEXT NOT NULL DEFAULT '[]',
      actions_json TEXT NOT NULL DEFAULT '[]',
      cooldown_ms INTEGER DEFAULT 0,
      last_run_at TEXT,
      last_status TEXT,
      last_message TEXT,
      run_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      event_id TEXT,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(rule_id) REFERENCES automation_rules(id)
    );

    CREATE TABLE IF NOT EXISTS automation_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      current_count INTEGER DEFAULT 0,
      target_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_log (
      id TEXT PRIMARY KEY,
      hook_id TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stream_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      user_login TEXT,
      user_display_name TEXT,
      amount INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES stream_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS obs_scene_spans (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      scene_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY(session_id) REFERENCES stream_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_session_events_session_created
      ON session_events(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_scene_spans_session_started
      ON obs_scene_spans(session_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_automation_runs_created
      ON automation_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_system_logs_created
      ON system_logs(created_at);
  `);

  migrateSchemaColumns();
  seedDefaults();
  seedAlertProjects();
  return db;
}

function migrateSchemaColumns(): void {
  const cols = db.prepare("PRAGMA table_info(themes)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "layout_json")) {
    db.exec("ALTER TABLE themes ADD COLUMN layout_json TEXT");
  }
  if (!cols.some((c) => c.name === "visual_json")) {
    db.exec("ALTER TABLE themes ADD COLUMN visual_json TEXT");
  }
  const alertCols = db.prepare("PRAGMA table_info(alert_projects)").all() as Array<{ name: string }>;
  if (!alertCols.some((c) => c.name === "timeline_json")) {
    db.exec("ALTER TABLE alert_projects ADD COLUMN timeline_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!alertCols.some((c) => c.name === "variations_json")) {
    db.exec("ALTER TABLE alert_projects ADD COLUMN variations_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!alertCols.some((c) => c.name === "chaos_json")) {
    db.exec("ALTER TABLE alert_projects ADD COLUMN chaos_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!alertCols.some((c) => c.name === "safe_mode")) {
    db.exec("ALTER TABLE alert_projects ADD COLUMN safe_mode INTEGER NOT NULL DEFAULT 0");
  }
}

function seedDefaults(): void {
  const themeCount = db.prepare("SELECT COUNT(*) as c FROM themes").get() as { c: number };
  if (themeCount.c === 0) {
    db.prepare(
      `INSERT INTO themes (id, name, html, css, js, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      "default",
      "Default Alert",
      `<div class="alert-card">
        <div class="alert-glow"></div>
        <h1 class="alert-title"></h1>
        <p class="alert-subtitle"></p>
      </div>`,
      `.alert-card {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        padding: 24px 48px; background: linear-gradient(135deg, #6441a5, #9147ff);
        border-radius: 16px; color: white; text-align: center;
        animation: slideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 8px 32px rgba(145, 71, 255, 0.5);
        min-width: 320px;
      }
      .alert-title { font-size: 28px; margin: 0; font-weight: 700; }
      .alert-subtitle { font-size: 16px; margin: 8px 0 0; opacity: 0.9; }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-50%) translateY(40px) scale(0.9); }
        to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }`,
      `function onShow(event, root, onHide) {
        const titles = { follow: 'New Follower!', sub: 'New Subscriber!', cheer: 'Cheer!', raid: 'Raid!', channel_points: 'Redemption!', gift_sub: 'Gift Subs!' };
        root.querySelector('.alert-title').textContent = event.user?.displayName || 'Someone';
        root.querySelector('.alert-subtitle').textContent = titles[event.type] || event.type;
      }`,
      5000,
    );
  }

  const rulesCount = db.prepare("SELECT COUNT(*) as c FROM alert_rules").get() as { c: number };
  if (rulesCount.c === 0) {
    const types = ["follow", "sub", "cheer", "raid", "gift_sub", "channel_points"];
    for (const t of types) {
      db.prepare(
        `INSERT INTO alert_rules (id, event_type, theme_id, enabled, cooldown_ms, priority)
         VALUES (?, ?, 'default', 1, 3000, 0)`,
      ).run(`${t}-default`, t);
    }
  }

  const widgetsCount = db.prepare("SELECT COUNT(*) as c FROM widgets").get() as { c: number };
  if (widgetsCount.c === 0) {
    const widgets: Array<[string, string, string]> = [
      ["chat", "chat", JSON.stringify({ maxMessages: 20, fadeMs: 8000 })],
      ["goal-follow", "goal", JSON.stringify({ goalId: "follow-goal", label: "Follower Goal" })],
      ["ticker", "ticker", JSON.stringify({ maxEvents: 15 })],
      ["event-list", "eventList", JSON.stringify({ maxEvents: 8, showAmount: true, showMessage: true })],
      ["now-playing", "nowPlaying", JSON.stringify({})],
    ];
    for (const [id, type, config] of widgets) {
      db.prepare(
        `INSERT INTO widgets (id, type, enabled, config) VALUES (?, ?, 1, ?)`,
      ).run(id, type, config);
    }
  }
  db.prepare(
    `INSERT OR IGNORE INTO widgets (id, type, enabled, config) VALUES (?, ?, 1, ?)`,
  ).run("event-list", "eventList", JSON.stringify({ maxEvents: 8, showAmount: true, showMessage: true }));

  const goalsCount = db.prepare("SELECT COUNT(*) as c FROM goals").get() as { c: number };
  if (goalsCount.c === 0) {
    db.prepare(
      `INSERT INTO goals (id, label, type, current_count, target_count) VALUES (?, ?, ?, 0, ?)`,
    ).run("follow-goal", "Follower Goal", "follow", 100);
  }

  const effectsCount = db.prepare("SELECT COUNT(*) as c FROM effects").get() as { c: number };
  if (effectsCount.c === 0) {
    db.prepare(
      `INSERT INTO effects (id, name, type, trigger_type, trigger_config, effect_config, cooldown_ms, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      "jumpscare",
      "Jumpscare Flash",
      "visual",
      "chat_command",
      JSON.stringify({ command: "!jumpscare", modOnly: false }),
      JSON.stringify({ style: "flash", durationMs: 600 }),
      15000,
    );
    db.prepare(
      `INSERT INTO effects (id, name, type, trigger_type, trigger_config, effect_config, cooldown_ms, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      "channel-points-flash",
      "Channel Points Flash",
      "visual",
      "channel_points",
      JSON.stringify({ rewardTitle: "Flash Screen" }),
      JSON.stringify({ style: "shake", durationMs: 800 }),
      10000,
    );
  }

  const macrosCount = db.prepare("SELECT COUNT(*) as c FROM macros").get() as { c: number };
  if (macrosCount.c === 0) {
    db.prepare(
      `INSERT INTO macros (id, name, enabled, steps_json) VALUES (?, ?, 1, ?)`,
    ).run(
      "panic-clear",
      "Panic: Clear Alerts",
      JSON.stringify([{ type: "clear_alerts" }]),
    );
    db.prepare(
      `INSERT INTO macros (id, name, enabled, steps_json) VALUES (?, ?, 1, ?)`,
    ).run(
      "start-session",
      "Start Analytics Session",
      JSON.stringify([{ type: "session_start" }]),
    );
  }
}

function rowToAlertProject(row: Record<string, unknown>): AlertProject {
  return AlertProjectSchema.parse({
    id: String(row.id),
    name: String(row.name),
    eventType: String(row.event_type),
    durationMs: Number(row.duration_ms ?? 5000),
    timeline: parseJsonValue(row.timeline_json, undefined),
    canvas: parseJsonValue(row.canvas_json, {}),
    layers: parseJsonValue(row.layers_json, []),
    variations: parseJsonValue(row.variations_json, []),
    chaos: parseJsonValue(row.chaos_json, {}),
    safeMode: Number(row.safe_mode ?? 0) === 1,
    tags: parseJsonValue(row.tags_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

function defaultAlertProjectFromTheme(theme: Theme): AlertProject {
  const now = new Date().toISOString();
  return AlertProjectSchema.parse({
    id: `alert-${theme.id}`,
    name: `${theme.name} Visual`,
    eventType: "follow",
    durationMs: theme.durationMs,
    timeline: {
      durationMs: theme.durationMs,
      fps: 60,
      snapMs: 100,
      zoom: 1,
    },
    chaos: {
      enabled: false,
      intensity: 0.35,
      modifiers: ["shake", "flash", "hue_shift", "scale_punch"],
      legendaryBoost: 0,
    },
    safeMode: false,
    canvas: {
      width: 1920,
      height: 1080,
      background: "transparent",
      backgroundColor: "transparent",
    },
    layers: [
      {
        id: "card",
        type: "shape",
        name: "Alert card",
        x: 660,
        y: 400,
        width: 600,
        height: 220,
        fill: "rgba(91, 140, 255, 0.88)",
        radius: 22,
        startMs: 0,
        endMs: theme.durationMs,
      },
      {
        id: "title",
        type: "text",
        name: "Title",
        text: "{user}",
        x: 700,
        y: 455,
        width: 520,
        height: 72,
        fontSize: 58,
        fontWeight: 900,
        color: "#ffffff",
        startMs: 0,
        endMs: theme.durationMs,
      },
      {
        id: "subtitle",
        type: "text",
        name: "Subtitle",
        text: "Thanks for the {event}!",
        x: 740,
        y: 535,
        width: 440,
        height: 48,
        fontSize: 30,
        fontWeight: 700,
        color: "#dbe6ff",
        startMs: 250,
        endMs: theme.durationMs,
      },
    ],
    tags: ["migration", "starter"],
    createdAt: now,
    updatedAt: now,
  });
}

function seedAlertProjects(): void {
  const count = db.prepare("SELECT COUNT(*) as c FROM alert_projects").get() as { c: number };
  if (count.c > 0) return;
  const defaultTheme = getTheme("default");
  if (defaultTheme) upsertAlertProject(defaultAlertProjectFromTheme(defaultTheme));
}

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function deleteSetting(key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function getSettingsSnapshot(): Array<{ key: string; value: string }> {
  const secretPattern = /(secret|password|token|oauth_state)/i;
  return (db.prepare("SELECT key, value FROM settings ORDER BY key").all() as Array<{ key: string; value: string }>).map((row) => ({
    key: row.key,
    value: secretPattern.test(row.key) ? "[redacted]" : row.value,
  }));
}

export function getEncryptedSetting(key: string): string | null {
  const raw = getSetting(key);
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch {
    return null;
  }
}

export function setEncryptedSetting(key: string, value: string): void {
  setSetting(key, encrypt(value));
}

export function getThemes(): Theme[] {
  return (db.prepare("SELECT * FROM themes").all() as Array<Record<string, unknown>>).map(
    rowToTheme,
  );
}

export function getTheme(id: string): Theme | null {
  const row = db.prepare("SELECT * FROM themes WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToTheme(row) : null;
}

export function upsertTheme(theme: Theme): void {
  db.prepare(
    `INSERT INTO themes (id, name, html, css, js, duration_ms, layout_json, visual_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, html=excluded.html, css=excluded.css, js=excluded.js, duration_ms=excluded.duration_ms, layout_json=excluded.layout_json, visual_json=excluded.visual_json`,
  ).run(
    theme.id,
    theme.name,
    theme.html,
    theme.css,
    theme.js ?? null,
    theme.durationMs,
    theme.layout ? JSON.stringify(theme.layout) : null,
    theme.visual ? JSON.stringify(theme.visual) : null,
  );
}

export function deleteTheme(id: string): void {
  db.prepare("DELETE FROM themes WHERE id = ?").run(id);
}

export function getAlertProjects(): AlertProject[] {
  return (db.prepare("SELECT * FROM alert_projects ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>).map(
    rowToAlertProject,
  );
}

export function getAlertProject(id: string): AlertProject | null {
  const row = db.prepare("SELECT * FROM alert_projects WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAlertProject(row) : null;
}

export function upsertAlertProject(project: AlertProject): void {
  const parsed = AlertProjectSchema.parse(project);
  db.prepare(
    `INSERT INTO alert_projects
      (id, name, event_type, duration_ms, timeline_json, canvas_json, layers_json, variations_json, chaos_json, safe_mode, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      event_type=excluded.event_type,
      duration_ms=excluded.duration_ms,
      timeline_json=excluded.timeline_json,
      canvas_json=excluded.canvas_json,
      layers_json=excluded.layers_json,
      variations_json=excluded.variations_json,
      chaos_json=excluded.chaos_json,
      safe_mode=excluded.safe_mode,
      tags_json=excluded.tags_json,
      updated_at=excluded.updated_at`,
  ).run(
    parsed.id,
    parsed.name,
    parsed.eventType,
    parsed.durationMs,
    JSON.stringify(parsed.timeline ?? {}),
    JSON.stringify(parsed.canvas),
    JSON.stringify(parsed.layers),
    JSON.stringify(parsed.variations),
    JSON.stringify(parsed.chaos),
    parsed.safeMode ? 1 : 0,
    JSON.stringify(parsed.tags),
    parsed.createdAt,
    parsed.updatedAt,
  );
}

export function deleteAlertProject(id: string): void {
  db.prepare("DELETE FROM alert_projects WHERE id = ?").run(id);
}

function rowToTheme(row: Record<string, unknown>): Theme {
  let layout: Theme["layout"];
  if (row.layout_json) {
    try {
      layout = JSON.parse(String(row.layout_json)) as Theme["layout"];
    } catch {
      layout = undefined;
    }
  }
  let visual: Theme["visual"];
  if (row.visual_json) {
    try {
      visual = JSON.parse(String(row.visual_json)) as Theme["visual"];
    } catch {
      visual = undefined;
    }
  }
  return {
    id: String(row.id),
    name: String(row.name),
    html: String(row.html),
    css: String(row.css),
    js: row.js ? String(row.js) : undefined,
    durationMs: Number(row.duration_ms ?? 5000),
    layout,
    visual,
  };
}

export function getAlertRules(): AlertRule[] {
  return (db.prepare("SELECT * FROM alert_rules ORDER BY priority DESC").all() as Array<
    Record<string, unknown>
  >).map((r) => ({
    id: String(r.id),
    eventType: r.event_type as AlertRule["eventType"],
    themeId: String(r.theme_id),
    enabled: Boolean(r.enabled),
    cooldownMs: Number(r.cooldown_ms),
    minAmount: r.min_amount != null ? Number(r.min_amount) : undefined,
    soundAsset: r.sound_asset ? String(r.sound_asset) : undefined,
    priority: Number(r.priority),
  }));
}

export function upsertAlertRule(rule: AlertRule): void {
  db.prepare(
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

export function getWidgets(): WidgetConfig[] {
  return (db.prepare("SELECT * FROM widgets").all() as Array<Record<string, unknown>>).map(
    (r) => ({
      id: String(r.id),
      type: r.type as WidgetConfig["type"],
      enabled: Boolean(r.enabled),
      config: JSON.parse(String(r.config)),
    }),
  );
}

export function upsertWidget(w: WidgetConfig): void {
  db.prepare(
    `INSERT INTO widgets (id, type, enabled, config) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET type=excluded.type, enabled=excluded.enabled, config=excluded.config`,
  ).run(w.id, w.type, w.enabled ? 1 : 0, JSON.stringify(w.config));
}

export function getWebhooks(): WebhookHook[] {
  return (db.prepare("SELECT * FROM webhooks").all() as Array<Record<string, unknown>>).map(
    (r) => ({
      id: String(r.id),
      name: String(r.name),
      secret: readSecret(r.secret),
      action: r.action as WebhookHook["action"],
      actionConfig: JSON.parse(String(r.action_config)),
    }),
  );
}

export function upsertWebhook(h: WebhookHook): void {
  db.prepare(
    `INSERT INTO webhooks (id, name, secret, action, action_config) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, secret=excluded.secret, action=excluded.action, action_config=excluded.action_config`,
  ).run(h.id, h.name, h.secret ? encrypt(h.secret) : null, h.action, JSON.stringify(h.actionConfig));
}

export function deleteWebhook(id: string): void {
  db.prepare("DELETE FROM webhooks WHERE id = ?").run(id);
}

export function getWebhook(id: string): WebhookHook | null {
  const r = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    secret: readSecret(r.secret),
    action: r.action as WebhookHook["action"],
    actionConfig: JSON.parse(String(r.action_config)),
  };
}

function readSecret(value: unknown): string | undefined {
  if (!value) return undefined;
  const raw = String(value);
  try {
    return decrypt(raw);
  } catch {
    return raw;
  }
}

export function getEffects(): Effect[] {
  return (db.prepare("SELECT * FROM effects").all() as Array<Record<string, unknown>>).map(
    (r) => ({
      id: String(r.id),
      name: String(r.name),
      type: r.type as Effect["type"],
      triggerType: r.trigger_type as Effect["triggerType"],
      triggerConfig: JSON.parse(String(r.trigger_config)),
      effectConfig: JSON.parse(String(r.effect_config)),
      cooldownMs: Number(r.cooldown_ms),
      enabled: Boolean(r.enabled),
    }),
  );
}

export function upsertEffect(e: Effect): void {
  db.prepare(
    `INSERT INTO effects (id, name, type, trigger_type, trigger_config, effect_config, cooldown_ms, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, trigger_type=excluded.trigger_type,
       trigger_config=excluded.trigger_config, effect_config=excluded.effect_config, cooldown_ms=excluded.cooldown_ms, enabled=excluded.enabled`,
  ).run(
    e.id,
    e.name,
    e.type,
    e.triggerType,
    JSON.stringify(e.triggerConfig),
    JSON.stringify(e.effectConfig),
    e.cooldownMs,
    e.enabled ? 1 : 0,
  );
}

export function deleteEffect(id: string): void {
  db.prepare("DELETE FROM effects WHERE id = ?").run(id);
}

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

function parseMacroSteps(raw: unknown): MacroStep[] {
  if (!raw) return [];
  try {
    const steps = JSON.parse(String(raw));
    return Array.isArray(steps) ? (steps as MacroStep[]) : [];
  } catch {
    return [];
  }
}

export function getMacros(): MacroConfig[] {
  return (db.prepare("SELECT * FROM macros ORDER BY name").all() as Array<Record<string, unknown>>).map(
    (r) => ({
      id: String(r.id),
      name: String(r.name),
      enabled: Boolean(r.enabled),
      steps: parseMacroSteps(r.steps_json),
    }),
  );
}

export function getMacro(id: string): MacroConfig | null {
  const r = db.prepare("SELECT * FROM macros WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    name: String(r.name),
    enabled: Boolean(r.enabled),
    steps: parseMacroSteps(r.steps_json),
  };
}

export function upsertMacro(macro: MacroConfig): void {
  db.prepare(
    `INSERT INTO macros (id, name, enabled, steps_json) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled, steps_json=excluded.steps_json`,
  ).run(macro.id, macro.name, macro.enabled ? 1 : 0, JSON.stringify(macro.steps));
}

export function deleteMacro(id: string): void {
  db.prepare("DELETE FROM macros WHERE id = ?").run(id);
}

export interface SourceGroupSource {
  sourceName: string;
  transform?: Record<string, unknown>;
}

export interface SourceGroup {
  id: string;
  name: string;
  sceneName: string;
  sources: SourceGroupSource[];
  updatedAt: string;
}

function parseSourceGroupSources(raw: unknown): SourceGroupSource[] {
  if (!raw) return [];
  try {
    const sources = JSON.parse(String(raw));
    return Array.isArray(sources) ? (sources as SourceGroupSource[]) : [];
  } catch {
    return [];
  }
}

function rowToSourceGroup(row: Record<string, unknown>): SourceGroup {
  return {
    id: String(row.id),
    name: String(row.name),
    sceneName: String(row.scene_name),
    sources: parseSourceGroupSources(row.sources_json),
    updatedAt: String(row.updated_at),
  };
}

export function getSourceGroups(): SourceGroup[] {
  return (db.prepare("SELECT * FROM source_groups ORDER BY name").all() as Array<Record<string, unknown>>).map(
    rowToSourceGroup,
  );
}

export function getSourceGroup(id: string): SourceGroup | null {
  const row = db.prepare("SELECT * FROM source_groups WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSourceGroup(row) : null;
}

export function upsertSourceGroup(group: SourceGroup): void {
  db.prepare(
    `INSERT INTO source_groups (id, name, scene_name, sources_json, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, scene_name=excluded.scene_name,
       sources_json=excluded.sources_json, updated_at=excluded.updated_at`,
  ).run(
    group.id,
    group.name,
    group.sceneName,
    JSON.stringify(group.sources),
    group.updatedAt || new Date().toISOString(),
  );
}

export function deleteSourceGroup(id: string): void {
  db.prepare("DELETE FROM source_groups WHERE id = ?").run(id);
}

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

function parseRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(String(raw));
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function rowToAutomation(row: Record<string, unknown>): AutomationConfig {
  return {
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
  };
}

export function getAutomations(): AutomationConfig[] {
  return (db.prepare("SELECT * FROM automations ORDER BY name").all() as Array<Record<string, unknown>>).map(
    rowToAutomation,
  );
}

export function getAutomation(id: string): AutomationConfig | null {
  const row = db.prepare("SELECT * FROM automations WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAutomation(row) : null;
}

export function upsertAutomation(automation: AutomationConfig): void {
  db.prepare(
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

export function deleteAutomation(id: string): void {
  db.prepare("DELETE FROM automations WHERE id = ?").run(id);
}

function parseJsonValue<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function rowToAutomationRule(row: Record<string, unknown>): AutomationRule {
  return AutomationRuleSchema.parse({
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
}

export function getAutomationRules(): AutomationRule[] {
  return (db.prepare("SELECT * FROM automation_rules ORDER BY name").all() as Array<Record<string, unknown>>).map(
    rowToAutomationRule,
  );
}

export function getAutomationRule(id: string): AutomationRule | null {
  const row = db.prepare("SELECT * FROM automation_rules WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAutomationRule(row) : null;
}

export function upsertAutomationRule(rule: AutomationRule): void {
  const parsed = AutomationRuleSchema.parse(rule);
  db.prepare(
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

export function deleteAutomationRule(id: string): void {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM automation_runs WHERE rule_id = ?").run(id);
    db.prepare("DELETE FROM automation_rules WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function recordAutomationRuleRun(
  ruleId: string,
  eventId: string | null,
  status: "ok" | "failed" | "skipped",
  message: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO automation_runs (id, rule_id, event_id, status, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), ruleId, eventId, status, message, now);
  db.prepare(
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
}

export function getAutomationRuns(limit = 50) {
  return db
    .prepare(
      `SELECT id, rule_id, event_id, status, message, created_at
       FROM automation_runs
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    rule_id: string;
    event_id: string | null;
    status: string;
    message: string;
    created_at: string;
  }>;
}

export function getAutomationStateValue(key: string): unknown {
  const row = db.prepare("SELECT value_json FROM automation_state WHERE key = ?").get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return undefined;
  return parseJsonValue(row.value_json, undefined);
}

export function getAutomationStateSnapshot(): Record<string, unknown> {
  const rows = db.prepare("SELECT key, value_json FROM automation_state").all() as Array<{ key: string; value_json: string }>;
  return Object.fromEntries(rows.map((row) => [row.key, parseJsonValue(row.value_json, undefined)]));
}

export function setAutomationStateValue(key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO automation_state (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
  ).run(key, JSON.stringify(value), new Date().toISOString());
}

export function deleteAutomationStateValue(key: string): void {
  db.prepare("DELETE FROM automation_state WHERE key = ?").run(key);
}

export function updateWidgetText(widgetId: string, text: string): boolean {
  const row = db.prepare("SELECT config FROM widgets WHERE id = ?").get(widgetId) as
    | { config: string }
    | undefined;
  if (!row) return false;
  const config = { ...parseRecord(row.config), text };
  db.prepare("UPDATE widgets SET config = ? WHERE id = ?").run(JSON.stringify(config), widgetId);
  return true;
}

export function getGoal(id: string) {
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id) as
    | {
        id: string;
        label: string;
        type: string;
        current_count: number;
        target_count: number;
      }
    | undefined;
}

export function getGoals() {
  return db.prepare("SELECT * FROM goals").all() as Array<{
    id: string;
    label: string;
    type: string;
    current_count: number;
    target_count: number;
  }>;
}

export function updateGoal(
  id: string,
  current: number,
  target?: number,
  label?: string,
): void {
  if (target != null && label != null) {
    db.prepare(
      `UPDATE goals SET current_count = ?, target_count = ?, label = ? WHERE id = ?`,
    ).run(current, target, label, id);
  } else if (target != null) {
    db.prepare(
      `UPDATE goals SET current_count = ?, target_count = ? WHERE id = ?`,
    ).run(current, target, id);
  } else if (label != null) {
    db.prepare(
      `UPDATE goals SET current_count = ?, label = ? WHERE id = ?`,
    ).run(current, label, id);
  } else {
    db.prepare(`UPDATE goals SET current_count = ? WHERE id = ?`).run(current, id);
  }
}

export function logActivity(eventJson: string): void {
  db.prepare(`INSERT INTO activity_log (id, event_json, created_at) VALUES (?, ?, ?)`).run(
    crypto.randomUUID(),
    eventJson,
    new Date().toISOString(),
  );
  db.prepare(
    `DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC LIMIT 200)`,
  ).run();
}

export function getActivity(limit = 50) {
  return db
    .prepare(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Array<{ id: string; event_json: string; created_at: string }>;
}

export function getActivityById(id: string) {
  return db
    .prepare(`SELECT * FROM activity_log WHERE id = ?`)
    .get(id) as { id: string; event_json: string; created_at: string } | undefined;
}

export type SystemLogLevel = "info" | "warn" | "error";

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  source: string;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export function logSystem(
  source: string,
  level: SystemLogLevel,
  message: string,
  details: Record<string, unknown> = {},
): void {
  db.prepare(
    `INSERT INTO system_logs (id, level, source, message, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    level,
    source,
    message,
    JSON.stringify(details),
    new Date().toISOString(),
  );
  db.prepare(
    `DELETE FROM system_logs WHERE id NOT IN (SELECT id FROM system_logs ORDER BY created_at DESC LIMIT 500)`,
  ).run();
}

export function getSystemLogs(limit = 100): SystemLogEntry[] {
  return (db
    .prepare(
      `SELECT id, level, source, message, details_json, created_at
       FROM system_logs
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    level: SystemLogLevel;
    source: string;
    message: string;
    details_json: string;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    level: row.level,
    source: row.source,
    message: row.message,
    details: parseRecord(row.details_json),
    createdAt: row.created_at,
  }));
}

export interface StreamSessionRow {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
}

export interface SessionEventSummary {
  eventType: string;
  count: number;
  amount: number;
}

export interface SceneSpanSummary {
  sceneName: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
}

export interface SessionEventRow {
  id: string;
  event_type: string;
  source: string;
  user_login: string | null;
  user_display_name: string | null;
  amount: number | null;
  created_at: string;
}

export interface SceneSpanRow {
  id: string;
  scene_name: string;
  started_at: string;
  ended_at: string | null;
}

export interface StreamSessionSummary {
  session: StreamSessionRow | null;
  durationMs: number;
  totals: {
    events: number;
    follows: number;
    subs: number;
    cheers: number;
    raids: number;
    channelPoints: number;
    chatMessages: number;
  };
  eventsByType: SessionEventSummary[];
  sceneSpans: SceneSpanSummary[];
}

export function startStreamSession(title?: string): StreamSessionRow {
  const active = getCurrentStreamSession();
  if (active) return active;

  const now = new Date().toISOString();
  const session = {
    id: crypto.randomUUID(),
    title: title?.trim() || `Stream ${new Date().toLocaleDateString()}`,
    started_at: now,
    ended_at: null,
  };
  db.prepare(
    `INSERT INTO stream_sessions (id, title, started_at, ended_at) VALUES (?, ?, ?, NULL)`,
  ).run(session.id, session.title, session.started_at);
  return session;
}

export function stopCurrentStreamSession(): StreamSessionRow | null {
  const active = getCurrentStreamSession();
  if (!active) return null;
  const endedAt = new Date().toISOString();
  db.prepare("UPDATE stream_sessions SET ended_at = ? WHERE id = ?").run(endedAt, active.id);
  db.prepare(
    `UPDATE obs_scene_spans SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL`,
  ).run(endedAt, active.id);
  return { ...active, ended_at: endedAt };
}

export function getCurrentStreamSession(): StreamSessionRow | null {
  const row = db
    .prepare(
      `SELECT id, title, started_at, ended_at
       FROM stream_sessions
       WHERE ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
    )
    .get() as StreamSessionRow | undefined;
  return row ?? null;
}

export function getRecentStreamSessions(limit = 10): StreamSessionRow[] {
  return db
    .prepare(
      `SELECT id, title, started_at, ended_at
       FROM stream_sessions
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .all(limit) as unknown as StreamSessionRow[];
}

export function getSessionEvents(sessionId: string): SessionEventRow[] {
  return db
    .prepare(
      `SELECT id, event_type, source, user_login, user_display_name, amount, created_at
       FROM session_events
       WHERE session_id = ?
       ORDER BY created_at DESC`,
    )
    .all(sessionId) as unknown as SessionEventRow[];
}

export function getSessionSceneSpans(sessionId: string): SceneSpanRow[] {
  return db
    .prepare(
      `SELECT id, scene_name, started_at, ended_at
       FROM obs_scene_spans
       WHERE session_id = ?
       ORDER BY started_at DESC`,
    )
    .all(sessionId) as unknown as SceneSpanRow[];
}

export function logSessionEvent(event: StreamEvent): void {
  const session = getCurrentStreamSession();
  if (!session) return;
  db.prepare(
    `INSERT INTO session_events
      (id, session_id, event_type, source, user_login, user_display_name, amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    session.id,
    event.type,
    event.source,
    event.user?.login ?? null,
    event.user?.displayName ?? null,
    event.amount ?? null,
    event.at,
  );
}

export function logObsSceneSpan(sceneName: string): void {
  const session = getCurrentStreamSession();
  if (!session) return;
  const now = new Date().toISOString();
  const active = db
    .prepare(
      `SELECT scene_name FROM obs_scene_spans
       WHERE session_id = ? AND ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
    )
    .get(session.id) as { scene_name: string } | undefined;

  if (active?.scene_name === sceneName) return;

  db.prepare(
    `UPDATE obs_scene_spans SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL`,
  ).run(now, session.id);
  db.prepare(
    `INSERT INTO obs_scene_spans (id, session_id, scene_name, started_at, ended_at)
     VALUES (?, ?, ?, ?, NULL)`,
  ).run(crypto.randomUUID(), session.id, sceneName, now);
}

export function getStreamSessionSummary(sessionId?: string): StreamSessionSummary {
  const session = sessionId
    ? ((db
        .prepare("SELECT id, title, started_at, ended_at FROM stream_sessions WHERE id = ?")
        .get(sessionId) as StreamSessionRow | undefined) ?? null)
    : getCurrentStreamSession();

  if (!session) {
    return {
      session: null,
      durationMs: 0,
      totals: {
        events: 0,
        follows: 0,
        subs: 0,
        cheers: 0,
        raids: 0,
        channelPoints: 0,
        chatMessages: 0,
      },
      eventsByType: [],
      sceneSpans: [],
    };
  }

  const rows = db
    .prepare(
      `SELECT event_type, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
       FROM session_events
       WHERE session_id = ?
       GROUP BY event_type
       ORDER BY count DESC`,
    )
    .all(session.id) as Array<{ event_type: string; count: number; amount: number }>;

  const byType = new Map(rows.map((r) => [r.event_type, r]));
  const eventsByType = rows.map((r) => ({
    eventType: r.event_type,
    count: Number(r.count),
    amount: Number(r.amount),
  }));

  const sceneRows = db
    .prepare(
      `SELECT scene_name, started_at, ended_at
       FROM obs_scene_spans
       WHERE session_id = ?
       ORDER BY started_at DESC
       LIMIT 25`,
    )
    .all(session.id) as Array<{ scene_name: string; started_at: string; ended_at: string | null }>;

  return {
    session,
    durationMs: new Date(session.ended_at ?? new Date().toISOString()).getTime() - new Date(session.started_at).getTime(),
    totals: {
      events: eventsByType.reduce((sum, row) => sum + row.count, 0),
      follows: Number(byType.get("follow")?.count ?? 0),
      subs: Number(byType.get("sub")?.count ?? 0) + Number(byType.get("resub")?.count ?? 0) + Number(byType.get("gift_sub")?.count ?? 0),
      cheers: Number(byType.get("cheer")?.amount ?? 0),
      raids: Number(byType.get("raid")?.count ?? 0),
      channelPoints: Number(byType.get("channel_points")?.count ?? 0),
      chatMessages: Number(byType.get("chat")?.count ?? 0),
    },
    eventsByType,
    sceneSpans: sceneRows.map((row) => ({
      sceneName: row.scene_name,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMs: new Date(row.ended_at ?? new Date().toISOString()).getTime() - new Date(row.started_at).getTime(),
    })),
  };
}

export function logWebhookRequest(hookId: string, body: string): void {
  db.prepare(`INSERT INTO webhook_log (id, hook_id, body, created_at) VALUES (?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    hookId,
    body,
    new Date().toISOString(),
  );
}

export function getWebhookLog(limit = 50) {
  return db
    .prepare(`SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Array<{ id: string; hook_id: string; body: string; created_at: string }>;
}
