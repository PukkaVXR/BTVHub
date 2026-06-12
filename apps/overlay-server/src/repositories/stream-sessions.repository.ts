import type { DatabaseSync } from "node:sqlite";
import type { StreamEvent } from "@btv/shared";

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

interface StreamSessionsRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
}

export function createStreamSessionsRepository({ getDb, withTransaction }: StreamSessionsRepositoryDeps) {
  function startStreamSession(title?: string): StreamSessionRow {
    const active = getCurrentStreamSession();
    if (active) return active;

    const now = new Date().toISOString();
    const session = {
      id: crypto.randomUUID(),
      title: title?.trim() || `Stream ${new Date().toLocaleDateString()}`,
      started_at: now,
      ended_at: null,
    };
    getDb().prepare(
      `INSERT INTO stream_sessions (id, title, started_at, ended_at) VALUES (?, ?, ?, NULL)`,
    ).run(session.id, session.title, session.started_at);
    return session;
  }

  function stopCurrentStreamSession(): StreamSessionRow | null {
    return withTransaction(() => {
      const active = getCurrentStreamSession();
      if (!active) return null;
      const endedAt = new Date().toISOString();
      getDb().prepare("UPDATE stream_sessions SET ended_at = ? WHERE id = ?").run(endedAt, active.id);
      getDb().prepare(
        `UPDATE obs_scene_spans SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL`,
      ).run(endedAt, active.id);
      return { ...active, ended_at: endedAt };
    });
  }

  function getCurrentStreamSession(): StreamSessionRow | null {
    const row = getDb()
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

  function getRecentStreamSessions(limit = 10): StreamSessionRow[] {
    return getDb()
      .prepare(
        `SELECT id, title, started_at, ended_at
         FROM stream_sessions
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as StreamSessionRow[];
  }

  function getSessionEvents(sessionId: string): SessionEventRow[] {
    return getDb()
      .prepare(
        `SELECT id, event_type, source, user_login, user_display_name, amount, created_at
         FROM session_events
         WHERE session_id = ?
         ORDER BY created_at DESC`,
      )
      .all(sessionId) as unknown as SessionEventRow[];
  }

  function getSessionSceneSpans(sessionId: string): SceneSpanRow[] {
    return getDb()
      .prepare(
        `SELECT id, scene_name, started_at, ended_at
         FROM obs_scene_spans
         WHERE session_id = ?
         ORDER BY started_at DESC`,
      )
      .all(sessionId) as unknown as SceneSpanRow[];
  }

  function logSessionEvent(event: StreamEvent): void {
    const session = getCurrentStreamSession();
    if (!session) return;
    getDb().prepare(
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

  function logObsSceneSpan(sceneName: string): void {
    withTransaction(() => {
      const session = getCurrentStreamSession();
      if (!session) return;
      const now = new Date().toISOString();
      const active = getDb()
        .prepare(
          `SELECT scene_name FROM obs_scene_spans
           WHERE session_id = ? AND ended_at IS NULL
           ORDER BY started_at DESC
           LIMIT 1`,
        )
        .get(session.id) as { scene_name: string } | undefined;

      if (active?.scene_name === sceneName) return;

      getDb().prepare(
        `UPDATE obs_scene_spans SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL`,
      ).run(now, session.id);
      getDb().prepare(
        `INSERT INTO obs_scene_spans (id, session_id, scene_name, started_at, ended_at)
         VALUES (?, ?, ?, ?, NULL)`,
      ).run(crypto.randomUUID(), session.id, sceneName, now);
    });
  }

  function getStreamSessionSummary(sessionId?: string): StreamSessionSummary {
    const session = sessionId
      ? ((getDb()
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

    const rows = getDb()
      .prepare(
        `SELECT event_type, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
         FROM session_events
         WHERE session_id = ?
         GROUP BY event_type
         ORDER BY count DESC`,
      )
      .all(session.id) as Array<{ event_type: string; count: number; amount: number }>;

    const byType = new Map(rows.map((row) => [row.event_type, row]));
    const eventsByType = rows.map((row) => ({
      eventType: row.event_type,
      count: Number(row.count),
      amount: Number(row.amount),
    }));

    const sceneRows = getDb()
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
        subs: Number(byType.get("sub")?.count ?? 0)
          + Number(byType.get("resub")?.count ?? 0)
          + Number(byType.get("gift_sub")?.count ?? 0),
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

  return {
    startStreamSession,
    stopCurrentStreamSession,
    getCurrentStreamSession,
    getRecentStreamSessions,
    getSessionEvents,
    getSessionSceneSpans,
    logSessionEvent,
    logObsSceneSpan,
    getStreamSessionSummary,
  };
}
