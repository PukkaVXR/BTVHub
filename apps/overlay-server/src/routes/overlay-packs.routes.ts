import type { AlertProject, AlertRule, Theme, WidgetConfig } from "@btv/shared";
import {
  getAlertProjects,
  getAlertRules,
  getSetting,
  getThemes,
  getWidgets,
  setSetting,
  upsertAlertProject,
  upsertAlertRule,
  upsertTheme,
  upsertWidget,
} from "../db.js";
import type { ObsBrowserSourceCanvas, ObsBrowserSourceLayout } from "../schemas/obs.schema.js";
import type { RouteModule } from "./types.js";

const OVERLAY_PACKS_KEY = "overlay_packs";
const BROWSER_SOURCE_LAYOUTS_KEY = "obs_browser_source_layouts";
const OVERLAY_THEME_KEY = "overlay_theme";
const PACK_VERSION = 1;

interface OverlayPack {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  snapshot: OverlayPackSnapshot;
}

interface OverlayPackExport {
  format: "btv.overlay-pack";
  version: 1;
  exportedAt: string;
  pack: OverlayPack;
}

interface OverlayPackSummary {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  counts: {
    alertProjects: number;
    alertRules: number;
    themes: number;
    widgets: number;
    browserSourceLayouts: number;
    overlayTheme: boolean;
  };
}

interface OverlayPackSnapshot {
  alertProjects: AlertProject[];
  alertRules: AlertRule[];
  themes: Theme[];
  widgets: WidgetConfig[];
  browserSourceLayouts?: {
    canvas: ObsBrowserSourceCanvas;
    layouts: ObsBrowserSourceLayout[];
  };
  overlayTheme?: unknown;
}

