import type { DatabaseSync } from "node:sqlite";

export interface MiniGameRun {
  id: string;
  game: string;
  userId: string;
  login?: string;
  displayName: string;
  wager: number;
  outcome: "win" | "lose" | "tie" | "play";
  pointsDelta: number;
  result: Record<string, unknown>;
  createdAt: string;
}

interface MiniGamesRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
  parseRecord: (raw: unknown) => Record<string, unknown>;
}

export function createMiniGamesRepository({ getDb, withTransaction, parseRecord }: MiniGamesRepositoryDeps) {
  function rowToMiniGameRun(row: Record<string, unknown>): MiniGameRun {
    const outcome = String(row.outcome ?? "play");
    return {
      id: String(row.id),
      game: String(row.game),
      userId: String(row.user_id),
      login: row.login ? String(row.login) : undefined,
      displayName: String(row.display_name),
      wager: Number(row.wager ?? 0),
      outcome: outcome === "win" || outcome === "lose" || outcome === "tie" ? outcome : "play",
      pointsDelta: Number(row.points_delta ?? 0),
      result: parseRecord(row.result_json),
      createdAt: String(row.created_at),
    };
  }

  function getMiniGameRuns(limit = 50): MiniGameRun[] {
    return (getDb()
      .prepare("SELECT * FROM mini_game_runs ORDER BY created_at DESC LIMIT ?")
      .all(Math.min(200, Math.max(1, Math.floor(limit)))) as Array<Record<string, unknown>>).map(rowToMiniGameRun);
  }

  function recordMiniGameRun(input: Omit<MiniGameRun, "id" | "createdAt">): MiniGameRun {
    return withTransaction(() => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      getDb().prepare(
        `INSERT INTO mini_game_runs
          (id, game, user_id, login, display_name, wager, outcome, points_delta, result_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.game,
        input.userId,
        input.login ?? null,
        input.displayName,
        Math.max(0, Math.floor(input.wager)),
        input.outcome,
        Math.trunc(input.pointsDelta),
        JSON.stringify(input.result ?? {}),
        now,
      );
      getDb().prepare(
        `DELETE FROM mini_game_runs
         WHERE id NOT IN (SELECT id FROM mini_game_runs ORDER BY created_at DESC LIMIT 200)`,
      ).run();
      return getMiniGameRuns(1)[0]!;
    });
  }

  return {
    getMiniGameRuns,
    recordMiniGameRun,
  };
}
