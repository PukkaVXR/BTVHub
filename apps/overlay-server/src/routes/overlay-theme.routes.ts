import { getSetting, setSetting } from "../db.js";
import type { RouteModule } from "./types.js";

const OVERLAY_THEME_KEY = "overlay_theme";

interface OverlayThemeConfig {
  name: string;
  fontFamily: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  panelBackground: string;
  itemBackground: string;
  borderColor: string;
  borderRadius: number;
  shadow: number;
  glow: number;
  pulse: boolean;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  widgets: Record<OverlayThemeTarget, OverlayThemeWidgetConfig>;
}

type OverlayThemeTarget = "alerts" | "chat" | "goals" | "ticker" | "eventList" | "nowPlaying";

interface OverlayThemeWidgetConfig {
  enabled: boolean;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  panelBackground?: string;
  itemBackground?: string;
  borderColor?: string;
  borderRadius?: number;
  shadow?: number;
  glow?: number;
  pulse?: boolean;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
}

const THEME_TARGETS: OverlayThemeTarget[] = ["alerts", "chat", "goals", "ticker", "eventList", "nowPlaying"];

const DEFAULT_THEME: OverlayThemeConfig = {
  name: "BTV Default",
  fontFamily: '"Segoe UI", system-ui, sans-serif',
  textColor: "#ffffff",
  mutedColor: "rgba(255,255,255,0.72)",
  accentColor: "#9147ff",
  panelBackground: "rgba(0,0,0,0.6)",
  itemBackground: "rgba(255,255,255,0.07)",
  borderColor: "rgba(255,255,255,0.12)",
  borderRadius: 12,
  shadow: 35,
  glow: 0,
  pulse: false,
  backgroundImage: "",
  backgroundOpacity: 0.18,
  backgroundBlur: 0,
  widgets: {
    alerts: { enabled: true },
    chat: { enabled: true },
    goals: { enabled: true },
    ticker: { enabled: true },
    eventList: { enabled: true },
    nowPlaying: { enabled: true },
  },
};

export const registerOverlayThemeRoutes: RouteModule = (app) => {
  app.get("/api/overlay-theme", async () => readOverlayTheme());

  app.put("/api/overlay-theme", async (req) => {
    const next = normalizeOverlayTheme(req.body as Partial<OverlayThemeConfig> | undefined);
    setSetting(OVERLAY_THEME_KEY, JSON.stringify(next));
    return { ok: true, theme: next };
  });
};

function readOverlayTheme(): OverlayThemeConfig {
  const raw = getSetting(OVERLAY_THEME_KEY);
  if (!raw) return DEFAULT_THEME;
  try {
    return normalizeOverlayTheme(JSON.parse(raw) as Partial<OverlayThemeConfig>);
  } catch {
    return DEFAULT_THEME;
  }
}

function normalizeOverlayTheme(input?: Partial<OverlayThemeConfig>): OverlayThemeConfig {
  return {
    name: stringValue(input?.name, DEFAULT_THEME.name).slice(0, 80),
    fontFamily: stringValue(input?.fontFamily, DEFAULT_THEME.fontFamily).slice(0, 160),
    textColor: cssValue(input?.textColor, DEFAULT_THEME.textColor),
    mutedColor: cssValue(input?.mutedColor, DEFAULT_THEME.mutedColor),
    accentColor: cssValue(input?.accentColor, DEFAULT_THEME.accentColor),
    panelBackground: cssValue(input?.panelBackground, DEFAULT_THEME.panelBackground),
    itemBackground: cssValue(input?.itemBackground, DEFAULT_THEME.itemBackground),
    borderColor: cssValue(input?.borderColor, DEFAULT_THEME.borderColor),
    borderRadius: clamp(input?.borderRadius, DEFAULT_THEME.borderRadius, 0, 48),
    shadow: clamp(input?.shadow, DEFAULT_THEME.shadow, 0, 90),
    glow: clamp(input?.glow, DEFAULT_THEME.glow, 0, 90),
    pulse: input?.pulse === true,
    backgroundImage: normalizeAssetPath(input?.backgroundImage),
    backgroundOpacity: clampFloat(input?.backgroundOpacity, DEFAULT_THEME.backgroundOpacity, 0, 1),
    backgroundBlur: clamp(input?.backgroundBlur, DEFAULT_THEME.backgroundBlur, 0, 40),
    widgets: normalizeWidgets(input?.widgets),
  };
}

function normalizeWidgets(input: unknown): OverlayThemeConfig["widgets"] {
  const raw = input && typeof input === "object" ? input as Record<string, Partial<OverlayThemeWidgetConfig>> : {};
  return Object.fromEntries(THEME_TARGETS.map((target) => {
    const item = raw[target] ?? {};
    return [target, {
      enabled: item.enabled !== false,
      textColor: optionalCssValue(item.textColor),
      mutedColor: optionalCssValue(item.mutedColor),
      accentColor: optionalCssValue(item.accentColor),
      panelBackground: optionalCssValue(item.panelBackground),
      itemBackground: optionalCssValue(item.itemBackground),
      borderColor: optionalCssValue(item.borderColor),
      borderRadius: optionalClamp(item.borderRadius, 0, 48),
      shadow: optionalClamp(item.shadow, 0, 90),
      glow: optionalClamp(item.glow, 0, 90),
      pulse: typeof item.pulse === "boolean" ? item.pulse : undefined,
      backgroundImage: item.backgroundImage ? normalizeAssetPath(item.backgroundImage) : undefined,
      backgroundOpacity: optionalClampFloat(item.backgroundOpacity, 0, 1),
      backgroundBlur: optionalClamp(item.backgroundBlur, 0, 40),
    }];
  })) as OverlayThemeConfig["widgets"];
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cssValue(value: unknown, fallback: string): string {
  const raw = stringValue(value, fallback);
  return /[;{}<>]/.test(raw) ? fallback : raw;
}

function optionalCssValue(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return /[;{}<>]/.test(value) ? undefined : value.trim();
}

function normalizeAssetPath(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("assets/")) return `/${trimmed}`;
  if (trimmed.startsWith("media/")) return `/assets/${trimmed}`;
  if (trimmed.startsWith("/assets/")) return trimmed;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `/assets/media/${trimmed}`;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.max(min, Math.min(max, number)));
}

function optionalClamp(value: unknown, min: number, max: number): number | undefined {
  if (value == null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.round(Math.max(min, Math.min(max, number)));
}

function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function optionalClampFloat(value: unknown, min: number, max: number): number | undefined {
  if (value == null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(min, Math.min(max, number));
}
