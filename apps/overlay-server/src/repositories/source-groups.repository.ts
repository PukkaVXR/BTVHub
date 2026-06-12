import type { DatabaseSync } from "node:sqlite";

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

interface SourceGroupsRepositoryDeps {
  getDb: () => DatabaseSync;
  parseJsonValue: <T>(raw: unknown, fallback: T) => T;
}

export function createSourceGroupsRepository({ getDb, parseJsonValue }: SourceGroupsRepositoryDeps) {
  const rowToSourceGroup = (row: Record<string, unknown>): SourceGroup => ({
    id: String(row.id),
    name: String(row.name),
    sceneName: String(row.scene_name),
    sources: parseJsonValue<SourceGroupSource[]>(row.sources_json, []),
    updatedAt: String(row.updated_at),
  });

  function getSourceGroups(): SourceGroup[] {
    return (getDb().prepare("SELECT * FROM source_groups ORDER BY name").all() as Array<Record<string, unknown>>).map(
      rowToSourceGroup,
    );
  }

  function getSourceGroup(id: string): SourceGroup | null {
    const row = getDb().prepare("SELECT * FROM source_groups WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToSourceGroup(row) : null;
  }

  function upsertSourceGroup(group: SourceGroup): void {
    getDb().prepare(
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

  function deleteSourceGroup(id: string): void {
    getDb().prepare("DELETE FROM source_groups WHERE id = ?").run(id);
  }

  return {
    getSourceGroups,
    getSourceGroup,
    upsertSourceGroup,
    deleteSourceGroup,
  };
}
