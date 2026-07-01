import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decrypt, encrypt } from "./crypto.js";
import { createAlertProjectsRepository } from "./repositories/alert-projects.repository.js";
import { createAlertRulesRepository } from "./repositories/alert-rules.repository.js";
import { createAutomationRepository } from "./repositories/automation.repository.js";
import { createChatRepository } from "./repositories/chat.repository.js";
import { createEffectsRepository } from "./repositories/effects.repository.js";
import { createGiveawaysRepository } from "./repositories/giveaways.repository.js";
import { createGoalsRepository } from "./repositories/goals.repository.js";
import { createSettingsRepository } from "./repositories/settings.repository.js";
import { createLogsRepository } from "./repositories/logs.repository.js";
import { createLoyaltyRepository } from "./repositories/loyalty.repository.js";
import { createMacrosRepository } from "./repositories/macros.repository.js";
import { createMiniGamesRepository } from "./repositories/mini-games.repository.js";
import { createSourceGroupsRepository } from "./repositories/source-groups.repository.js";
import { createStreamSessionsRepository } from "./repositories/stream-sessions.repository.js";
import { createViewerQueueRepository } from "./repositories/viewer-queue.repository.js";
import { createWebhooksRepository } from "./repositories/webhooks.repository.js";
import { createWidgetsRepository } from "./repositories/widgets.repository.js";
import type { AlertProject, AlertRule, AutomationRule, Effect, Theme, WebhookHook, WidgetConfig } from "@btv/shared";
import type { AutomationConfig } from "./repositories/automation.repository.js";
import type { GoalRow } from "./repositories/goals.repository.js";
import type { MacroConfig } from "./repositories/macros.repository.js";
import type { SourceGroup } from "./repositories/source-groups.repository.js";

export type { AlertRule } from "@btv/shared";
export type { AlertProject, Theme } from "@btv/shared";
export type { AutomationAction, AutomationConfig } from "./repositories/automation.repository.js";
export type { ChatCommand, ChatQuote, ChatTimer } from "./repositories/chat.repository.js";
export type { Effect } from "@btv/shared";
export type { Giveaway, GiveawayEntry } from "./repositories/giveaways.repository.js";
export type { GoalRow } from "./repositories/goals.repository.js";
export type { ActivityLogRow, SystemLogEntry, SystemLogLevel } from "./repositories/logs.repository.js";
export type { LoyaltyViewer } from "./repositories/loyalty.repository.js";
export type { MacroConfig, MacroStep } from "./repositories/macros.repository.js";
export type { MiniGameRun } from "./repositories/mini-games.repository.js";
export type { SourceGroup, SourceGroupSource } from "./repositories/source-groups.repository.js";
export type {
  SceneSpanRow,
  SceneSpanSummary,
  SessionEventRow,
  SessionEventSummary,
  StreamSessionRow,
  StreamSessionSummary,
} from "./repositories/stream-sessions.repository.js";
export type { ViewerQueueEntry } from "./repositories/viewer-queue.repository.js";
export type { WebhookLogRow } from "./repositories/webhooks.repository.js";

const DB_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/btv.db",
);

let db: DatabaseSync;
let transactionDepth = 0;

