import {
  ensureObsBrowserSources,
  getCurrentObsScene,
  getObsBrowserSourceStatuses,
  listObsSceneSources,
  listObsScenes,
  runObsSourceMotion,
  setObsInputSettings,
  setObsScene,
  setObsSourceTransform,
  setObsSourceVisible,
  setObsText,
} from "../obs-client.js";
import { getSetting, setSetting } from "../db.js";
import { EXPECTED_OVERLAYS } from "../overlay-definitions.js";
import { getOverlayOrigin } from "../server-urls.js";
import type {
  ObsBrowserSourceLayout,
  ObsBrowserSourceLayoutApplyBody,
  ObsBrowserSourceCanvas,
  ObsBrowserSourceLayoutsBody,
  ObsInputSettingsBody,
  ObsSceneBody,
  ObsSourceMotionBody,
  ObsSourceVisibilityBody,
  ObsTextBody,
} from "../schemas/obs.schema.js";
import type { RouteModule } from "./types.js";

const BROWSER_SOURCE_LAYOUTS_KEY = "obs_browser_source_layouts";
const OBS_CANVAS_WIDTH = 1920;
const OBS_CANVAS_HEIGHT = 1080;
const DEFAULT_CANVAS: ObsBrowserSourceCanvas = { width: OBS_CANVAS_WIDTH, height: OBS_CANVAS_HEIGHT };

interface BrowserSourceLayoutState {
  canvas: ObsBrowserSourceCanvas;
  layouts: ObsBrowserSourceLayout[];
}