export const registerOverlayPacksRoutes: RouteModule = (app) => {
  app.get("/api/overlay-packs", async () => ({
    packs: readOverlayPacks().map(packSummary),
  }));

  app.get("/api/overlay-packs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const pack = readOverlayPacks().find((item) => item.id === id);
    if (!pack) return reply.status(404).send({ error: "Overlay pack not found" });
    return pack;
  });

  app.post("/api/overlay-packs", async (req, reply) => {
    const body = req.body as { name?: string; description?: string } | undefined;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return reply.status(400).send({ error: "Pack name is required" });

    const now = new Date().toISOString();
    const pack: OverlayPack = {
      id: `pack-${Date.now()}`,
      name,
      description: body?.description?.trim() || undefined,
      version: PACK_VERSION,
      createdAt: now,
      updatedAt: now,
      snapshot: createSnapshot(),
    };
    const packs = [pack, ...readOverlayPacks()];
    writeOverlayPacks(packs);
    return { ok: true, pack: packSummary(pack) };
  });

  app.post("/api/overlay-packs/:id/apply", async (req, reply) => {
    const { id } = req.params as { id: string };
    const pack = readOverlayPacks().find((item) => item.id === id);
    if (!pack) return reply.status(404).send({ error: "Overlay pack not found" });

    applySnapshot(pack.snapshot);
    return { ok: true, pack: packSummary(pack) };
  });

  app.get("/api/overlay-packs/:id/export", async (req, reply) => {
    const { id } = req.params as { id: string };
    const pack = readOverlayPacks().find((item) => item.id === id);
    if (!pack) return reply.status(404).send({ error: "Overlay pack not found" });

    const payload: OverlayPackExport = {
      format: "btv.overlay-pack",
      version: 1,
      exportedAt: new Date().toISOString(),
      pack,
    };
    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="${safeFileName(pack.name)}.btv-overlay-pack.json"`)
      .send(payload);
  });

  app.post("/api/overlay-packs/import", async (req, reply) => {
    const body = req.body as { pack?: OverlayPackExport | OverlayPack } | undefined;
    const imported = normalizeImportedPack(body?.pack);
    if (!imported) return reply.status(400).send({ error: "Valid overlay pack export is required" });

    const now = new Date().toISOString();
    const pack: OverlayPack = {
      ...imported,
      id: `pack-${Date.now()}`,
      name: imported.name.endsWith(" (imported)") ? imported.name : `${imported.name} (imported)`,
      createdAt: now,
      updatedAt: now,
    };
    writeOverlayPacks([pack, ...readOverlayPacks()]);
    return { ok: true, pack: packSummary(pack) };
  });

  app.delete("/api/overlay-packs/:id", async (req) => {
    const { id } = req.params as { id: string };
    writeOverlayPacks(readOverlayPacks().filter((pack) => pack.id !== id));
    return { ok: true };
  });
};

function createSnapshot(): OverlayPackSnapshot {
  return {
    alertProjects: getAlertProjects(),
    alertRules: getAlertRules(),
    themes: getThemes(),
    widgets: getWidgets(),
    browserSourceLayouts: readBrowserSourceLayouts(),
    overlayTheme: readSettingJson(OVERLAY_THEME_KEY),
  };
}

function applySnapshot(snapshot: OverlayPackSnapshot): void {
  for (const theme of snapshot.themes ?? []) upsertTheme(theme);
  for (const project of snapshot.alertProjects ?? []) upsertAlertProject(project);
  for (const rule of snapshot.alertRules ?? []) upsertAlertRule(rule);
  for (const widget of snapshot.widgets ?? []) upsertWidget(widget);
  if (snapshot.browserSourceLayouts) {
    setSetting(BROWSER_SOURCE_LAYOUTS_KEY, JSON.stringify(snapshot.browserSourceLayouts));
  }
  if (snapshot.overlayTheme) {
    setSetting(OVERLAY_THEME_KEY, JSON.stringify(snapshot.overlayTheme));
  }
}

function readOverlayPacks(): OverlayPack[] {
  const raw = getSetting(OVERLAY_PACKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => normalizePack(item));
  } catch {
    return [];
  }
}

function writeOverlayPacks(packs: OverlayPack[]): void {
  setSetting(OVERLAY_PACKS_KEY, JSON.stringify(packs));
}

function normalizePack(item: unknown): OverlayPack[] {
  if (!item || typeof item !== "object") return [];
  const raw = item as Partial<OverlayPack>;
  if (!raw.id || !raw.name || !raw.snapshot) return [];
  return [{
    id: String(raw.id),
    name: String(raw.name),
    description: raw.description ? String(raw.description) : undefined,
    version: Number(raw.version ?? PACK_VERSION),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()),
    snapshot: {
      alertProjects: Array.isArray(raw.snapshot.alertProjects) ? raw.snapshot.alertProjects : [],
      alertRules: Array.isArray(raw.snapshot.alertRules) ? raw.snapshot.alertRules : [],
      themes: Array.isArray(raw.snapshot.themes) ? raw.snapshot.themes : [],
      widgets: Array.isArray(raw.snapshot.widgets) ? raw.snapshot.widgets : [],
      browserSourceLayouts: raw.snapshot.browserSourceLayouts,
      overlayTheme: raw.snapshot.overlayTheme,
    },
  }];
}

function normalizeImportedPack(item: unknown): OverlayPack | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Partial<OverlayPackExport> & Partial<OverlayPack>;
  const candidate = raw.format === "btv.overlay-pack" ? raw.pack : raw;
  return normalizePack(candidate)[0] ?? null;
}

function readBrowserSourceLayouts(): OverlayPackSnapshot["browserSourceLayouts"] | undefined {
  const parsed = readSettingJson(BROWSER_SOURCE_LAYOUTS_KEY) as OverlayPackSnapshot["browserSourceLayouts"];
  if (!parsed?.canvas || !Array.isArray(parsed.layouts)) return undefined;
  return parsed;
}

function readSettingJson(key: string): unknown {
  const raw = getSetting(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function packSummary(pack: OverlayPack): OverlayPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
    counts: {
      alertProjects: pack.snapshot.alertProjects.length,
      alertRules: pack.snapshot.alertRules.length,
      themes: pack.snapshot.themes.length,
      widgets: pack.snapshot.widgets.length,
      browserSourceLayouts: pack.snapshot.browserSourceLayouts?.layouts.length ?? 0,
      overlayTheme: Boolean(pack.snapshot.overlayTheme),
    },
  };
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "overlay-pack";
}
