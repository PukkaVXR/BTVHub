import type { DatabaseSync } from "node:sqlite";
import type { AlertProject, Theme } from "@btv/shared";
import { AlertProjectSchema } from "@btv/shared";

interface AlertProjectsRepositoryDeps {
  getDb: () => DatabaseSync;
  parseJsonValue: <T>(raw: unknown, fallback: T) => T;
}

export function createAlertProjectsRepository({ getDb, parseJsonValue }: AlertProjectsRepositoryDeps) {
  function rowToTheme(row: Record<string, unknown>): Theme {
    return {
      id: String(row.id),
      name: String(row.name),
      html: String(row.html),
      css: String(row.css),
      js: row.js ? String(row.js) : undefined,
      durationMs: Number(row.duration_ms ?? 5000),
      layout: parseJsonValue<Theme["layout"] | undefined>(row.layout_json, undefined),
      visual: parseJsonValue<Theme["visual"] | undefined>(row.visual_json, undefined),
    };
  }

  function rowToAlertProject(row: Record<string, unknown>): AlertProject {
    return AlertProjectSchema.parse({
      id: String(row.id),
      name: String(row.name),
      eventType: String(row.event_type),
      durationMs: Number(row.duration_ms ?? 5000),
      timeline: parseJsonValue(row.timeline_json, undefined),
      canvas: parseJsonValue(row.canvas_json, {}),
      layers: parseJsonValue(row.layers_json, []),
      variations: parseJsonValue(row.variations_json, []),
      chaos: parseJsonValue(row.chaos_json, {}),
      safeMode: Number(row.safe_mode ?? 0) === 1,
      tags: parseJsonValue(row.tags_json, []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  }

  function defaultAlertProjectFromTheme(theme: Theme): AlertProject {
    const now = new Date().toISOString();
    return AlertProjectSchema.parse({
      id: `alert-${theme.id}`,
      name: `${theme.name} Visual`,
      eventType: "follow",
      durationMs: theme.durationMs,
      timeline: {
        durationMs: theme.durationMs,
        fps: 60,
        snapMs: 100,
        zoom: 1,
      },
      chaos: {
        enabled: false,
        intensity: 0.35,
        modifiers: ["shake", "flash", "hue_shift", "scale_punch"],
        legendaryBoost: 0,
      },
      safeMode: false,
      canvas: {
        width: 1920,
        height: 1080,
        background: "transparent",
        backgroundColor: "transparent",
      },
      layers: [
        {
          id: "card",
          type: "shape",
          name: "Alert card",
          x: 660,
          y: 400,
          width: 600,
          height: 220,
          fill: "rgba(91, 140, 255, 0.88)",
          radius: 22,
          startMs: 0,
          endMs: theme.durationMs,
        },
        {
          id: "title",
          type: "text",
          name: "Title",
          text: "{user}",
          x: 700,
          y: 455,
          width: 520,
          height: 72,
          fontSize: 58,
          fontWeight: 900,
          color: "#ffffff",
          startMs: 0,
          endMs: theme.durationMs,
        },
        {
          id: "subtitle",
          type: "text",
          name: "Subtitle",
          text: "Thanks for the {event}!",
          x: 740,
          y: 535,
          width: 440,
          height: 48,
          fontSize: 30,
          fontWeight: 700,
          color: "#dbe6ff",
          startMs: 250,
          endMs: theme.durationMs,
        },
      ],
      tags: ["migration", "starter"],
      createdAt: now,
      updatedAt: now,
    });
  }

  function seedAlertProjects(): void {
    const count = getDb().prepare("SELECT COUNT(*) as c FROM alert_projects").get() as { c: number };
    if (count.c > 0) return;
    const defaultTheme = getTheme("default");
    if (defaultTheme) upsertAlertProject(defaultAlertProjectFromTheme(defaultTheme));
  }

  function getThemes(): Theme[] {
    return (getDb().prepare("SELECT * FROM themes").all() as Array<Record<string, unknown>>).map(rowToTheme);
  }

  function getTheme(id: string): Theme | null {
    const row = getDb().prepare("SELECT * FROM themes WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToTheme(row) : null;
  }

  function upsertTheme(theme: Theme): void {
    getDb().prepare(
      `INSERT INTO themes (id, name, html, css, js, duration_ms, layout_json, visual_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, html=excluded.html, css=excluded.css, js=excluded.js, duration_ms=excluded.duration_ms, layout_json=excluded.layout_json, visual_json=excluded.visual_json`,
    ).run(
      theme.id,
      theme.name,
      theme.html,
      theme.css,
      theme.js ?? null,
      theme.durationMs,
      theme.layout ? JSON.stringify(theme.layout) : null,
      theme.visual ? JSON.stringify(theme.visual) : null,
    );
  }

  function deleteTheme(id: string): void {
    getDb().prepare("DELETE FROM themes WHERE id = ?").run(id);
  }

  function getAlertProjects(): AlertProject[] {
    return (getDb()
      .prepare("SELECT * FROM alert_projects ORDER BY updated_at DESC")
      .all() as Array<Record<string, unknown>>).map(rowToAlertProject);
  }

  function getAlertProject(id: string): AlertProject | null {
    const row = getDb().prepare("SELECT * FROM alert_projects WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToAlertProject(row) : null;
  }

  function upsertAlertProject(project: AlertProject): void {
    const parsed = AlertProjectSchema.parse(project);
    getDb().prepare(
      `INSERT INTO alert_projects
        (id, name, event_type, duration_ms, timeline_json, canvas_json, layers_json, variations_json, chaos_json, safe_mode, tags_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        event_type=excluded.event_type,
        duration_ms=excluded.duration_ms,
        timeline_json=excluded.timeline_json,
        canvas_json=excluded.canvas_json,
        layers_json=excluded.layers_json,
        variations_json=excluded.variations_json,
        chaos_json=excluded.chaos_json,
        safe_mode=excluded.safe_mode,
        tags_json=excluded.tags_json,
        updated_at=excluded.updated_at`,
    ).run(
      parsed.id,
      parsed.name,
      parsed.eventType,
      parsed.durationMs,
      JSON.stringify(parsed.timeline ?? {}),
      JSON.stringify(parsed.canvas),
      JSON.stringify(parsed.layers),
      JSON.stringify(parsed.variations),
      JSON.stringify(parsed.chaos),
      parsed.safeMode ? 1 : 0,
      JSON.stringify(parsed.tags),
      parsed.createdAt,
      parsed.updatedAt,
    );
  }

  function deleteAlertProject(id: string): void {
    getDb().prepare("DELETE FROM alert_projects WHERE id = ?").run(id);
  }

  return {
    seedAlertProjects,
    getThemes,
    getTheme,
    upsertTheme,
    deleteTheme,
    getAlertProjects,
    getAlertProject,
    upsertAlertProject,
    deleteAlertProject,
  };
}