export const registerObsRoutes: RouteModule = (app) => {
  app.get("/api/obs/browser-sources", async (_req, reply) => {
    const sources = await getObsBrowserSourceStatuses(EXPECTED_OVERLAYS, getOverlayOrigin());
    if (!sources) {
      return reply.status(503).send(actionError("OBS_DISCONNECTED", "OBS Offline", "Could not inspect OBS browser sources"));
    }
    return { ok: true, sources };
  });

  app.post("/api/obs/browser-sources/ensure", async (req, reply) => {
    const body = req.body as { sceneName?: string } | undefined;
    const result = await ensureObsBrowserSources(EXPECTED_OVERLAYS, getOverlayOrigin(), body?.sceneName);
    if (!result) {
      return reply.status(503).send(actionError("OBS_DISCONNECTED", "OBS Offline", "Could not create or update OBS browser sources"));
    }
    return {
      ok: result.sources.every((source) => source.configured && source.correctUrl && source.action !== "failed"),
      ...result,
    };
  });

  app.get("/api/obs/browser-source-layouts", async () => {
    const state = getBrowserSourceLayoutState();
    return {
      ok: true,
      canvas: state.canvas,
      layouts: state.layouts,
    };
  });

  app.put("/api/obs/browser-source-layouts", async (req, reply) => {
    const body = req.body as ObsBrowserSourceLayoutsBody | undefined;
    const canvas = normalizeBrowserSourceCanvas(body?.canvas);
    const layouts = normalizeBrowserSourceLayouts(body?.layouts, canvas);
    if (!layouts.length) {
      return reply.status(400).send(actionError("LAYOUTS_REQUIRED", "No Layouts", "At least one browser source layout is required"));
    }
    saveBrowserSourceLayoutState({ canvas, layouts });
    const state = getBrowserSourceLayoutState();
    return {
      ok: true,
      canvas: state.canvas,
      layouts: state.layouts,
    };
  });

  app.post("/api/obs/browser-source-layouts/apply", async (req, reply) => {
    const body = req.body as ObsBrowserSourceLayoutApplyBody | undefined;
    const existingState = getBrowserSourceLayoutState();
    const canvas = normalizeBrowserSourceCanvas(body?.canvas ?? existingState.canvas);
    const layouts = normalizeBrowserSourceLayouts(body?.layouts, canvas);
    const activeLayouts = layouts.length ? layouts : existingState.layouts;
    saveBrowserSourceLayoutState({ canvas, layouts: activeLayouts });

    const ensured = await ensureObsBrowserSources(EXPECTED_OVERLAYS, getOverlayOrigin(), body?.sceneName);
    if (!ensured) {
      return reply.status(503).send(actionError("OBS_DISCONNECTED", "OBS Offline", "Could not create or update OBS browser sources"));
    }

    const layoutById = new Map(activeLayouts.map((layout) => [layout.id, layout]));
    const sources = [];
    for (const source of ensured.sources) {
      const layout = layoutById.get(source.id);
      if (!layout || !source.sourceName) {
        sources.push({ ...source, layoutApplied: false });
        continue;
      }

      const inputOk = await setObsInputSettings(
        source.sourceName,
        browserSourceSettings(source.expectedUrl, layout, source.id),
        true,
      );
      const transformOk = await setObsSourceTransform(ensured.sceneName, source.sourceName, {
        positionX: layout.x,
        positionY: layout.y,
        rotation: layout.rotation,
        scaleX: 1,
        scaleY: 1,
        cropBottom: layout.cropBottom,
        cropLeft: layout.cropLeft,
        cropRight: layout.cropRight,
        cropTop: layout.cropTop,
      });
      const visibleOk = await setObsSourceVisible(ensured.sceneName, source.sourceName, layout.visible);
      sources.push({
        ...source,
        layout,
        layoutApplied: inputOk && transformOk && visibleOk,
      });
    }

    return {
      ok: sources.every((source) => source.layoutApplied),
      sceneName: ensured.sceneName,
      canvas,
      layouts: getBrowserSourceLayoutState().layouts,
      sources,
    };
  });

  app.get("/api/obs/scenes", async (_req, reply) => {
    const scenes = await listObsScenes();
    if (!scenes) {
      return reply.status(503).send({
        ok: false,
        code: "OBS_DISCONNECTED",
        title: "OBS Offline",
        message: "Could not reach OBS WebSocket",
        color: "#eb0400",
        icon: "alert-triangle",
        retryable: true,
        scenes: [],
      });
    }
    return { ok: true, currentScene: await getCurrentObsScene(), scenes };
  });

  app.get("/api/obs/scenes/:sceneName/sources", async (req, reply) => {
    const { sceneName } = req.params as { sceneName: string };
    const sources = await listObsSceneSources(sceneName);
    if (!sources) {
      return reply.status(503).send({
        ok: false,
        code: "OBS_SCENE_UNAVAILABLE",
        title: "Scene Unavailable",
        message: `Could not read sources for ${sceneName}`,
        color: "#eb0400",
        icon: "alert-triangle",
        retryable: true,
        sources: [],
      });
    }
    return { ok: true, sceneName, sources };
  });

  app.post("/api/actions/obs/scene", async (req, reply) => {
    const sceneName = (req.body as ObsSceneBody).sceneName?.trim();
    if (!sceneName) return reply.status(400).send(actionError("SCENE_REQUIRED", "No Scene", "sceneName is required"));
    const ok = await setObsScene(sceneName);
    return reply.status(ok ? 200 : 503).send({
      ok,
      code: ok ? "OBS_SCENE_CHANGED" : "OBS_DISCONNECTED",
      title: ok ? "Scene Live" : "OBS Offline",
      message: ok ? `Switched to ${sceneName}` : "Could not reach OBS WebSocket",
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "check" : "alert-triangle",
      retryable: !ok,
      state: { obsConnected: ok, scene: ok ? sceneName : undefined },
    });
  });

  app.post("/api/actions/obs/source-visibility", async (req, reply) => {
    const body = req.body as ObsSourceVisibilityBody;
    const sceneName = body.sceneName?.trim();
    const sourceName = body.sourceName?.trim();
    if (!sceneName || !sourceName || typeof body.visible !== "boolean") {
      return reply.status(400).send(actionError("SOURCE_VISIBILITY_REQUIRED", "Missing Source", "sceneName, sourceName, and visible are required"));
    }
    const ok = await setObsSourceVisible(sceneName, sourceName, body.visible);
    return reply.status(ok ? 200 : 503).send({
      ok,
      code: ok ? "OBS_SOURCE_VISIBILITY_CHANGED" : "OBS_SOURCE_UNAVAILABLE",
      title: ok ? "Source Updated" : "Source Unavailable",
      message: ok ? `${sourceName} is ${body.visible ? "visible" : "hidden"}` : `Could not update ${sourceName} in ${sceneName}`,
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "eye" : "alert-triangle",
      retryable: !ok,
      state: { obsConnected: ok, sceneName, sourceName, visible: body.visible },
    });
  });

  app.post("/api/actions/obs/source-motion", async (req, reply) => {
    const body = req.body as ObsSourceMotionBody;
    const sceneName = body.sceneName?.trim();
    const sourceName = body.sourceName?.trim();
    if (!sceneName || !sourceName) return reply.status(400).send(actionError("SOURCE_MOTION_REQUIRED", "Missing Source", "sceneName and sourceName are required"));
    const ok = await runObsSourceMotion({ ...body, sceneName, sourceName });
    return reply.status(ok ? 200 : 503).send({
      ok,
      code: ok ? "OBS_SOURCE_MOTION_COMPLETE" : "OBS_SOURCE_MOTION_FAILED",
      title: ok ? "Motion Complete" : "Motion Failed",
      message: ok ? `${sourceName} ${body.mode ?? "set"} motion completed` : `Could not move ${sourceName} in ${sceneName}`,
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "move" : "alert-triangle",
      retryable: !ok,
      state: { obsConnected: ok, sceneName, sourceName, mode: body.mode ?? "set" },
    });
  });

  app.post("/api/actions/obs/text", async (req, reply) => {
    const body = req.body as ObsTextBody;
    const inputName = body.inputName?.trim();
    if (!inputName || body.text == null) return reply.status(400).send(actionError("TEXT_INPUT_REQUIRED", "Missing Text", "inputName and text are required"));
    const ok = await setObsText(inputName, body.text);
    return reply.status(ok ? 200 : 503).send(actionResponse(ok, "OBS_TEXT_UPDATED", "OBS_INPUT_UNAVAILABLE", "Text Updated", "Input Unavailable", ok ? `${inputName} updated` : `Could not update ${inputName}`, { obsConnected: ok, inputName }));
  });

  app.post("/api/actions/obs/input-settings", async (req, reply) => {
    const body = req.body as ObsInputSettingsBody;
    const inputName = body.inputName?.trim();
    if (!inputName || !body.inputSettings || typeof body.inputSettings !== "object") return reply.status(400).send(actionError("INPUT_SETTINGS_REQUIRED", "Missing Settings", "inputName and inputSettings are required"));
    const ok = await setObsInputSettings(inputName, body.inputSettings, body.overlay ?? true);
    return reply.status(ok ? 200 : 503).send(actionResponse(ok, "OBS_INPUT_SETTINGS_UPDATED", "OBS_INPUT_UNAVAILABLE", "Input Updated", "Input Unavailable", ok ? `${inputName} updated` : `Could not update ${inputName}`, { obsConnected: ok, inputName }));
  });
};

