import type { DatabaseSync } from "node:sqlite";

export interface LoyaltyViewer {
  id: string;
  login?: string;
  displayName: string;
  points: number;
  lifetimePoints: number;
  chatMessages: number;
  lastEarnedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoyaltyRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
}

function rowToLoyaltyViewer(row: Record<string, unknown>): LoyaltyViewer {
  return {
    id: String(row.id),
    login: row.login ? String(row.login) : undefined,
    displayName: String(row.display_name),
    points: Number(row.points ?? 0),
    lifetimePoints: Number(row.lifetime_points ?? 0),
    chatMessages: Number(row.chat_messages ?? 0),
    lastEarnedAt: row.last_earned_at ? String(row.last_earned_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createLoyaltyRepository({ getDb, withTransaction }: LoyaltyRepositoryDeps) {
  function getLoyaltyViewers(limit = 100): LoyaltyViewer[] {
    return (getDb()
      .prepare(
        `SELECT * FROM loyalty_viewers
         ORDER BY points DESC, lifetime_points DESC, display_name ASC
         LIMIT ?`,
      )
      .all(limit) as Array<Record<string, unknown>>).map(rowToLoyaltyViewer);
  }

  function getLoyaltyViewer(idOrLogin: string): LoyaltyViewer | null {
    const row = getDb()
      .prepare("SELECT * FROM loyalty_viewers WHERE id = ? OR lower(login) = lower(?) LIMIT 1")
      .get(idOrLogin, idOrLogin) as Record<string, unknown> | undefined;
    return row ? rowToLoyaltyViewer(row) : null;
  }

  function awardLoyaltyPoints(input: {
    id: string;
    login?: string;
    displayName: string;
    points: number;
    messageCount?: number;
    earnCooldownMs?: number;
  }): LoyaltyViewer {
    return withTransaction(() => {
      const now = new Date().toISOString();
      const existing = getLoyaltyViewer(input.id);
      const cooldownMs = input.earnCooldownMs ?? 60_000;
      const canEarn = !existing?.lastEarnedAt || Date.now() - new Date(existing.lastEarnedAt).getTime() >= cooldownMs;
      const earned = canEarn ? Math.max(0, Math.floor(input.points)) : 0;
      const messageCount = Math.max(0, Math.floor(input.messageCount ?? 0));
      getDb().prepare(
        `INSERT INTO loyalty_viewers
          (id, login, display_name, points, lifetime_points, chat_messages, last_earned_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          login=excluded.login,
          display_name=excluded.display_name,
          points=loyalty_viewers.points + ?,
          lifetime_points=loyalty_viewers.lifetime_points + ?,
          chat_messages=loyalty_viewers.chat_messages + ?,
          last_earned_at=COALESCE(excluded.last_earned_at, loyalty_viewers.last_earned_at),
          updated_at=excluded.updated_at`,
      ).run(
        input.id,
        input.login ?? null,
        input.displayName,
        earned,
        earned,
        messageCount,
        earned > 0 ? now : null,
        existing?.createdAt ?? now,
        now,
        earned,
        earned,
        messageCount,
      );
      return getLoyaltyViewer(input.id)!;
    });
  }

  function setLoyaltyViewerPoints(id: string, points: number): LoyaltyViewer | null {
    return withTransaction(() => {
      const viewer = getLoyaltyViewer(id);
      if (!viewer) return null;
      const safePoints = Math.max(0, Math.floor(points));
      getDb().prepare("UPDATE loyalty_viewers SET points = ?, updated_at = ? WHERE id = ?").run(
        safePoints,
        new Date().toISOString(),
        viewer.id,
      );
      return getLoyaltyViewer(viewer.id);
    });
  }

  function adjustLoyaltyViewerPoints(id: string, delta: number): LoyaltyViewer | null {
    return withTransaction(() => {
      const viewer = getLoyaltyViewer(id);
      if (!viewer) return null;
      const safeDelta = Math.trunc(delta);
      const nextPoints = Math.max(0, viewer.points + safeDelta);
      const lifetimeDelta = Math.max(0, safeDelta);
      getDb().prepare(
        `UPDATE loyalty_viewers
         SET points = ?, lifetime_points = lifetime_points + ?, updated_at = ?
         WHERE id = ?`,
      ).run(nextPoints, lifetimeDelta, new Date().toISOString(), viewer.id);
      return getLoyaltyViewer(viewer.id);
    });
  }

  return {
    getLoyaltyViewers,
    getLoyaltyViewer,
    awardLoyaltyPoints,
    setLoyaltyViewerPoints,
    adjustLoyaltyViewerPoints,
  };
}
