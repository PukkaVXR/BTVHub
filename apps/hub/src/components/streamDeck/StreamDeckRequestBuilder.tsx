import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  api,
  type MacroConfig,
  type ObsSceneInfo,
  type ObsSourceInfo,
  type SourceGroup,
} from "../../api";
import { useToast } from "../../hooks/useToast";
import { downloadApiNinjaButton, downloadStreamDeckAction } from "../../lib/apiNinja";
import { Button, Card, CardHeader, CopyField } from "../../ui";

type StreamDeckBuilderAction =
  | "macro"
  | "sourceGroup"
  | "emergency"
  | "alertControl"
  | "testAlert"
  | "obsScene"
  | "sourceVisibility"
  | "sourceMotion"
  | "text"
  | "inputSettings"
  | "status";

interface StreamDeckRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body: string;
  notes: string[];
  warnings: string[];
}

interface StreamDeckPreset {
  id: string;
  title: string;
  description: string;
  action: StreamDeckBuilderAction;
  color: string;
  iconLabel: string;
  configure?: () => Partial<BuilderPatch>;
}

interface VisualPreset {
  id: string;
  title: string;
  description: string;
  backgroundFit: "cover" | "contain" | "stretch";
  backgroundOpacity: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
  imageEffect: "none" | "glow" | "vignette" | "scanlines" | "glass";
  showArtworkOverlay: boolean;
  showTitle: boolean;
  textPlacement: "bottom" | "center" | "top";
}

interface BuilderPatch {
  keyTitle: string;
  action: StreamDeckBuilderAction;
  color: string;
  iconLabel: string;
  emergencyAction: string;
  alertAction: string;
  testEventType: string;
  sourceVisible: boolean;
  motionMode: "dvd" | "set" | "path";
  motionX: number;
  motionY: number;
  motionWidth: number;
  motionHeight: number;
  motionDurationMs: number;
  motionSpeedX: number;
  motionSpeedY: number;
  motionRestore: boolean;
  textValue: string;
  inputSettingsJson: string;
}

const STREAM_DECK_API_BASE = "http://127.0.0.1:4782/api";

const ACTION_GROUPS: Array<{ title: string; actions: Array<{ value: StreamDeckBuilderAction; label: string; detail: string }> }> = [
  {
    title: "BTV",
    actions: [
      { value: "macro", label: "Run macro", detail: "Trigger any saved multi-step macro." },
      { value: "sourceGroup", label: "Apply activity layout", detail: "Show a saved source group and restore positions." },
      { value: "emergency", label: "Emergency action", detail: "Stop, hide, reset, or reconnect live systems." },
    ],
  },
  {
    title: "Alerts",
    actions: [
      { value: "alertControl", label: "Alert control", detail: "Pause, resume, skip, replay, or clear alerts." },
      { value: "testAlert", label: "Test alert", detail: "Fire a follow/sub/raid style test alert in OBS." },
    ],
  },
  {
    title: "OBS",
    actions: [
      { value: "obsScene", label: "Switch scene", detail: "Move OBS to a selected scene." },
      { value: "sourceVisibility", label: "Show / hide source", detail: "Toggle an OBS source in a scene." },
      { value: "sourceMotion", label: "Move source", detail: "Set position, bounce, or animate a source." },
      { value: "text", label: "Update text", detail: "Set an OBS text input." },
      { value: "inputSettings", label: "Input settings JSON", detail: "Advanced OBS input settings payload." },
    ],
  },
  {
    title: "Status",
    actions: [{ value: "status", label: "Read status", detail: "Build a polling/status key." }],
  },
];

const EMERGENCY_ACTIONS = [
  { value: "all", label: "Stop all", color: "#ff3b5f", iconLabel: "!" },
  { value: "stop-sounds", label: "Stop sounds", color: "#ff9f1c", iconLabel: "Mute" },
  { value: "hide-overlays", label: "Hide overlays", color: "#ff9f1c", iconLabel: "Hide" },
  { value: "reset-overlays", label: "Reset overlays", color: "#5b8cff", iconLabel: "Reset" },
  { value: "disable-automations", label: "Disable automations", color: "#ffcf5a", iconLabel: "Auto" },
  { value: "enable-automations", label: "Enable automations", color: "#00f593", iconLabel: "Auto" },
  { value: "disable-channel-points", label: "Disable channel points", color: "#ffcf5a", iconLabel: "CP" },
  { value: "enable-channel-points", label: "Enable channel points", color: "#00f593", iconLabel: "CP" },
  { value: "reconnect-obs", label: "Reconnect OBS", color: "#6ee7b7", iconLabel: "OBS" },
  { value: "reconnect-twitch", label: "Reconnect Twitch", color: "#a78bfa", iconLabel: "TTV" },
] as const;

const ALERT_ACTIONS = [
  { value: "pause", label: "Pause alerts", color: "#ffcf5a", iconLabel: "Pause" },
  { value: "resume", label: "Resume alerts", color: "#00f593", iconLabel: "Play" },
  { value: "skip", label: "Skip alert", color: "#5b8cff", iconLabel: "Skip" },
  { value: "replay-last", label: "Replay alert", color: "#a78bfa", iconLabel: "Replay" },
  { value: "clear", label: "Clear alerts", color: "#ff5a67", iconLabel: "Clear" },
] as const;

