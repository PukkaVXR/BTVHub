import type { DatabaseSync } from "node:sqlite";
import { normalizeChatCommand } from "../chat-command-utils.js";

export interface GiveawayEntry {
  id: string;
  giveawayId: string;
  userId: string;
  login?: string;
  displayName: string;
  enteredAt: string;
}

export interface Giveaway {
  id: string;
  name: string;
  keyword: string;
  status: "open" | "closed";
  winnerEntryId?: string;
  createdAt: string;
  updatedAt: string;
  entries: GiveawayEntry[];
  winner?: GiveawayEntry;
}

interface GiveawaysRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
}

function normalizeGiveawayKeyword(keyword: unknown): string {
  const normalized = normalizeChatCommand(keyword ?? "!enter");
  return /^![a-z0-9][a-z0-9_-]*$/i.test(normalized) ? normalized : "!enter";
}

function rowToGiveawayEntry(row: Record<string, unknown>): GiveawayEntry {
  return {
    id: String(row.id),
    giveawayId: String(row.giveaway_id),
    userId: String(row.user_id),
    login: row.login ? String(row.login) : undefined,
    displayName: String(row.display_name),
    enteredAt: String(row.entered_at),
  };
}

export function createGiveawaysRepository({ getDb, withTransaction }: GiveawaysRepositoryDeps) {
  function getGiveawayEntries(giveawayId: string): GiveawayEntry[] {
    return (getDb()
      .prepare("SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entered_at ASC")
      .all(giveawayId) as Array<Record<string, unknown>>).map(rowToGiveawayEntry);
  }

  function rowToGiveaway(row: Record<string, unknown>): Giveaway {
    const entries = getGiveawayEntries(String(row.id));
    const winnerEntryId = row.winner_entry_id ? String(row.winner_entry_id) : undefined;
    return {
      id: String(row.id),
      name: String(row.name),
      keyword: String(row.keyword ?? "!enter"),
      status: String(row.status ?? "open") === "closed" ? "closed" : "open",
      winnerEntryId,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      entries,
      winner: winnerEntryId ? entries.find((entry) => entry.id === winnerEntryId) : undefined,
    };
  }

  function getGiveaways(): Giveaway[] {
    return (getDb()
      .prepare("SELECT * FROM giveaways ORDER BY created_at DESC")
      .all() as Array<Record<string, unknown>>).map(rowToGiveaway);
  }

  function getGiveaway(id: string): Giveaway | null {
    const row = getDb().prepare("SELECT * FROM giveaways WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToGiveaway(row) : null;
  }

  function getActiveGiveaway(): Giveaway | null {
    const row = getDb()
      .prepare("SELECT * FROM giveaways WHERE status = 'open' ORDER BY created_at DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    return row ? rowToGiveaway(row) : null;
  }

  function openGiveaway(input: { name: string; keyword?: string }): Giveaway {
    return withTransaction(() => {
      const now = new Date().toISOString();
      getDb().prepare("UPDATE giveaways SET status = 'closed', updated_at = ? WHERE status = 'open'").run(now);
      const id = crypto.randomUUID();
      const keyword = normalizeGiveawayKeyword(input.keyword);
      getDb().prepare(
        `INSERT INTO giveaways (id, name, keyword, status, winner_entry_id, created_at, updated_at)
         VALUES (?, ?, ?, 'open', NULL, ?, ?)`,
      ).run(id, input.name.trim() || "Stream giveaway", keyword, now, now);
      return getGiveaway(id)!;
    });
  }

  function closeGiveaway(id: string): Giveaway | null {
    const giveaway = getGiveaway(id);
    if (!giveaway) return null;
    getDb().prepare("UPDATE giveaways SET status = 'closed', updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      id,
    );
    return getGiveaway(id);
  }

  function enterGiveaway(input: {
    giveawayId: string;
    userId: string;
    login?: string;
    displayName: string;
  }): { giveaway: Giveaway; entry: GiveawayEntry; alreadyEntered: boolean; position: number } | null {
    const giveaway = getGiveaway(input.giveawayId);
    if (!giveaway || giveaway.status !== "open") return null;
    const existing = getDb()
      .prepare("SELECT * FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?")
      .get(input.giveawayId, input.userId) as Record<string, unknown> | undefined;
    if (existing) {
      const entry = rowToGiveawayEntry(existing);
      return {
        giveaway,
        entry,
        alreadyEntered: true,
        position: giveaway.entries.findIndex((item) => item.id === entry.id) + 1,
      };
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    getDb().prepare(
      `INSERT INTO giveaway_entries (id, giveaway_id, user_id, login, display_name, entered_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.giveawayId, input.userId, input.login ?? null, input.displayName, now);
    const updated = getGiveaway(input.giveawayId)!;
    const entry = updated.entries.find((item) => item.id === id)!;
    return { giveaway: updated, entry, alreadyEntered: false, position: updated.entries.length };
  }

  function removeGiveawayEntry(entryId: string): GiveawayEntry | null {
    const row = getDb().prepare("SELECT * FROM giveaway_entries WHERE id = ?").get(entryId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const entry = rowToGiveawayEntry(row);
    getDb().prepare("DELETE FROM giveaway_entries WHERE id = ?").run(entryId);
    return entry;
  }

  function clearGiveawayEntries(giveawayId: string): number {
    return withTransaction(() => {
      const count = getGiveawayEntries(giveawayId).length;
      getDb().prepare("DELETE FROM giveaway_entries WHERE giveaway_id = ?").run(giveawayId);
      getDb().prepare("UPDATE giveaways SET winner_entry_id = NULL, updated_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        giveawayId,
      );
      return count;
    });
  }

  function pickGiveawayWinner(giveawayId: string): Giveaway | null {
    return withTransaction(() => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway || giveaway.entries.length === 0) return null;
      const winner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)]!;
      getDb().prepare("UPDATE giveaways SET winner_entry_id = ?, updated_at = ? WHERE id = ?").run(
        winner.id,
        new Date().toISOString(),
        giveawayId,
      );
      return getGiveaway(giveawayId);
    });
  }

  return {
    getGiveaways,
    getGiveaway,
    getActiveGiveaway,
    openGiveaway,
    closeGiveaway,
    enterGiveaway,
    removeGiveawayEntry,
    clearGiveawayEntries,
    pickGiveawayWinner,
  };
}
