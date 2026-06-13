import { useEffect, useMemo, useState } from "react";
import {
  api,
  getLocalApiToken,
  type MacroConfig,
  type ObsSceneInfo,
  type ObsSourceInfo,
  type SourceGroup,
} from "../../api";
import { useToast } from "../../hooks/useToast";
import { downloadApiNinjaButton, downloadStreamDeckAction } from "../../lib/apiNinja";
import { Button, Card, CardHeader } from "../../ui";
import { StreamDeckActionPicker } from "./StreamDeckActionPicker";
import { StreamDeckBehaviorConfigurator } from "./StreamDeckBehaviorConfigurator";
import { StreamDeckExportPanel } from "./StreamDeckExportPanel";
import { StreamDeckKeyDesigner } from "./StreamDeckKeyDesigner";
import { buildApiNinjaConfig, buildStreamDeckExportInput, buildStreamDeckRequest } from "./streamDeckRequestGenerator";
import type {
  StreamDeckActionGroup,
  StreamDeckActionPreset,
  StreamDeckBehaviorValues,
  StreamDeckBuilderAction,
  StreamDeckDesignValues,
  StreamDeckKeyAppearancePatch,
} from "./streamDeckBuilderTypes";

const ACTION_GROUPS: StreamDeckActionGroup[] = [
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

const ACTION_PRESETS: StreamDeckActionPreset[] = [
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
  const [inputSettingsJson, setInputSettingsJson] = useState(JSON.stringify({ text: "Text from Stream Deck" }, null, 2));
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

  const applyAction = (nextAction: StreamDeckBuilderAction) => {
    setAction(nextAction);
    const title = actionLabel(nextAction);
    setKeyTitle(`BTV ${title}`);
    setIconLabel(nextAction === "status" ? "OK" : "BTV");
    setKeyColor(nextAction === "emergency" ? "#ff3b5f" : nextAction === "alertControl" ? "#ffcf5a" : "#5b8cff");
    setTestResult(null);
  };

  const applyPreset = (preset: StreamDeckActionPreset) => {
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
      const headers = { ...request.headers };
      if (request.method === "POST") headers["X-BTV-Token"] = await getLocalApiToken();
      const response = await fetch(request.url, {
        method: request.method,
        headers,
        body: request.method === "POST" ? request.body || "{}" : undefined,
      });
      const body = await response.json().catch(() => ({}));
      const message = String(body.message || body.title || (response.ok ? "Action completed" : "Action failed"));
      setTestResult({ ok: response.ok && body.ok !== false, message });
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : "Could not reach BTV action API" });
    }
  };

  const behaviorValues: StreamDeckBehaviorValues = {
    macroId,
    sourceGroupId,
    sceneName,
    sourceName,
    sourceVisible,
    motionMode,
    motionX,
    motionY,
    motionWidth,
    motionHeight,
    motionDurationMs,
    motionSpeedX,
    motionSpeedY,
    motionRestore,
    textInputName,
    textValue,
    inputSettingsJson,
    emergencyAction,
    alertAction,
    testEventType,
    statusEndpoint,
  };

  const updateBehavior = (patch: Partial<StreamDeckBehaviorValues>) => {
    if (patch.macroId !== undefined) setMacroId(patch.macroId);
    if (patch.sourceGroupId !== undefined) setSourceGroupId(patch.sourceGroupId);
    if (patch.sceneName !== undefined) {
      setSceneName(patch.sceneName);
      setSelectedObsScene(patch.sceneName);
    }
    if (patch.sourceName !== undefined) setSourceName(patch.sourceName);
    if (patch.sourceVisible !== undefined) setSourceVisible(patch.sourceVisible);
    if (patch.motionMode !== undefined) setMotionMode(patch.motionMode);
    if (patch.motionX !== undefined) setMotionX(patch.motionX);
    if (patch.motionY !== undefined) setMotionY(patch.motionY);
    if (patch.motionWidth !== undefined) setMotionWidth(patch.motionWidth);
    if (patch.motionHeight !== undefined) setMotionHeight(patch.motionHeight);
    if (patch.motionDurationMs !== undefined) setMotionDurationMs(patch.motionDurationMs);
    if (patch.motionSpeedX !== undefined) setMotionSpeedX(patch.motionSpeedX);
    if (patch.motionSpeedY !== undefined) setMotionSpeedY(patch.motionSpeedY);
    if (patch.motionRestore !== undefined) setMotionRestore(patch.motionRestore);
    if (patch.textInputName !== undefined) setTextInputName(patch.textInputName);
    if (patch.textValue !== undefined) setTextValue(patch.textValue);
    if (patch.inputSettingsJson !== undefined) setInputSettingsJson(patch.inputSettingsJson);
    if (patch.emergencyAction !== undefined) setEmergencyAction(patch.emergencyAction);
    if (patch.alertAction !== undefined) setAlertAction(patch.alertAction);
    if (patch.testEventType !== undefined) setTestEventType(patch.testEventType);
    if (patch.statusEndpoint !== undefined) setStatusEndpoint(patch.statusEndpoint);
    setTestResult(null);
  };

  const updateKeyAppearance = (patch: StreamDeckKeyAppearancePatch) => {
    setKeyTitle(patch.keyTitle);
    setKeyColor(patch.keyColor);
    setIconLabel(patch.iconLabel);
  };

  const designValues: StreamDeckDesignValues = {
    keyTitle,
    iconLabel,
    keyColor,
    showTitle,
    titleColor,
    fontSize,
    backgroundImageDataUrl,
    backgroundFit,
    backgroundOpacity,
    backgroundPositionX,
    backgroundPositionY,
    imageEffect,
    showArtworkOverlay,
    badgeText,
    subtitle,
    textPlacement,
    designTab,
  };

  const request = buildStreamDeckRequest(action, behaviorValues);
  const apiNinjaConfig = buildApiNinjaConfig(request, designValues);
  const exportInput = buildStreamDeckExportInput(request, designValues);

  const updateDesign = (patch: Partial<StreamDeckDesignValues>) => {
    if (patch.keyTitle !== undefined) setKeyTitle(patch.keyTitle);
    if (patch.iconLabel !== undefined) setIconLabel(patch.iconLabel);
    if (patch.keyColor !== undefined) setKeyColor(patch.keyColor);
    if (patch.showTitle !== undefined) setShowTitle(patch.showTitle);
    if (patch.titleColor !== undefined) setTitleColor(patch.titleColor);
    if (patch.fontSize !== undefined) setFontSize(patch.fontSize);
    if (patch.backgroundImageDataUrl !== undefined) setBackgroundImageDataUrl(patch.backgroundImageDataUrl);
    if (patch.backgroundFit !== undefined) setBackgroundFit(patch.backgroundFit);
    if (patch.backgroundOpacity !== undefined) setBackgroundOpacity(patch.backgroundOpacity);
    if (patch.backgroundPositionX !== undefined) setBackgroundPositionX(patch.backgroundPositionX);
    if (patch.backgroundPositionY !== undefined) setBackgroundPositionY(patch.backgroundPositionY);
    if (patch.imageEffect !== undefined) setImageEffect(patch.imageEffect);
    if (patch.showArtworkOverlay !== undefined) setShowArtworkOverlay(patch.showArtworkOverlay);
    if (patch.badgeText !== undefined) setBadgeText(patch.badgeText);
    if (patch.subtitle !== undefined) setSubtitle(patch.subtitle);
    if (patch.textPlacement !== undefined) setTextPlacement(patch.textPlacement);
    if (patch.designTab !== undefined) setDesignTab(patch.designTab);
    setTestResult(null);
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
        <StreamDeckActionPicker
          action={action}
          actionDetail={selectedActionInfo?.detail}
          groups={ACTION_GROUPS}
          presets={ACTION_PRESETS}
          onSelectAction={applyAction}
          onSelectPreset={applyPreset}
        />

        <StreamDeckBehaviorConfigurator
          action={action}
          values={behaviorValues}
          macros={macros}
          sourceGroups={sourceGroups}
          obsScenes={obsScenes}
          obsSources={obsSources}
          warnings={request.warnings}
          onChange={updateBehavior}
          onAppearanceChange={updateKeyAppearance}
        />
        <StreamDeckKeyDesigner
          values={designValues}
          onChange={updateDesign}
          onBackgroundUpload={(file) => void handleBackgroundUpload(file)}
          onPresetApplied={(title) => toast(`${title} visual preset applied`)}
        />
        <StreamDeckExportPanel
          request={request}
          exportInput={exportInput}
          apiNinjaConfig={apiNinjaConfig}
          testResult={testResult}
          copiedMessage={copied}
          onExportAction={(input) => void downloadStreamDeckAction(input).then(() => toast("Stream Deck action exported"))}
          onExportNinja={downloadApiNinjaButton}
          onCopyConfig={(config) => void copy(config, "API Ninja config copied")}
          onTest={() => void testRequest()}
        />
      </div>
    </Card>
  );
}