const TEST_EVENTS = [
  { value: "follow", label: "Test follow", color: "#38bdf8", iconLabel: "Follow" },
  { value: "sub", label: "Test sub", color: "#f472b6", iconLabel: "Sub" },
  { value: "resub", label: "Test resub", color: "#f472b6", iconLabel: "Resub" },
  { value: "gift_sub", label: "Test gifted sub", color: "#f472b6", iconLabel: "Gift" },
  { value: "cheer", label: "Test cheer", color: "#a78bfa", iconLabel: "Bits" },
  { value: "raid", label: "Test raid", color: "#ff9f1c", iconLabel: "Raid" },
  { value: "channel_points", label: "Test channel points", color: "#00f593", iconLabel: "CP" },
] as const;

const STATUS_ENDPOINTS = [
  { value: "/stream-deck/status", label: "Overall readiness", color: "#00f593", iconLabel: "OK" },
  { value: "/stream-deck/obs", label: "OBS status", color: "#6ee7b7", iconLabel: "OBS" },
  { value: "/stream-deck/macros", label: "Macro list", color: "#5b8cff", iconLabel: "Macro" },
  { value: "/stream-deck/source-groups", label: "Activity layout list", color: "#a78bfa", iconLabel: "Layout" },
] as const;

const ACTION_PRESETS: StreamDeckPreset[] = [
  {
    id: "panic",
    title: "Panic button",
    description: "Stop sounds, clear alerts, hide overlays, pause automation.",
    action: "emergency",
    color: "#ff3b5f",
    iconLabel: "!",
    configure: () => ({ emergencyAction: "all", keyTitle: "BTV Stop all" }),
  },
  {
    id: "test-sub",
    title: "Test sub alert",
    description: "Fire a subscription test into the alert browser source.",
    action: "testAlert",
    color: "#f472b6",
    iconLabel: "Sub",
    configure: () => ({ testEventType: "sub", keyTitle: "BTV Test sub" }),
  },
  {
    id: "pause-alerts",
    title: "Pause alerts",
    description: "Hold the alert queue while you recover the scene.",
    action: "alertControl",
    color: "#ffcf5a",
    iconLabel: "Pause",
    configure: () => ({ alertAction: "pause", keyTitle: "BTV Pause alerts" }),
  },
  {
    id: "dvd-camera",
    title: "OBS source bounce",
    description: "Make a selected source bounce around the canvas, then restore it.",
    action: "sourceMotion",
    color: "#5b8cff",
    iconLabel: "Move",
    configure: () => ({ motionMode: "dvd", keyTitle: "BTV Bounce source" }),
  },
  {
    id: "status",
    title: "Readiness key",
    description: "Create a polling key for BTV readiness.",
    action: "status",
    color: "#00f593",
    iconLabel: "OK",
    configure: () => ({ keyTitle: "BTV Status" }),
  },
];

const COLOR_SWATCHES = ["#5b8cff", "#ff3b5f", "#ff9f1c", "#ffcf5a", "#00f593", "#38bdf8", "#a78bfa", "#f472b6"];

const VISUAL_PRESETS: VisualPreset[] = [
  {
    id: "image-only",
    title: "Image only",
    description: "No text, no badge, no panel. Best for finished artwork.",
    backgroundFit: "cover",
    backgroundOpacity: 100,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "none",
    showArtworkOverlay: false,
    showTitle: false,
    textPlacement: "bottom",
  },
  {
    id: "glass-command",
    title: "Glass command",
    description: "Classic BTV label with a readable lower panel.",
    backgroundFit: "cover",
    backgroundOpacity: 72,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "glass",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "bottom",
  },
  {
    id: "center-title",
    title: "Centre title",
    description: "Balanced layout for simple one-action keys.",
    backgroundFit: "cover",
    backgroundOpacity: 62,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "vignette",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "center",
  },
  {
    id: "neon-status",
    title: "Neon status",
    description: "Glowing edge, cleaner surface, good for state keys.",
    backgroundFit: "cover",
    backgroundOpacity: 48,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "glow",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "top",
  },
  {
    id: "retro-monitor",
    title: "Retro monitor",
    description: "Scanline treatment for testing and alert controls.",
    backgroundFit: "cover",
    backgroundOpacity: 58,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "scanlines",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "bottom",
  },
];

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

function actionLabel(action: StreamDeckBuilderAction): string {
  return ACTION_GROUPS.flatMap((group) => group.actions).find((item) => item.value === action)?.label ?? action;
}

