import type { ApiNinjaButtonInput } from "../../lib/apiNinja";
import { resolveOverlayOrigin } from "../../lib/serverUrls";
import type {
  StreamDeckBehaviorValues,
  StreamDeckBuilderAction,
  StreamDeckDesignValues,
  StreamDeckGeneratedRequest,
} from "./streamDeckBuilderTypes";

const STREAM_DECK_API_BASE = `${resolveOverlayOrigin()}/api`;

export function buildStreamDeckRequest(action: StreamDeckBuilderAction, values: StreamDeckBehaviorValues): StreamDeckGeneratedRequest {
  const postHeaders = { "Content-Type": "application/json" };
  const warnings: string[] = [];

  switch (action) {
    case "macro":
      if (!values.macroId) warnings.push("Select or create a macro before exporting a final button.");
      return post(`${STREAM_DECK_API_BASE}/actions/macro/${encodeURIComponent(values.macroId || "macro-id")}`, {}, ["Runs one saved macro from the Macros page."], warnings);
    case "sourceGroup":
      if (!values.sourceGroupId) warnings.push("Select or create an activity layout before exporting a final button.");
      return post(`${STREAM_DECK_API_BASE}/actions/source-group/${encodeURIComponent(values.sourceGroupId || "source-group-id")}`, {}, ["Applies a saved activity layout and restores source positions."], warnings);
    case "emergency":
      return post(`${STREAM_DECK_API_BASE}/emergency/${encodeURIComponent(values.emergencyAction)}`, {}, ["Emergency actions are designed for large Stream Deck keys."], warnings);
    case "alertControl":
      return post(`${STREAM_DECK_API_BASE}/alerts/${encodeURIComponent(values.alertAction)}`, {}, ["Controls the visual alert queue."], warnings);
    case "testAlert":
      return post(`${STREAM_DECK_API_BASE}/test/alert/${encodeURIComponent(values.testEventType)}`, {}, ["Fires a test alert into the alerts browser source."], warnings);
    case "obsScene":
      if (!values.sceneName) warnings.push("Select an OBS scene before exporting a final button.");
      return post(`${STREAM_DECK_API_BASE}/actions/obs/scene`, { sceneName: values.sceneName || "Scene name" }, ["Scene names must match OBS exactly."], warnings);
    case "sourceVisibility":
      if (!values.sceneName || !values.sourceName) warnings.push("Select an OBS scene and source before exporting a final button.");
      return post(`${STREAM_DECK_API_BASE}/actions/obs/source-visibility`, {
        sceneName: values.sceneName || "Scene name",
        sourceName: values.sourceName || "Source name",
        visible: values.sourceVisible,
      }, ["Create separate show and hide keys when you want predictable behaviour."], warnings);
    case "sourceMotion":
      if (!values.sceneName || !values.sourceName) warnings.push("Select an OBS scene and source before exporting a final button.");
      return post(`${STREAM_DECK_API_BASE}/actions/obs/source-motion`, buildMotionBody(values), ["Motion keys can resize, bounce, or animate sources in OBS."], warnings);
    case "text":
      if (!values.textInputName) warnings.push("Enter the exact OBS text input name before exporting a final button.");
      return post(`${STREAM_DECK_API_BASE}/actions/obs/text`, {
        inputName: values.textInputName || "OBS text source",
        text: values.textValue,
      }, ["Updates a text source or text-like input in OBS."], warnings);
    case "inputSettings": {
      if (!values.textInputName) warnings.push("Enter the exact OBS input name before exporting a final button.");
      const validJson = isValidJson(values.inputSettingsJson);
      if (!validJson) warnings.push("Input settings JSON is invalid.");
      return post(`${STREAM_DECK_API_BASE}/actions/obs/input-settings`, {
        inputName: values.textInputName || "OBS input name",
        inputSettings: validJson ? JSON.parse(values.inputSettingsJson) : {},
        overlay: true,
      }, ["Advanced action for OBS inputs. Use this when the simple text action is not enough."], warnings);
    }
    case "status":
      return {
        method: "GET",
        url: `${STREAM_DECK_API_BASE}${values.statusEndpoint}`,
        headers: {},
        body: "",
        notes: ["Use this for Stream Deck plugins that support polling/dynamic button state."],
        warnings,
      };
    default:
      return { method: "POST", url: STREAM_DECK_API_BASE, headers: postHeaders, body: "{}", notes: [], warnings };
  }
}

export function buildApiNinjaConfig(request: StreamDeckGeneratedRequest, design: StreamDeckDesignValues): string {
  return [
    `Name: ${design.keyTitle}`,
    `Method: ${request.method}`,
    `URL: ${request.url}`,
    `Headers: ${Object.keys(request.headers).length ? prettyJson(request.headers) : "(none)"}`,
    `Body: ${request.body || "(empty)"}`,
    `Key color: ${design.keyColor}`,
    `Icon label: ${design.iconLabel.trim() || "(none)"}`,
    `Background focal point: ${design.backgroundPositionX}% ${design.backgroundPositionY}%`,
    `Artwork overlay: ${design.showArtworkOverlay ? "shown" : "hidden"}`,
  ].join("\n\n");
}

export function buildStreamDeckExportInput(request: StreamDeckGeneratedRequest, design: StreamDeckDesignValues): ApiNinjaButtonInput {
  return {
    title: design.keyTitle,
    method: request.method,
    url: request.url,
    contentType: request.headers["Content-Type"],
    body: request.body ? compactJson(request.body) : "",
    color: design.keyColor,
    iconLabel: design.iconLabel,
    showTitle: design.showTitle,
    titleColor: design.titleColor,
    fontSize: design.fontSize,
    backgroundImageDataUrl: design.backgroundImageDataUrl,
    backgroundFit: design.backgroundFit,
    backgroundOpacity: design.backgroundOpacity / 100,
    backgroundPositionX: design.backgroundPositionX,
    backgroundPositionY: design.backgroundPositionY,
    imageEffect: design.imageEffect,
    showArtworkOverlay: design.showArtworkOverlay,
    badgeText: design.badgeText,
    subtitle: design.subtitle,
    textPlacement: design.textPlacement,
  };
}

function post(url: string, body: unknown, notes: string[], warnings: string[]): StreamDeckGeneratedRequest {
  const isEmptyObject = typeof body === "object" && body !== null && !Array.isArray(body) && Object.keys(body).length === 0;
  return {
    method: "POST",
    url,
    headers: { "Content-Type": "application/json" },
    body: isEmptyObject ? "{}" : prettyJson(body),
    notes,
    warnings,
  };
}

function buildMotionBody(values: StreamDeckBehaviorValues) {
  const base = {
    sceneName: values.sceneName || "Scene name",
    sourceName: values.sourceName || "Source name",
    mode: values.motionMode,
    durationMs: values.motionDurationMs,
    restore: values.motionRestore,
  };
  if (values.motionMode === "dvd") return { ...base, boundsWidth: 3840, boundsHeight: 2160, speedX: values.motionSpeedX, speedY: values.motionSpeedY, randomizeStart: true };
  if (values.motionMode === "path") return {
    ...base,
    path: [
      { x: values.motionX, y: values.motionY, scale: 1 },
      { x: values.motionX + 320, y: values.motionY + 180, scale: 1.12 },
      { x: values.motionX, y: values.motionY, scale: 1 },
    ],
  };
  return { ...base, x: values.motionX, y: values.motionY, width: values.motionWidth, height: values.motionHeight };
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function compactJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return value;
  }
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