function actionError(code: string, title: string, message: string) {
  return { ok: false, code, title, message, color: "#eb0400", icon: "alert-triangle", retryable: false };
}

function actionResponse(ok: boolean, okCode: string, failCode: string, okTitle: string, failTitle: string, message: string, state: Record<string, unknown>) {
  return {
    ok,
    code: ok ? okCode : failCode,
    title: ok ? okTitle : failTitle,
    message,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "type" : "alert-triangle",
    retryable: !ok,
    state,
  };
}

function getBrowserSourceLayoutState(): BrowserSourceLayoutState {
  const state = readSavedBrowserSourceLayoutState();
  return {
    canvas: state.canvas,
    layouts: normalizeBrowserSourceLayouts(state.layouts, state.canvas),
  };
}

function readSavedBrowserSourceLayoutState(): BrowserSourceLayoutState {
  const raw = getSetting(BROWSER_SOURCE_LAYOUTS_KEY);
  if (!raw) return { canvas: DEFAULT_CANVAS, layouts: defaultBrowserSourceLayouts(DEFAULT_CANVAS) };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { canvas: DEFAULT_CANVAS, layouts: parsed as ObsBrowserSourceLayout[] };
    }
    if (parsed && typeof parsed === "object") {
      const state = parsed as Partial<BrowserSourceLayoutState>;
      const canvas = normalizeBrowserSourceCanvas(state.canvas);
      return {
        canvas,
        layouts: Array.isArray(state.layouts) ? state.layouts : defaultBrowserSourceLayouts(canvas),
      };
    }
    return { canvas: DEFAULT_CANVAS, layouts: defaultBrowserSourceLayouts(DEFAULT_CANVAS) };
  } catch {
    return { canvas: DEFAULT_CANVAS, layouts: defaultBrowserSourceLayouts(DEFAULT_CANVAS) };
  }
}