export function StreamDeckRequestBuilder() {
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [obsScenes, setObsScenes] = useState<ObsSceneInfo[]>([]);
  const [obsSources, setObsSources] = useState<ObsSourceInfo[]>([]);
  const [selectedObsScene, setSelectedObsScene] = useState("");
  const [action, setAction] = useState<StreamDeckBuilderAction>("macro");
  const [macroId, setMacroId] = useState("");
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [sceneName, setSceneName] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceVisible, setSourceVisible] = useState(true);
  const [motionMode, setMotionMode] = useState<"dvd" | "set" | "path">("dvd");
  const [motionX, setMotionX] = useState(0);
  const [motionY, setMotionY] = useState(0);
  const [motionWidth, setMotionWidth] = useState(720);
  const [motionHeight, setMotionHeight] = useState(405);
  const [motionDurationMs, setMotionDurationMs] = useState(8000);
  const [motionSpeedX, setMotionSpeedX] = useState(9);
  const [motionSpeedY, setMotionSpeedY] = useState(6);
  const [motionRestore, setMotionRestore] = useState(true);
  const [textInputName, setTextInputName] = useState("");
  const [textValue, setTextValue] = useState("Text from Stream Deck");
  const [inputSettingsJson, setInputSettingsJson] = useState(prettyJson({ text: "Text from Stream Deck" }));
  const [emergencyAction, setEmergencyAction] = useState("all");
  const [alertAction, setAlertAction] = useState("pause");
  const [testEventType, setTestEventType] = useState("follow");
  const [statusEndpoint, setStatusEndpoint] = useState("/stream-deck/status");
  const [keyTitle, setKeyTitle] = useState("BTV Run macro");
  const [iconLabel, setIconLabel] = useState("BTV");
  const [keyColor, setKeyColor] = useState("#5b8cff");
  const [showTitle, setShowTitle] = useState(true);
  const [titleColor, setTitleColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(11);
  const [backgroundImageDataUrl, setBackgroundImageDataUrl] = useState("");
  const [backgroundFit, setBackgroundFit] = useState<"cover" | "contain" | "stretch">("cover");
  const [backgroundOpacity, setBackgroundOpacity] = useState(72);
  const [backgroundPositionX, setBackgroundPositionX] = useState(50);
  const [backgroundPositionY, setBackgroundPositionY] = useState(50);
  const [imageEffect, setImageEffect] = useState<"none" | "glow" | "vignette" | "scanlines" | "glass">("glass");
  const [showArtworkOverlay, setShowArtworkOverlay] = useState(true);
  const [badgeText, setBadgeText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textPlacement, setTextPlacement] = useState<"bottom" | "center" | "top">("bottom");
  const [designTab, setDesignTab] = useState<"text" | "background" | "style">("text");
  const [copied, setCopied] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const toast = useToast();

  useEffect(() => {
    void Promise.all([api.macros(), api.sourceGroups(), api.obsScenes()])
      .then(async ([nextMacros, nextSourceGroups, scenesResponse]) => {
        setMacros(nextMacros);
        setSourceGroups(nextSourceGroups);
        setObsScenes(scenesResponse.scenes);
        const nextScene = scenesResponse.currentScene || scenesResponse.scenes[0]?.sceneName || "";
        setSelectedObsScene(nextScene);
        setSceneName(nextScene);
        if (nextScene) {
          const sources = await api.obsSceneSources(nextScene);
          setObsSources(sources.sources);
          setSourceName(sources.sources[0]?.sourceName ?? "");
        }
      })
      .catch(() => {
        setObsScenes([]);
        setObsSources([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedObsScene) {
      setObsSources([]);
      return;
    }
    void api
      .obsSceneSources(selectedObsScene)
      .then((res) => {
        setObsSources(res.sources);
        setSourceName((current) => current || res.sources[0]?.sourceName || "");
      })
      .catch(() => setObsSources([]));
  }, [selectedObsScene]);

  useEffect(() => {
    if (!macroId && macros.length) setMacroId(macros[0]!.id);
  }, [macroId, macros]);

  useEffect(() => {
    if (!sourceGroupId && sourceGroups.length) setSourceGroupId(sourceGroups[0]!.id);
  }, [sourceGroupId, sourceGroups]);

  const selectedActionInfo = useMemo(
    () => ACTION_GROUPS.flatMap((group) => group.actions).find((item) => item.value === action),
    [action],
  );

  const request = useMemo<StreamDeckRequest>(() => {
    const postHeaders = { "Content-Type": "application/json" };
    const warnings: string[] = [];

    switch (action) {
      case "macro":
        if (!macroId) warnings.push("Select or create a macro before exporting a final button.");
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/macro/${encodeURIComponent(macroId || "macro-id")}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Runs one saved macro from the Macros page."],
          warnings,
        };
      case "sourceGroup":
        if (!sourceGroupId) warnings.push("Select or create an activity layout before exporting a final button.");
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/source-group/${encodeURIComponent(sourceGroupId || "source-group-id")}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Applies a saved activity layout and restores source positions."],
          warnings,
        };
      case "emergency":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/emergency/${encodeURIComponent(emergencyAction)}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Emergency actions are designed for large Stream Deck keys."],
          warnings,
        };
      case "alertControl":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/alerts/${encodeURIComponent(alertAction)}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Controls the visual alert queue."],
          warnings,
        };
      case "testAlert":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/test/alert/${encodeURIComponent(testEventType)}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Fires a test alert into the alerts browser source."],
          warnings,
        };
      case "obsScene":
        if (!sceneName) warnings.push("Select an OBS scene before exporting a final button.");
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/scene`,
          headers: postHeaders,
          body: prettyJson({ sceneName: sceneName || "Scene name" }),
          notes: ["Scene names must match OBS exactly."],
          warnings,
        };
      case "sourceVisibility":
        if (!sceneName || !sourceName) warnings.push("Select an OBS scene and source before exporting a final button.");
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/source-visibility`,
          headers: postHeaders,
          body: prettyJson({
            sceneName: sceneName || "Scene name",
            sourceName: sourceName || "Source name",
            visible: sourceVisible,
          }),
          notes: ["Create separate show and hide keys when you want predictable behaviour."],
          warnings,
        };
      case "sourceMotion": {
        if (!sceneName || !sourceName) warnings.push("Select an OBS scene and source before exporting a final button.");
        const base = {
          sceneName: sceneName || "Scene name",
          sourceName: sourceName || "Source name",
          mode: motionMode,
          durationMs: motionDurationMs,
          restore: motionRestore,
        };
        const body =
          motionMode === "dvd"
            ? {
                ...base,
                boundsWidth: 3840,
                boundsHeight: 2160,
                speedX: motionSpeedX,
                speedY: motionSpeedY,
                randomizeStart: true,
              }
            : motionMode === "path"
              ? {
                  ...base,
                  path: [
                    { x: motionX, y: motionY, scale: 1 },
                    { x: motionX + 320, y: motionY + 180, scale: 1.12 },
                    { x: motionX, y: motionY, scale: 1 },
                  ],
                }
              : {
                  ...base,
                  x: motionX,
                  y: motionY,
                  width: motionWidth,
                  height: motionHeight,
                };
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/source-motion`,
          headers: postHeaders,
          body: prettyJson(body),
          notes: ["Motion keys can resize, bounce, or animate sources in OBS."],
          warnings,
        };
      }
      case "text":
        if (!textInputName) warnings.push("Enter the exact OBS text input name before exporting a final button.");
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/text`,
          headers: postHeaders,
          body: prettyJson({
            inputName: textInputName || "OBS text source",
            text: textValue,
          }),
          notes: ["Updates a text source or text-like input in OBS."],
          warnings,
        };
      case "inputSettings":
        if (!textInputName) warnings.push("Enter the exact OBS input name before exporting a final button.");
        if (!isValidJson(inputSettingsJson)) warnings.push("Input settings JSON is invalid.");
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/input-settings`,
          headers: postHeaders,
          body: prettyJson({
            inputName: textInputName || "OBS input name",
            inputSettings: isValidJson(inputSettingsJson) ? JSON.parse(inputSettingsJson) : {},
            overlay: true,
          }),
          notes: ["Advanced action for OBS inputs. Use this when the simple text action is not enough."],
          warnings,
        };
      case "status":
        return {
          method: "GET",
          url: `${STREAM_DECK_API_BASE}${statusEndpoint}`,
          headers: {},
          body: "",
          notes: ["Use this for Stream Deck plugins that support polling/dynamic button state."],
          warnings,
        };
      default:
        return {
          method: "POST",
          url: STREAM_DECK_API_BASE,
          headers: postHeaders,
          body: "{}",
          notes: [],
          warnings,
        };
    }
  }, [
    action,
    alertAction,
    emergencyAction,
    inputSettingsJson,
    macroId,
    motionDurationMs,
    motionHeight,
    motionMode,
    motionRestore,
    motionSpeedX,
    motionSpeedY,
    motionWidth,
    motionX,
    motionY,
    sceneName,
    sourceGroupId,
    sourceName,
    sourceVisible,
    statusEndpoint,
    testEventType,
    textInputName,
    textValue,
  ]);

  const apiNinjaConfig = useMemo(
    () =>
      [
        `Name: ${keyTitle}`,
        `Method: ${request.method}`,
        `URL: ${request.url}`,
        `Headers: ${Object.keys(request.headers).length ? prettyJson(request.headers) : "(none)"}`,
        `Body: ${request.body || "(empty)"}`,
        `Key color: ${keyColor}`,
        `Icon label: ${iconLabel.trim() || "(none)"}`,
        `Background focal point: ${backgroundPositionX}% ${backgroundPositionY}%`,
        `Artwork overlay: ${showArtworkOverlay ? "shown" : "hidden"}`,
      ].join("\n\n"),
    [backgroundPositionX, backgroundPositionY, iconLabel, keyColor, keyTitle, request, showArtworkOverlay],
  );

  const exportInput = {
    title: keyTitle,
    method: request.method,
    url: request.url,
    contentType: request.headers["Content-Type"],
    body: request.body ? compactJson(request.body) : "",
    color: keyColor,
    iconLabel,
    showTitle,
    titleColor,
    fontSize,
    backgroundImageDataUrl,
    backgroundFit,
    backgroundOpacity: backgroundOpacity / 100,
    backgroundPositionX,
    backgroundPositionY,
    imageEffect,
    showArtworkOverlay,
    badgeText,
    subtitle,
    textPlacement,
  };

  const previewStyle = {
    "--button-color": keyColor,
    "--key-bg-image": backgroundImageDataUrl ? `url(${backgroundImageDataUrl})` : "none",
    "--key-bg-opacity": String(backgroundOpacity / 100),
    "--key-bg-position": `${backgroundPositionX}% ${backgroundPositionY}%`,
  } as CSSProperties;

  const applyAction = (nextAction: StreamDeckBuilderAction) => {
    setAction(nextAction);
    const title = actionLabel(nextAction);
    setKeyTitle(`BTV ${title}`);
    setIconLabel(nextAction === "status" ? "OK" : "BTV");
    setKeyColor(nextAction === "emergency" ? "#ff3b5f" : nextAction === "alertControl" ? "#ffcf5a" : "#5b8cff");
    setTestResult(null);
  };

  const applyPreset = (preset: StreamDeckPreset) => {
    const patch = preset.configure?.() ?? {};
    setAction(preset.action);
    setKeyTitle(patch.keyTitle ?? `BTV ${preset.title}`);
    setKeyColor(preset.color);
    setIconLabel(preset.iconLabel);
    if (patch.emergencyAction) setEmergencyAction(patch.emergencyAction);
    if (patch.alertAction) setAlertAction(patch.alertAction);
    if (patch.testEventType) setTestEventType(patch.testEventType);
    if (patch.motionMode) setMotionMode(patch.motionMode);
    setTestResult(null);
  };

  const applyVisualPreset = (preset: VisualPreset) => {
    setBackgroundFit(preset.backgroundFit);
    setBackgroundOpacity(preset.backgroundOpacity);
    setBackgroundPositionX(preset.backgroundPositionX);
    setBackgroundPositionY(preset.backgroundPositionY);
    setImageEffect(preset.imageEffect);
    setShowArtworkOverlay(preset.showArtworkOverlay);
    setShowTitle(preset.showTitle);
    setTextPlacement(preset.textPlacement);
    setTestResult(null);
    toast(`${preset.title} visual preset applied`);
  };

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(message);
    toast(message);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const handleBackgroundUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choose an image file for the key background");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImageDataUrl(String(reader.result ?? ""));
      toast("Key background loaded");
    };
    reader.readAsDataURL(file);
  };

  const testRequest = async () => {
    setTestResult(null);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.method === "POST" ? request.body || "{}" : undefined,
      });
      const body = await response.json().catch(() => ({}));
      const message = String(body.message || body.title || (response.ok ? "Action completed" : "Action failed"));
      setTestResult({ ok: response.ok && body.ok !== false, message });
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : "Could not reach BTV action API" });
    }
  };

  return (
    <Card hideableId="stream-deck-action-builder" hideableTitle="Stream Deck Action Builder">
      <CardHeader
        title="Stream Deck Action Builder"
        description="Build importable Stream Deck keys with BTV actions, API Ninja settings, visual styling, and testable payloads."
        action={
          <div className="stream-deck-builder__header-actions">
            <Button type="button" variant="primary" size="sm" onClick={() => void downloadStreamDeckAction(exportInput).then(() => toast("Stream Deck action exported"))}>
              Export Stream Deck action
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void testRequest()}>
              Test action
            </Button>
          </div>
        }
      />

      <div className="stream-deck-builder-pro">
        <section className="stream-deck-builder-panel stream-deck-builder-panel--actions">
          <div className="stream-deck-builder-panel__header">
            <span>1</span>
            <div>
              <strong>Choose the action</strong>
              <small>{selectedActionInfo?.detail}</small>
            </div>
          </div>

          <div className="stream-deck-preset-grid">
            {ACTION_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`stream-deck-preset ${preset.action === action ? "stream-deck-preset--active" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                <span style={{ "--button-color": preset.color } as CSSProperties}>{preset.iconLabel}</span>
                <strong>{preset.title}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>

          {ACTION_GROUPS.map((group) => (
            <div className="stream-deck-action-group" key={group.title}>
              <h4>{group.title}</h4>
              <div className="stream-deck-action-choice-grid">
                {group.actions.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    className={`stream-deck-action-choice ${action === item.value ? "stream-deck-action-choice--active" : ""}`}
                    onClick={() => applyAction(item.value)}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="stream-deck-builder-panel">
          <div className="stream-deck-builder-panel__header">
            <span>2</span>
            <div>
              <strong>Configure behaviour</strong>
              <small>Use dropdowns where possible; advanced JSON is still available when needed.</small>
            </div>
          </div>

          <div className="stream-deck-form-grid">
            {action === "macro" ? (
              <label>
                Macro
                <select value={macroId} onChange={(event) => setMacroId(event.target.value)}>
                  <option value="">Select macro</option>
                  {macros.map((macro) => (
                    <option key={macro.id} value={macro.id}>
                      {macro.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {action === "sourceGroup" ? (
              <label>
                Activity layout
                <select value={sourceGroupId} onChange={(event) => setSourceGroupId(event.target.value)}>
                  <option value="">Select activity layout</option>
                  {sourceGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {action === "emergency" ? (
              <label>
                Emergency action
                <select
                  value={emergencyAction}
                  onChange={(event) => {
                    const selected = EMERGENCY_ACTIONS.find((item) => item.value === event.target.value);
                    setEmergencyAction(event.target.value);
                    if (selected) {
                      setKeyTitle(`BTV ${selected.label}`);
                      setKeyColor(selected.color);
                      setIconLabel(selected.iconLabel);
                    }
                  }}
                >
                  {EMERGENCY_ACTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {action === "alertControl" ? (
              <label>
                Alert action
                <select
                  value={alertAction}
                  onChange={(event) => {
                    const selected = ALERT_ACTIONS.find((item) => item.value === event.target.value);
                    setAlertAction(event.target.value);
                    if (selected) {
                      setKeyTitle(`BTV ${selected.label}`);
                      setKeyColor(selected.color);
                      setIconLabel(selected.iconLabel);
                    }
                  }}
                >
                  {ALERT_ACTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {action === "testAlert" ? (
              <label>
                Test event
                <select
                  value={testEventType}
                  onChange={(event) => {
                    const selected = TEST_EVENTS.find((item) => item.value === event.target.value);
                    setTestEventType(event.target.value);
                    if (selected) {
                      setKeyTitle(`BTV ${selected.label}`);
                      setKeyColor(selected.color);
                      setIconLabel(selected.iconLabel);
                    }
                  }}
                >
                  {TEST_EVENTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {["obsScene", "sourceVisibility", "sourceMotion"].includes(action) ? (
              <label>
                OBS scene
                <select
                  value={sceneName}
                  onChange={(event) => {
                    setSceneName(event.target.value);
                    setSelectedObsScene(event.target.value);
                  }}
                >
                  <option value="">Select scene</option>
                  {obsScenes.map((scene) => (
                    <option key={scene.sceneName} value={scene.sceneName}>
                      {scene.sceneName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {["sourceVisibility", "sourceMotion"].includes(action) ? (
              <label>
                OBS source
                <select value={sourceName} onChange={(event) => setSourceName(event.target.value)}>
                  <option value="">Select source</option>
                  {obsSources.map((source) => (
                    <option key={`${source.sceneItemId}-${source.sourceName}`} value={source.sourceName}>
                      {source.sourceName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {action === "sourceVisibility" ? (
              <label className="stream-deck-toggle">
                <input type="checkbox" checked={sourceVisible} onChange={(event) => setSourceVisible(event.target.checked)} />
                Show source
              </label>
            ) : null}

            {action === "sourceMotion" ? (
              <>
                <label>
                  Motion type
                  <select value={motionMode} onChange={(event) => setMotionMode(event.target.value as "dvd" | "set" | "path")}>
                    <option value="dvd">DVD bounce</option>
                    <option value="set">Set position / size</option>
                    <option value="path">Simple path pulse</option>
                  </select>
                </label>
                <label>
                  Duration (ms)
                  <input type="number" min={100} step={100} value={motionDurationMs} onChange={(event) => setMotionDurationMs(Number(event.target.value))} />
                </label>
                {motionMode === "dvd" ? (
                  <>
                    <label>
                      Speed X
                      <input type="number" value={motionSpeedX} onChange={(event) => setMotionSpeedX(Number(event.target.value))} />
                    </label>
                    <label>
                      Speed Y
                      <input type="number" value={motionSpeedY} onChange={(event) => setMotionSpeedY(Number(event.target.value))} />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      X
                      <input type="number" value={motionX} onChange={(event) => setMotionX(Number(event.target.value))} />
                    </label>
                    <label>
                      Y
                      <input type="number" value={motionY} onChange={(event) => setMotionY(Number(event.target.value))} />
                    </label>
                    <label>
                      Width
                      <input type="number" min={1} value={motionWidth} onChange={(event) => setMotionWidth(Number(event.target.value))} />
                    </label>
                    <label>
                      Height
                      <input type="number" min={1} value={motionHeight} onChange={(event) => setMotionHeight(Number(event.target.value))} />
                    </label>
                  </>
                )}
                <label className="stream-deck-toggle">
                  <input type="checkbox" checked={motionRestore} onChange={(event) => setMotionRestore(event.target.checked)} />
                  Restore when complete
                </label>
              </>
            ) : null}

            {["text", "inputSettings"].includes(action) ? (
              <label>
                OBS input name
                <input value={textInputName} onChange={(event) => setTextInputName(event.target.value)} placeholder="Exact OBS input name" />
              </label>
            ) : null}

            {action === "text" ? (
              <label className="stream-deck-form-grid__wide">
                Text to set
                <input value={textValue} onChange={(event) => setTextValue(event.target.value)} />
              </label>
            ) : null}

            {action === "inputSettings" ? (
              <label className="stream-deck-form-grid__wide">
                Input settings JSON
                <textarea rows={7} value={inputSettingsJson} onChange={(event) => setInputSettingsJson(event.target.value)} />
              </label>
            ) : null}

            {action === "status" ? (
              <label>
                Status endpoint
                <select
                  value={statusEndpoint}
                  onChange={(event) => {
                    const selected = STATUS_ENDPOINTS.find((item) => item.value === event.target.value);
                    setStatusEndpoint(event.target.value);
                    if (selected) {
                      setKeyTitle(`BTV ${selected.label}`);
                      setKeyColor(selected.color);
                      setIconLabel(selected.iconLabel);
                    }
                  }}
                >
                  {STATUS_ENDPOINTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {request.warnings.length ? (
            <div className="stream-deck-builder-warnings">
              {request.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="stream-deck-builder-panel">
          <div className="stream-deck-builder-panel__header">
            <span>3</span>
            <div>
              <strong>Design the key</strong>
              <small>The preview becomes the generated Stream Deck key image.</small>
            </div>
          </div>

          <div className="stream-deck-visual-builder">
            <div
              className={`stream-deck-key-preview-large stream-deck-key-preview-large--${imageEffect} stream-deck-key-preview-large--text-${textPlacement} stream-deck-key-preview-large--fit-${backgroundFit}${showArtworkOverlay ? "" : " stream-deck-key-preview-large--image-only"}`}
              style={previewStyle}
            >
              {backgroundImageDataUrl ? <div className="stream-deck-key-preview-large__bg" aria-hidden="true" /> : null}
              {showArtworkOverlay && badgeText ? <em>{badgeText}</em> : null}
              {showArtworkOverlay && iconLabel.trim() ? <span>{iconLabel}</span> : null}
              {showArtworkOverlay && keyTitle.trim() ? <strong>{keyTitle}</strong> : null}
              {showArtworkOverlay && subtitle ? <small>{subtitle}</small> : null}
            </div>

            <div className="stream-deck-visual-presets" aria-label="Key visual presets">
              {VISUAL_PRESETS.map((preset) => {
                const active =
                  preset.backgroundFit === backgroundFit &&
                  preset.backgroundOpacity === backgroundOpacity &&
                  preset.backgroundPositionX === backgroundPositionX &&
                  preset.backgroundPositionY === backgroundPositionY &&
                  preset.imageEffect === imageEffect &&
                  preset.showArtworkOverlay === showArtworkOverlay &&
                  preset.showTitle === showTitle &&
                  preset.textPlacement === textPlacement;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    className={`stream-deck-visual-preset${active ? " stream-deck-visual-preset--active" : ""}`}
                    onClick={() => applyVisualPreset(preset)}
                  >
                    <strong>{preset.title}</strong>
                    <small>{preset.description}</small>
                  </button>
                );
              })}
            </div>

            <div className="stream-deck-design-tabs" role="tablist" aria-label="Key design controls">
              {[
                { id: "text", label: "Text" },
                { id: "background", label: "Background" },
                { id: "style", label: "Style" },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  role="tab"
                  aria-selected={designTab === tab.id}
                  className={designTab === tab.id ? "stream-deck-design-tabs__item--active" : ""}
                  onClick={() => setDesignTab(tab.id as "text" | "background" | "style")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {designTab === "text" ? (
              <div className="stream-deck-form-grid stream-deck-design-panel" role="tabpanel">
                <label>
                  Key title
                  <input value={keyTitle} onChange={(event) => setKeyTitle(event.target.value)} />
                </label>
                <label>
                  Icon label
                  <input value={iconLabel} maxLength={8} onChange={(event) => setIconLabel(event.target.value)} />
                </label>
                <label>
                  Title colour
                  <input type="color" value={titleColor} onChange={(event) => setTitleColor(event.target.value)} />
                </label>
                <label>
                  Font size
                  <input type="number" min={6} max={30} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
                </label>
                <label>
                  Text placement
                  <select value={textPlacement} onChange={(event) => setTextPlacement(event.target.value as "bottom" | "center" | "top")}>
                    <option value="bottom">Bottom panel</option>
                    <option value="center">Centre panel</option>
                    <option value="top">Top panel</option>
                  </select>
                </label>
                <label>
                  Subtitle
                  <input value={subtitle} maxLength={32} placeholder="Optional small line" onChange={(event) => setSubtitle(event.target.value)} />
                </label>
                <label>
                  Badge
                  <input value={badgeText} maxLength={8} placeholder="LIVE" onChange={(event) => setBadgeText(event.target.value)} />
                </label>
                <label className="stream-deck-toggle">
                  <input type="checkbox" checked={showTitle} onChange={(event) => setShowTitle(event.target.checked)} />
                  Show Stream Deck title
                </label>
                <label className="stream-deck-toggle stream-deck-form-grid__wide">
                  <input type="checkbox" checked={showArtworkOverlay} onChange={(event) => setShowArtworkOverlay(event.target.checked)} />
                  <span>
                    Overlay text and badge on the key image
                    <small>Turn this off for clean background-image-only keys. The Stream Deck title checkbox controls the separate native key title.</small>
                  </span>
                </label>
              </div>
            ) : null}

            {designTab === "background" ? (
              <div className="stream-deck-design-panel" role="tabpanel">
                <div className="stream-deck-background-tools">
                  <div>
                    <strong>Background image</strong>
                    <small>Use a logo, screenshot, game art, or texture. It is baked into the exported key image.</small>
                  </div>
                  <div className="stream-deck-background-tools__actions">
                    <label className="ui-button ui-button--secondary ui-button--sm">
                      Upload image
                      <input type="file" accept="image/*" onChange={(event) => void handleBackgroundUpload(event.target.files?.[0] ?? null)} />
                    </label>
                    {backgroundImageDataUrl ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => setBackgroundImageDataUrl("")}>
                        Remove image
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="stream-deck-form-grid">
                  <label>
                    Image fit
                    <select value={backgroundFit} onChange={(event) => setBackgroundFit(event.target.value as "cover" | "contain" | "stretch")}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="stretch">Stretch</option>
                    </select>
                  </label>
                  <label>
                    Image opacity ({backgroundOpacity}%)
                    <input type="range" min={0} max={100} value={backgroundOpacity} onChange={(event) => setBackgroundOpacity(Number(event.target.value))} />
                  </label>
                  <label>
                    Focal X ({backgroundPositionX}%)
                    <input type="range" min={0} max={100} value={backgroundPositionX} onChange={(event) => setBackgroundPositionX(Number(event.target.value))} />
                  </label>
                  <label>
                    Focal Y ({backgroundPositionY}%)
                    <input type="range" min={0} max={100} value={backgroundPositionY} onChange={(event) => setBackgroundPositionY(Number(event.target.value))} />
                  </label>
                  <div className="stream-deck-focal-grid stream-deck-form-grid__wide" aria-label="Background focal point presets">
                    {[
                      { label: "Top left", x: 0, y: 0 },
                      { label: "Top", x: 50, y: 0 },
                      { label: "Top right", x: 100, y: 0 },
                      { label: "Left", x: 0, y: 50 },
                      { label: "Centre", x: 50, y: 50 },
                      { label: "Right", x: 100, y: 50 },
                      { label: "Bottom left", x: 0, y: 100 },
                      { label: "Bottom", x: 50, y: 100 },
                      { label: "Bottom right", x: 100, y: 100 },
                    ].map((point) => (
                      <button
                        type="button"
                        key={point.label}
                        className={backgroundPositionX === point.x && backgroundPositionY === point.y ? "stream-deck-focal-grid__item--active" : ""}
                        onClick={() => {
                          setBackgroundPositionX(point.x);
                          setBackgroundPositionY(point.y);
                        }}
                      >
                        {point.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {designTab === "style" ? (
              <div className="stream-deck-design-panel" role="tabpanel">
                <div className="stream-deck-form-grid">
                  <label>
                    Key colour
                    <input type="color" value={keyColor} onChange={(event) => setKeyColor(event.target.value)} />
                  </label>
                  <label>
                    Effect
                    <select value={imageEffect} onChange={(event) => setImageEffect(event.target.value as "none" | "glow" | "vignette" | "scanlines" | "glass")}>
                      <option value="glass">Glass panel</option>
                      <option value="glow">Border glow</option>
                      <option value="vignette">Vignette</option>
                      <option value="scanlines">Scanlines</option>
                      <option value="none">Clean</option>
                    </select>
                  </label>
                </div>

                <label className="stream-deck-style-label">
                  Quick colours
                  <span className="stream-deck-color-row">
                    {COLOR_SWATCHES.map((color) => (
                      <button
                        type="button"
                        key={color}
                        style={{ backgroundColor: color }}
                        aria-label={`Use ${color}`}
                        className={keyColor.toLowerCase() === color.toLowerCase() ? "stream-deck-color-row__item--active" : ""}
                        onClick={() => setKeyColor(color)}
                      />
                    ))}
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </section>

        <section className="stream-deck-builder-panel stream-deck-builder-panel--output">
          <div className="stream-deck-builder-panel__header">
            <span>4</span>
            <div>
              <strong>Export and test</strong>
              <small>Use full actions for visual imports, or `.ninja` for API Ninja-only imports.</small>
            </div>
          </div>

          <div className="stream-deck-export-grid">
            <Button type="button" variant="primary" size="sm" onClick={() => void downloadStreamDeckAction(exportInput).then(() => toast("Stream Deck action exported"))}>
              Export Stream Deck action
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void downloadApiNinjaButton(exportInput)}>
              Export .ninja
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copy(apiNinjaConfig, "API Ninja config copied")}>
              Copy config
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void testRequest()}>
              Test now
            </Button>
          </div>

          {testResult ? (
            <div className={`stream-deck-test-result ${testResult.ok ? "stream-deck-test-result--ok" : "stream-deck-test-result--bad"}`}>
              {testResult.ok ? "Success" : "Needs attention"}: {testResult.message}
            </div>
          ) : null}

          {copied ? <div className="stream-deck-test-result stream-deck-test-result--ok">{copied}</div> : null}

          <CopyField label="Action URL" value={request.url} />
          <div className="stream-deck-builder__meta">
            <div>
              <label>Method</label>
              <input value={request.method} readOnly />
            </div>
            <div>
              <label>Content-Type</label>
              <input value={request.headers["Content-Type"] ?? ""} readOnly placeholder="None" />
            </div>
          </div>
          <label>
            Request body
            <textarea className="stream-deck-builder__body" rows={8} value={request.body} readOnly placeholder="No body for this request" />
          </label>

          {request.notes.length ? (
            <div className="stream-deck-builder-notes">
              {request.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </Card>
  );
}
