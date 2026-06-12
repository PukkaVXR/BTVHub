import type { DatabaseSync } from "node:sqlite";

export interface GoalRow {
  id: string;
  label: string;
  type: string;
  current_count: number;
  target_count: number;
}

interface GoalsRepositoryDeps {
  getDb: () => DatabaseSync;
}

export function createGoalsRepository({ getDb }: GoalsRepositoryDeps) {
  function getGoal(id: string): GoalRow | undefined {
    return getDb().prepare("SELECT * FROM goals WHERE id = ?").get(id) as GoalRow | undefined;
  }

  function getGoals(): GoalRow[] {
    return getDb().prepare("SELECT * FROM goals").all() as unknown as GoalRow[];
  }

  function updateGoal(
    id: string,
    current: number,
    target?: number,
    label?: string,
  ): void {
    if (target != null && label != null) {
      getDb().prepare(
        `UPDATE goals SET current_count = ?, target_count = ?, label = ? WHERE id = ?`,
      ).run(current, target, label, id);
    } else if (target != null) {
      getDb().prepare(
        `UPDATE goals SET current_count = ?, target_count = ? WHERE id = ?`,
      ).run(current, target, id);
    } else if (label != null) {
      getDb().prepare(
        `UPDATE goals SET current_count = ?, label = ? WHERE id = ?`,
      ).run(current, label, id);
    } else {
      getDb().prepare(`UPDATE goals SET current_count = ? WHERE id = ?`).run(current, id);
    }
  }

  return {
    getGoal,
    getGoals,
    updateGoal,
  };
}