function saveBrowserSourceLayoutState(state: BrowserSourceLayoutState): void {
  const canvas = normalizeBrowserSourceCanvas(state.canvas);
  setSetting(BROWSER_SOURCE_LAYOUTS_KEY, JSON.stringify({
    canvas,
    layouts: normalizeBrowserSourceLayouts(state.layouts, canvas),
  }));
}

function defaultBrowserSourceLayouts(canvas: ObsBrowserSourceCanvas): ObsBrowserSourceLayout[] {
  const sx = canvas.width / OBS_CANVAS_WIDTH;
  const sy = canvas.height / OBS_CANVAS_HEIGHT;
  return [
    makeLayout("alerts", 0, 0, canvas.width, canvas.height),
    makeLayout("chat", 24 * sx, 620 * sy, 460 * sx, 420 * sy, "rounded", 18),
    makeLayout("goals", 1460 * sx, 40 * sy, 420 * sx, 140 * sy, "rounded", 18),
    makeLayout("ticker", 40 * sx, 40 * sy, 480 * sx, 220 * sy, "rounded", 18),
    makeLayout("event-list", 1460 * sx, 200 * sy, 420 * sx, 460 * sy, "rounded", 18),
    makeLayout("now-playing", 1460 * sx, 900 * sy, 420 * sx, 140 * sy, "rounded", 18),
  ];
}

function makeLayout(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  shape: ObsBrowserSourceLayout["shape"] = "rectangle",
  borderRadius = 0,
): ObsBrowserSourceLayout {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    shape,
    borderRadius,
    cropTop: 0,
    cropRight: 0,
    cropBottom: 0,
    cropLeft: 0,
    opacity: 1,
    visible: true,
    locked: false,
  };
}

function normalizeBrowserSourceLayouts(layouts: ObsBrowserSourceLayout[] | undefined, canvas: ObsBrowserSourceCanvas): ObsBrowserSourceLayout[] {
  const savedById = new Map((layouts ?? []).map((layout) => [layout.id, layout]));
  return defaultBrowserSourceLayouts(canvas).map((fallback) => {
    const saved = savedById.get(fallback.id);
    return {
      ...fallback,
      ...saved,
      id: fallback.id,
      x: clamp(saved?.x, fallback.x, 0, canvas.width),
      y: clamp(saved?.y, fallback.y, 0, canvas.height),
      width: clamp(saved?.width, fallback.width, 32, canvas.width),
      height: clamp(saved?.height, fallback.height, 32, canvas.height),
      rotation: clamp(saved?.rotation, fallback.rotation, -360, 360),
      shape: saved?.shape === "circle" || saved?.shape === "rounded" || saved?.shape === "rectangle" ? saved.shape : fallback.shape,
      borderRadius: clamp(saved?.borderRadius, fallback.borderRadius, 0, 540),
      cropTop: clamp(saved?.cropTop, fallback.cropTop, 0, canvas.height),
      cropRight: clamp(saved?.cropRight, fallback.cropRight, 0, canvas.width),
      cropBottom: clamp(saved?.cropBottom, fallback.cropBottom, 0, canvas.height),
      cropLeft: clamp(saved?.cropLeft, fallback.cropLeft, 0, canvas.width),
      opacity: clampFloat(saved?.opacity, fallback.opacity, 0.05, 1),
      visible: typeof saved?.visible === "boolean" ? saved.visible : fallback.visible,
      locked: typeof saved?.locked === "boolean" ? saved.locked : fallback.locked,
    };
  });
}

