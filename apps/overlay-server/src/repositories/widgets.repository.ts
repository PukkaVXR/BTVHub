import type { DatabaseSync } from "node:sqlite";
import type { WidgetConfig } from "@btv/shared";

interface WidgetsRepositoryDeps {
  getDb: () => DatabaseSync;
  parseRecord: (raw: unknown) => Record<string, unknown>;
}

export function createWidgetsRepository({ getDb, parseRecord }: WidgetsRepositoryDeps) {
  function getWidgets(): WidgetConfig[] {
    return (getDb().prepare("SELECT * FROM widgets").all() as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      type: row.type as WidgetConfig["type"],
      enabled: Boolean(row.enabled),
      config: parseRecord(row.config),
    }));
  }

  function upsertWidget(widget: WidgetConfig): void {
    getDb().prepare(
      `INSERT INTO widgets (id, type, enabled, config) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type=excluded.type, enabled=excluded.enabled, config=excluded.config`,
    ).run(widget.id, widget.type, widget.enabled ? 1 : 0, JSON.stringify(widget.config));
  }

  function updateWidgetText(widgetId: string, text: string): boolean {
    const row = getDb().prepare("SELECT config FROM widgets WHERE id = ?").get(widgetId) as
      | { config: string }
      | undefined;
    if (!row) return false;
    const config = { ...parseRecord(row.config), text };
    getDb().prepare("UPDATE widgets SET config = ? WHERE id = ?").run(JSON.stringify(config), widgetId);
    return true;
  }

  return {
    getWidgets,
    upsertWidget,
    updateWidgetText,
  };
}
