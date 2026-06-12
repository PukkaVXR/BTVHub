import type { DatabaseSync } from "node:sqlite";

export interface ActivityLogRow {
  id: string;
  event_json: string;
  created_at: string;
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

interface LogsRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
  parseRecord: (raw: unknown) => Record<string, unknown>;
}

export function createLogsRepository({ getDb, withTransaction, parseRecord }: LogsRepositoryDeps) {
  function logActivity(eventJson: string): void {
    withTransaction(() => {
      getDb().prepare(`INSERT INTO activity_log (id, event_json, created_at) VALUES (?, ?, ?)`).run(
        crypto.randomUUID(),
        eventJson,
        new Date().toISOString(),
      );
      getDb().prepare(
        `DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC LIMIT 200)`,
      ).run();
    });
  }

  function getActivity(limit = 50): ActivityLogRow[] {
    return getDb()
      .prepare(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as unknown as ActivityLogRow[];
  }

  function getActivityById(id: string): ActivityLogRow | undefined {
    return getDb()
      .prepare(`SELECT * FROM activity_log WHERE id = ?`)
      .get(id) as ActivityLogRow | undefined;
  }

  function logSystem(
    source: string,
    level: SystemLogLevel,
    message: string,
    details: Record<string, unknown> = {},
  ): void {
    withTransaction(() => {
      getDb().prepare(
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
      getDb().prepare(
        `DELETE FROM system_logs WHERE id NOT IN (SELECT id FROM system_logs ORDER BY created_at DESC LIMIT 500)`,
      ).run();
    });
  }

  function getSystemLogs(limit = 100): SystemLogEntry[] {
    return (getDb()
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

  return {
    logActivity,
    getActivity,
    getActivityById,
    logSystem,
    getSystemLogs,
  };
}