function normalizeBrowserSourceCanvas(canvas?: Partial<ObsBrowserSourceCanvas>): ObsBrowserSourceCanvas {
  return {
    width: clamp(canvas?.width, DEFAULT_CANVAS.width, 320, 7680),
    height: clamp(canvas?.height, DEFAULT_CANVAS.height, 180, 4320),
  };
}

function browserSourceSettings(url: string, layout: ObsBrowserSourceLayout, overlayId: string): Record<string, unknown> {
  return {
    url,
    width: Math.round(layout.width),
    height: Math.round(layout.height),
    shutdown: false,
    css: browserSourceCss(layout, overlayId),
  };
}

function browserSourceCss(layout: ObsBrowserSourceLayout, overlayId: string): string {
  const radius = layout.shape === "circle" ? "9999px" : layout.shape === "rounded" ? `${Math.round(layout.borderRadius)}px` : "0";
  const baseCss = [
    "html, body {",
    "  width: 100%;",
    "  height: 100%;",
    "  background-color: rgba(0, 0, 0, 0);",
    "  margin: 0;",
    "  overflow: hidden;",
    `  border-radius: ${radius};`,
    `  clip-path: inset(0 round ${radius});`,
    `  opacity: ${layout.opacity};`,
    "}",
  ];
  if (overlayId === "alerts") {
    return [
      ...baseCss,
      "",
      alertCanvasCss(layout),
    ].join("\n");
  }
  return [
    ...baseCss,
    "",
    localWidgetCss(overlayId),
  ].join("\n");
}

function alertCanvasCss(layout: ObsBrowserSourceLayout): string {
  const scaleX = Math.max(0.01, layout.width / OBS_CANVAS_WIDTH);
  const scaleY = Math.max(0.01, layout.height / OBS_CANVAS_HEIGHT);
  return [
    "#alerts, #media-layer, #effect-layer {",
    "  width: 100vw !important;",
    "  height: 100vh !important;",
    "}",
    "#alerts .btv-visual-alert-root {",
    "  position: fixed !important;",
    "  left: 0 !important;",
    "  top: 0 !important;",
    `  transform: scale(${scaleX}, ${scaleY}) !important;`,
    "  transform-origin: top left !important;",
    "}",
  ].join("\n");
}

function localWidgetCss(overlayId: string): string {
  const widgetSelector = {
    chat: ".chat-widget",
    goals: ".goal-widget",
    ticker: ".ticker-widget",
    "event-list": ".event-list-widget",
    "now-playing": ".now-playing-widget",
  }[overlayId];
  if (!widgetSelector) return "";
  const chatExtras = overlayId === "chat" ? responsiveChatCss() : "";
  const nowPlayingExtras = overlayId === "now-playing" ? responsiveNowPlayingCss() : "";
  const goalExtras = overlayId === "goals" ? responsiveGoalCss() : "";
  const tickerExtras = overlayId === "ticker" ? responsiveTickerCss() : "";
  const eventListExtras = overlayId === "event-list" ? responsiveEventListCss() : "";
  return [
    "body {",
    "  position: relative;",
    "}",
    "",
    `${widgetSelector} {`,
    "  position: absolute !important;",
    "  left: 0 !important;",
    "  top: 0 !important;",
    "  right: auto !important;",
    "  bottom: auto !important;",
    "  width: 100% !important;",
    "  height: 100% !important;",
    "  max-width: none !important;",
    "  max-height: none !important;",
    "  margin: 0 !important;",
    "}",
    chatExtras.trimEnd(),
    nowPlayingExtras.trimEnd(),
    goalExtras.trimEnd(),
    tickerExtras.trimEnd(),
    eventListExtras.trimEnd(),
  ].filter(Boolean).join("\n");
}