function withTransaction<T>(work: () => T): T {
  if (transactionDepth > 0) return work();
  db.exec("BEGIN");
  transactionDepth += 1;
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    transactionDepth -= 1;
  }
}

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

    CREATE TABLE IF NOT EXISTS chat_commands (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL UNIQUE,
      aliases_json TEXT NOT NULL DEFAULT '[]',
      permission TEXT NOT NULL DEFAULT 'everyone',
      enabled INTEGER DEFAULT 1,
      cooldown_ms INTEGER NOT NULL DEFAULT 0,
      response TEXT NOT NULL,
      responses_json TEXT NOT NULL DEFAULT '[]',
      use_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_timers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      interval_ms INTEGER NOT NULL,
      message TEXT NOT NULL,
      responses_json TEXT NOT NULL DEFAULT '[]',
      run_count INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_quotes (
      id TEXT PRIMARY KEY,
      quote_number INTEGER NOT NULL UNIQUE,
      text TEXT NOT NULL,
      author TEXT,
      added_by TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loyalty_viewers (
      id TEXT PRIMARY KEY,
      login TEXT,
      display_name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      lifetime_points INTEGER NOT NULL DEFAULT 0,
      chat_messages INTEGER NOT NULL DEFAULT 0,
      last_earned_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS viewer_queue_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      login TEXT,
      display_name TEXT NOT NULL,
      note TEXT,
      joined_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaways (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      keyword TEXT NOT NULL DEFAULT '!enter',
      status TEXT NOT NULL DEFAULT 'open',
      winner_entry_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id TEXT PRIMARY KEY,
      giveaway_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      login TEXT,
      display_name TEXT NOT NULL,
      entered_at TEXT NOT NULL,
      UNIQUE(giveaway_id, user_id),
      FOREIGN KEY(giveaway_id) REFERENCES giveaways(id)
    );

    CREATE TABLE IF NOT EXISTS mini_game_runs (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      user_id TEXT NOT NULL,
      login TEXT,
      display_name TEXT NOT NULL,
      wager INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      points_delta INTEGER NOT NULL DEFAULT 0,
      result_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
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
  alertProjectsRepository.seedAlertProjects();
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
  const commandCols = db.prepare("PRAGMA table_info(chat_commands)").all() as Array<{ name: string }>;
  if (!commandCols.some((c) => c.name === "aliases_json")) {
    db.exec("ALTER TABLE chat_commands ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!commandCols.some((c) => c.name === "permission")) {
    db.exec("ALTER TABLE chat_commands ADD COLUMN permission TEXT NOT NULL DEFAULT 'everyone'");
  }
  if (!commandCols.some((c) => c.name === "cooldown_ms")) {
    db.exec("ALTER TABLE chat_commands ADD COLUMN cooldown_ms INTEGER NOT NULL DEFAULT 0");
  }
  if (!commandCols.some((c) => c.name === "responses_json")) {
    db.exec("ALTER TABLE chat_commands ADD COLUMN responses_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!commandCols.some((c) => c.name === "use_count")) {
    db.exec("ALTER TABLE chat_commands ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!commandCols.some((c) => c.name === "last_used_at")) {
    db.exec("ALTER TABLE chat_commands ADD COLUMN last_used_at TEXT");
  }
  const timerCols = db.prepare("PRAGMA table_info(chat_timers)").all() as Array<{ name: string }>;
  if (!timerCols.some((c) => c.name === "responses_json")) {
    db.exec("ALTER TABLE chat_timers ADD COLUMN responses_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!timerCols.some((c) => c.name === "run_count")) {
    db.exec("ALTER TABLE chat_timers ADD COLUMN run_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!timerCols.some((c) => c.name === "last_run_at")) {
    db.exec("ALTER TABLE chat_timers ADD COLUMN last_run_at TEXT");
  }
  const quoteCols = db.prepare("PRAGMA table_info(chat_quotes)").all() as Array<{ name: string }>;
  if (!quoteCols.some((c) => c.name === "use_count")) {
    db.exec("ALTER TABLE chat_quotes ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!quoteCols.some((c) => c.name === "last_used_at")) {
    db.exec("ALTER TABLE chat_quotes ADD COLUMN last_used_at TEXT");
  }
  const loyaltyCols = db.prepare("PRAGMA table_info(loyalty_viewers)").all() as Array<{ name: string }>;
  if (!loyaltyCols.some((c) => c.name === "lifetime_points")) {
    db.exec("ALTER TABLE loyalty_viewers ADD COLUMN lifetime_points INTEGER NOT NULL DEFAULT 0");
  }
  if (!loyaltyCols.some((c) => c.name === "chat_messages")) {
    db.exec("ALTER TABLE loyalty_viewers ADD COLUMN chat_messages INTEGER NOT NULL DEFAULT 0");
  }
  if (!loyaltyCols.some((c) => c.name === "last_earned_at")) {
    db.exec("ALTER TABLE loyalty_viewers ADD COLUMN last_earned_at TEXT");
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

function parseJsonValue<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

const alertRulesRepository = createAlertRulesRepository({
  getDb: () => db,
});
const alertProjectsRepository = createAlertProjectsRepository({
  getDb: () => db,
  parseJsonValue,
});
const effectsRepository = createEffectsRepository({
  getDb: () => db,
  parseRecord,
});
const settingsRepository = createSettingsRepository({
  getDb: () => db,
  encrypt,
  decrypt,
});
const macrosRepository = createMacrosRepository({
  getDb: () => db,
});
const chatRepository = createChatRepository({
  getDb: () => db,
  withTransaction,
});
const loyaltyRepository = createLoyaltyRepository({
  getDb: () => db,
  withTransaction,
});
const viewerQueueRepository = createViewerQueueRepository({
  getDb: () => db,
  withTransaction,
});
const giveawaysRepository = createGiveawaysRepository({
  getDb: () => db,
  withTransaction,
});
const miniGamesRepository = createMiniGamesRepository({
  getDb: () => db,
  withTransaction,
  parseRecord,
});
const automationRepository = createAutomationRepository({
  getDb: () => db,
  withTransaction,
  parseRecord,
  parseJsonValue,
});
const sourceGroupsRepository = createSourceGroupsRepository({
  getDb: () => db,
  parseJsonValue,
});
const logsRepository = createLogsRepository({
  getDb: () => db,
  withTransaction,
  parseRecord,
});
const streamSessionsRepository = createStreamSessionsRepository({
  getDb: () => db,
  withTransaction,
});
const webhooksRepository = createWebhooksRepository({
  getDb: () => db,
  parseRecord,
  encrypt,
  decrypt,
});
const goalsRepository = createGoalsRepository({
  getDb: () => db,
});
const widgetsRepository = createWidgetsRepository({
  getDb: () => db,
  parseRecord,
});

export interface ConfigProfileSnapshot {
  settings: Array<{ key: string; value: string }>;
  themes: Theme[];
  alertRules: AlertRule[];
  alertProjects: AlertProject[];
  widgets: WidgetConfig[];
  goals: GoalRow[];
  effects: Effect[];
  macros: MacroConfig[];
  automations: AutomationConfig[];
  automationRules: AutomationRule[];
  sourceGroups: SourceGroup[];
  webhooks: WebhookHook[];
}

const CONFIG_PROFILE_TABLES = [
  "automation_runs",
  "automation_state",
  "automation_rules",
  "automations",
  "source_groups",
  "webhooks",
  "macros",
  "effects",
  "goals",
  "widgets",
  "alert_rules",
  "alert_projects",
  "themes",
  "settings",
] as const;

export function getConfigProfileSnapshot(): ConfigProfileSnapshot {
  return {
    settings: settingsRepository.getRawSettingsSnapshot(),
    themes: alertProjectsRepository.getThemes(),
    alertRules: alertRulesRepository.getAlertRules(),
    alertProjects: alertProjectsRepository.getAlertProjects(),
    widgets: widgetsRepository.getWidgets(),
    goals: goalsRepository.getGoals(),
    effects: effectsRepository.getEffects(),
    macros: macrosRepository.getMacros(),
    automations: automationRepository.getAutomations(),
    automationRules: automationRepository.getAutomationRules(),
    sourceGroups: sourceGroupsRepository.getSourceGroups(),
    webhooks: webhooksRepository.getWebhooks(),
  };
}

export function replaceConfigProfileSnapshot(snapshot: ConfigProfileSnapshot): void {
  withTransaction(() => {
    for (const table of CONFIG_PROFILE_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    for (const setting of snapshot.settings) settingsRepository.setSetting(setting.key, setting.value);
    for (const theme of snapshot.themes) alertProjectsRepository.upsertTheme(theme);
    for (const project of snapshot.alertProjects) alertProjectsRepository.upsertAlertProject(project);
    for (const rule of snapshot.alertRules) alertRulesRepository.upsertAlertRule(rule);
    for (const widget of snapshot.widgets) widgetsRepository.upsertWidget(widget);
    for (const goal of snapshot.goals) {
      db.prepare(
        `INSERT INTO goals (id, label, type, current_count, target_count) VALUES (?, ?, ?, ?, ?)`,
      ).run(goal.id, goal.label, goal.type, goal.current_count, goal.target_count);
    }
    for (const effect of snapshot.effects) effectsRepository.upsertEffect(effect);
    for (const macro of snapshot.macros) macrosRepository.upsertMacro(macro);
    for (const automation of snapshot.automations) automationRepository.upsertAutomation(automation);
    for (const rule of snapshot.automationRules) automationRepository.upsertAutomationRule(rule);
    for (const group of snapshot.sourceGroups) sourceGroupsRepository.upsertSourceGroup(group);
    for (const hook of snapshot.webhooks) webhooksRepository.upsertWebhook(hook);
  });
}

export const logActivity = logsRepository.logActivity;
export const getActivity = logsRepository.getActivity;
export const getActivityById = logsRepository.getActivityById;
export const logSystem = logsRepository.logSystem;
export const getSystemLogs = logsRepository.getSystemLogs;
export const startStreamSession = streamSessionsRepository.startStreamSession;
export const stopCurrentStreamSession = streamSessionsRepository.stopCurrentStreamSession;
export const getCurrentStreamSession = streamSessionsRepository.getCurrentStreamSession;
export const getRecentStreamSessions = streamSessionsRepository.getRecentStreamSessions;
export const getSessionEvents = streamSessionsRepository.getSessionEvents;
export const getSessionSceneSpans = streamSessionsRepository.getSessionSceneSpans;
export const logSessionEvent = streamSessionsRepository.logSessionEvent;
export const logObsSceneSpan = streamSessionsRepository.logObsSceneSpan;
export const getStreamSessionSummary = streamSessionsRepository.getStreamSessionSummary;
export const getWebhooks = webhooksRepository.getWebhooks;
export const upsertWebhook = webhooksRepository.upsertWebhook;
export const deleteWebhook = webhooksRepository.deleteWebhook;
export const getWebhook = webhooksRepository.getWebhook;
export const logWebhookRequest = webhooksRepository.logWebhookRequest;
export const getWebhookLog = webhooksRepository.getWebhookLog;
export const getSourceGroups = sourceGroupsRepository.getSourceGroups;
export const getSourceGroup = sourceGroupsRepository.getSourceGroup;
export const upsertSourceGroup = sourceGroupsRepository.upsertSourceGroup;
export const deleteSourceGroup = sourceGroupsRepository.deleteSourceGroup;
export const getAutomations = automationRepository.getAutomations;
export const getAutomation = automationRepository.getAutomation;
export const upsertAutomation = automationRepository.upsertAutomation;
export const deleteAutomation = automationRepository.deleteAutomation;
export const getAutomationRules = automationRepository.getAutomationRules;
export const getAutomationRule = automationRepository.getAutomationRule;
export const upsertAutomationRule = automationRepository.upsertAutomationRule;
export const deleteAutomationRule = automationRepository.deleteAutomationRule;
export const recordAutomationRuleRun = automationRepository.recordAutomationRuleRun;
export const getAutomationRuns = automationRepository.getAutomationRuns;
export const getAutomationStateValue = automationRepository.getAutomationStateValue;
export const getAutomationStateSnapshot = automationRepository.getAutomationStateSnapshot;
export const setAutomationStateValue = automationRepository.setAutomationStateValue;
export const deleteAutomationStateValue = automationRepository.deleteAutomationStateValue;
export const getGoal = goalsRepository.getGoal;
export const getGoals = goalsRepository.getGoals;
export const updateGoal = goalsRepository.updateGoal;
export const getWidgets = widgetsRepository.getWidgets;
export const upsertWidget = widgetsRepository.upsertWidget;
export const updateWidgetText = widgetsRepository.updateWidgetText;
export const getAlertRules = alertRulesRepository.getAlertRules;
export const upsertAlertRule = alertRulesRepository.upsertAlertRule;
export const getThemes = alertProjectsRepository.getThemes;
export const getTheme = alertProjectsRepository.getTheme;
export const upsertTheme = alertProjectsRepository.upsertTheme;
export const deleteTheme = alertProjectsRepository.deleteTheme;
export const getAlertProjects = alertProjectsRepository.getAlertProjects;
export const getAlertProject = alertProjectsRepository.getAlertProject;
export const upsertAlertProject = alertProjectsRepository.upsertAlertProject;
export const deleteAlertProject = alertProjectsRepository.deleteAlertProject;
export const getEffects = effectsRepository.getEffects;
export const upsertEffect = effectsRepository.upsertEffect;
export const deleteEffect = effectsRepository.deleteEffect;
export const getSetting = settingsRepository.getSetting;
export const setSetting = settingsRepository.setSetting;
export const deleteSetting = settingsRepository.deleteSetting;
export const getSettingsSnapshot = settingsRepository.getSettingsSnapshot;
export const getRawSettingsSnapshot = settingsRepository.getRawSettingsSnapshot;
export const getEncryptedSetting = settingsRepository.getEncryptedSetting;
export const setEncryptedSetting = settingsRepository.setEncryptedSetting;
export const getMacros = macrosRepository.getMacros;
export const getMacro = macrosRepository.getMacro;
export const upsertMacro = macrosRepository.upsertMacro;
export const deleteMacro = macrosRepository.deleteMacro;
export const getChatCommands = chatRepository.getChatCommands;
export const getChatCommand = chatRepository.getChatCommand;
export const getChatCommandByCommand = chatRepository.getChatCommandByCommand;
export const getChatCommandByTrigger = chatRepository.getChatCommandByTrigger;
export const upsertChatCommand = chatRepository.upsertChatCommand;
export const recordChatCommandUse = chatRepository.recordChatCommandUse;
export const deleteChatCommand = chatRepository.deleteChatCommand;
export const getChatTimers = chatRepository.getChatTimers;
export const getChatTimer = chatRepository.getChatTimer;
export const upsertChatTimer = chatRepository.upsertChatTimer;
export const recordChatTimerRun = chatRepository.recordChatTimerRun;
export const deleteChatTimer = chatRepository.deleteChatTimer;
export const getChatQuotes = chatRepository.getChatQuotes;
export const getChatQuote = chatRepository.getChatQuote;
export const getChatQuoteByNumber = chatRepository.getChatQuoteByNumber;
export const getRandomChatQuote = chatRepository.getRandomChatQuote;
export const nextChatQuoteNumber = chatRepository.nextChatQuoteNumber;
export const upsertChatQuote = chatRepository.upsertChatQuote;
export const recordChatQuoteUse = chatRepository.recordChatQuoteUse;
export const deleteChatQuote = chatRepository.deleteChatQuote;
export const getLoyaltyViewers = loyaltyRepository.getLoyaltyViewers;
export const getLoyaltyViewer = loyaltyRepository.getLoyaltyViewer;
export const awardLoyaltyPoints = loyaltyRepository.awardLoyaltyPoints;
export const setLoyaltyViewerPoints = loyaltyRepository.setLoyaltyViewerPoints;
export const adjustLoyaltyViewerPoints = loyaltyRepository.adjustLoyaltyViewerPoints;
export const getViewerQueueEntries = viewerQueueRepository.getViewerQueueEntries;
export const getViewerQueueEntryByUser = viewerQueueRepository.getViewerQueueEntryByUser;
export const addViewerQueueEntry = viewerQueueRepository.addViewerQueueEntry;
export const getViewerQueuePosition = viewerQueueRepository.getViewerQueuePosition;
export const removeViewerQueueEntry = viewerQueueRepository.removeViewerQueueEntry;
export const popNextViewerQueueEntry = viewerQueueRepository.popNextViewerQueueEntry;
export const clearViewerQueueEntries = viewerQueueRepository.clearViewerQueueEntries;
export const getGiveaways = giveawaysRepository.getGiveaways;
export const getGiveaway = giveawaysRepository.getGiveaway;
export const getActiveGiveaway = giveawaysRepository.getActiveGiveaway;
export const openGiveaway = giveawaysRepository.openGiveaway;
export const closeGiveaway = giveawaysRepository.closeGiveaway;
export const enterGiveaway = giveawaysRepository.enterGiveaway;
export const removeGiveawayEntry = giveawaysRepository.removeGiveawayEntry;
export const clearGiveawayEntries = giveawaysRepository.clearGiveawayEntries;
export const pickGiveawayWinner = giveawaysRepository.pickGiveawayWinner;
export const getMiniGameRuns = miniGamesRepository.getMiniGameRuns;
export const recordMiniGameRun = miniGamesRepository.recordMiniGameRun;

