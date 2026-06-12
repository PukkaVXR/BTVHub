import type { DatabaseSync } from "node:sqlite";

export interface ViewerQueueEntry {
  id: string;
  userId: string;
  login?: string;
  displayName: string;
  note?: string;
  joinedAt: string;
  updatedAt: string;
}

interface ViewerQueueRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
}

function rowToViewerQueueEntry(row: Record<string, unknown>): ViewerQueueEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    login: row.login ? String(row.login) : undefined,
    displayName: String(row.display_name),
    note: row.note ? String(row.note) : undefined,
    joinedAt: String(row.joined_at),
    updatedAt: String(row.updated_at),
  };
}

export function createViewerQueueRepository({ getDb, withTransaction }: ViewerQueueRepositoryDeps) {
  function getViewerQueueEntries(): ViewerQueueEntry[] {
    return (getDb()
      .prepare("SELECT * FROM viewer_queue_entries ORDER BY joined_at ASC")
      .all() as Array<Record<string, unknown>>).map(rowToViewerQueueEntry);
  }

  function getViewerQueueEntryByUser(userIdOrLogin: string): ViewerQueueEntry | null {
    const row = getDb()
      .prepare("SELECT * FROM viewer_queue_entries WHERE user_id = ? OR lower(login) = lower(?) LIMIT 1")
      .get(userIdOrLogin, userIdOrLogin) as Record<string, unknown> | undefined;
    return row ? rowToViewerQueueEntry(row) : null;
  }

  function getViewerQueuePosition(userIdOrLogin: string): number {
    const entries = getViewerQueueEntries();
    const index = entries.findIndex((entry) =>
      entry.userId === userIdOrLogin || entry.login?.toLowerCase() === userIdOrLogin.toLowerCase()
    );
    return index >= 0 ? index + 1 : 0;
  }

  function addViewerQueueEntry(input: {
    userId: string;
    login?: string;
    displayName: string;
    note?: string;
  }): { entry: ViewerQueueEntry; position: number; alreadyQueued: boolean } {
    return withTransaction(() => {
      const now = new Date().toISOString();
      const existing = getViewerQueueEntryByUser(input.userId);
      if (existing) {
        getDb().prepare(
          `UPDATE viewer_queue_entries
           SET login = ?, display_name = ?, note = COALESCE(?, note), updated_at = ?
           WHERE id = ?`,
        ).run(input.login ?? null, input.displayName, input.note?.trim() || null, now, existing.id);
        const entry = getViewerQueueEntryByUser(input.userId)!;
        return { entry, position: getViewerQueuePosition(input.userId), alreadyQueued: true };
      }
      const id = crypto.randomUUID();
      getDb().prepare(
        `INSERT INTO viewer_queue_entries (id, user_id, login, display_name, note, joined_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, input.userId, input.login ?? null, input.displayName, input.note?.trim() || null, now, now);
      const entry = getViewerQueueEntryByUser(input.userId)!;
      return { entry, position: getViewerQueuePosition(input.userId), alreadyQueued: false };
    });
  }

  function removeViewerQueueEntry(idOrUser: string): ViewerQueueEntry | null {
    return withTransaction(() => {
      const directRow = getDb().prepare("SELECT * FROM viewer_queue_entries WHERE id = ?").get(idOrUser) as
        | Record<string, unknown>
        | undefined;
      const entry = getViewerQueueEntryByUser(idOrUser) ?? (directRow ? rowToViewerQueueEntry(directRow) : null);
      if (!entry) return null;
      getDb().prepare("DELETE FROM viewer_queue_entries WHERE id = ?").run(entry.id);
      return entry;
    });
  }

  function popNextViewerQueueEntry(): ViewerQueueEntry | null {
    return withTransaction(() => {
      const entry = getViewerQueueEntries()[0] ?? null;
      if (!entry) return null;
      getDb().prepare("DELETE FROM viewer_queue_entries WHERE id = ?").run(entry.id);
      return entry;
    });
  }

  function clearViewerQueueEntries(): number {
    return withTransaction(() => {
      const count = getViewerQueueEntries().length;
      getDb().prepare("DELETE FROM viewer_queue_entries").run();
      return count;
    });
  }

  return {
    getViewerQueueEntries,
    getViewerQueueEntryByUser,
    addViewerQueueEntry,
    getViewerQueuePosition,
    removeViewerQueueEntry,
    popNextViewerQueueEntry,
    clearViewerQueueEntries,
  };
}