function responsiveNowPlayingCss(): string {
  return [
    ".now-playing-widget {",
    "  min-width: 0 !important;",
    "  display: flex !important;",
    "  align-items: center !important;",
    "  gap: clamp(8px, 3vw, 36px) !important;",
    "  padding: clamp(8px, 4vh, 42px) clamp(10px, 4vw, 56px) !important;",
    "}",
    ".now-playing-widget .np-art {",
    "  width: min(28vw, 72vh) !important;",
    "  height: min(28vw, 72vh) !important;",
    "  min-width: 42px !important;",
    "  min-height: 42px !important;",
    "  border-radius: clamp(6px, 1.8vh, 22px) !important;",
    "}",
    ".now-playing-widget .np-info {",
    "  min-width: 0 !important;",
    "  flex: 1 1 auto !important;",
    "}",
    ".now-playing-widget .np-title {",
    "  font-size: clamp(14px, 15vh, 72px) !important;",
    "  line-height: 1.05 !important;",
    "  overflow: hidden !important;",
    "  text-overflow: ellipsis !important;",
    "  white-space: nowrap !important;",
    "}",
    ".now-playing-widget .np-artist, .now-playing-widget .np-idle {",
    "  font-size: clamp(12px, 10vh, 48px) !important;",
    "  line-height: 1.08 !important;",
    "  overflow: hidden !important;",
    "  text-overflow: ellipsis !important;",
    "  white-space: nowrap !important;",
    "}",
  ].join("\n");
}

function responsiveGoalCss(): string {
  return [
    ".goal-widget { padding: clamp(8px, 5vh, 44px) !important; }",
    ".goal-header { font-size: clamp(12px, 12vh, 56px) !important; margin-bottom: clamp(6px, 3vh, 24px) !important; }",
    ".goal-track { height: clamp(14px, 20vh, 90px) !important; border-radius: 999px !important; }",
  ].join("\n");
}

function responsiveTickerCss(): string {
  return [
    ".ticker-widget { padding: clamp(8px, 4vh, 36px) clamp(10px, 4vw, 44px) !important; overflow: hidden !important; }",
    ".ticker-widget h3 { font-size: clamp(11px, 8vh, 38px) !important; margin-bottom: clamp(4px, 2vh, 18px) !important; }",
    ".ticker-widget ul { font-size: clamp(12px, 8vh, 42px) !important; }",
    ".ticker-widget li { padding: clamp(3px, 1.8vh, 14px) 0 !important; }",
  ].join("\n");
}

function responsiveEventListCss(): string {
  return [
    ".event-list-widget { padding: clamp(8px, 3vh, 32px) !important; overflow: hidden !important; }",
    ".event-list-widget h3 { font-size: clamp(11px, 5vh, 28px) !important; margin-bottom: clamp(5px, 2vh, 18px) !important; }",
    ".event-list-widget ul { gap: clamp(4px, 1.5vh, 14px) !important; }",
    ".event-list-widget li { grid-template-columns: minmax(58px, 24%) minmax(0, 1fr) !important; padding: clamp(5px, 1.8vh, 16px) clamp(6px, 2vw, 18px) !important; }",
    ".event-list-widget strong { font-size: clamp(12px, 4.5vh, 32px) !important; }",
    ".event-list-widget em, .event-list-type { font-size: clamp(10px, 3.2vh, 22px) !important; }",
  ].join("\n");
}

function responsiveChatCss(): string {
  return [
    ".chat-widget { justify-content: flex-end !important; padding: clamp(6px, 2vh, 22px) !important; }",
    ".chat-line { font-size: clamp(12px, 5vh, 38px) !important; padding: clamp(5px, 1.8vh, 16px) clamp(8px, 2vw, 24px) !important; }",
  ].join("\n");
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(min, Math.min(max, n)));
}

function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
