import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertProjectSchema } from "@btv/shared";
import type { AlertLayer, AlertLayerAnimation, AlertProject, StreamEventType } from "@btv/shared";
import { api, type GiphyResult, type MediaAssetInfo, type SoundAssetInfo } from "../api";
import { useToast } from "../hooks/useToast";

const EVENT_TYPES: StreamEventType[] = ["follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points"];
const CANVAS_PRESETS = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "720p", width: 1280, height: 720 },
];
const BLEND_MODES = ["normal", "screen", "multiply", "overlay", "lighten", "darken", "color-dodge", "difference"] as const;
const ANIMATION_PRESETS: AlertLayerAnimation["preset"][] = [
  "none",
  "fade-in",
  "pop-in",
  "slide-in",
  "bounce-in",
  "elastic-in",
  "spin-in",
  "screen-slam",
  "glitch-reveal",
  "pulse",
  "float",
  "wiggle",
  "glow-pulse",
  "fade-out",
  "glitch-out",
];

type TemplateId = "clean-follow" | "neon-sub" | "raid-warning" | "cheer-burst" | "meme-pop";
type ProjectHistory = { past: AlertProject[]; future: AlertProject[] };
type PreviewZoom = "fit" | 0.25 | 0.5 | 1;
type AlertProjectWarning = { level: "warning" | "error"; message: string };
type ResizeHandle = "nw" | "ne" | "sw" | "se";
type CanvasDragState =
  | { kind: "move"; layerId: string; offsetX: number; offsetY: number }
  | {
    kind: "resize";
    layerId: string;
    handle: ResizeHandle;
    startX: number;
    startY: number;
    layer: Pick<AlertLayer, "x" | "y" | "width" | "height">;
  }
  | {
    kind: "rotate";
    layerId: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    startRotation: number;
  };

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createProject(): AlertProject {
  const now = nowIso();
  return {
    id: newId("alert"),
    name: "New cinematic alert",
    eventType: "follow",
    durationMs: 5000,
    canvas: {
      width: 1920,
      height: 1080,
      background: "transparent",
      backgroundColor: "transparent",
    },
    layers: [
      {
        id: newId("shape"),
        type: "shape",
        name: "Alert card",
        visible: true,
        locked: false,
        startMs: 0,
        endMs: 5000,
        x: 620,
        y: 390,
        width: 680,
        height: 250,
        rotation: 0,
        opacity: 1,
        scale: 1,
        blendMode: "normal",
        keyframes: [],
        shape: "rectangle",
        fill: "rgba(91, 140, 255, 0.86)",
        borderColor: "rgba(255,255,255,0.18)",
        borderWidth: 2,
        radius: 24,
      },
      {
        id: newId("text"),
        type: "text",
        name: "Title",
        visible: true,
        locked: false,
        startMs: 0,
        endMs: 5000,
        x: 690,
        y: 460,
        width: 540,
        height: 80,
        rotation: 0,
        opacity: 1,
        scale: 1,
        blendMode: "normal",
        keyframes: [],
        text: "{user}",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: 64,
        fontWeight: 900,
        color: "#ffffff",
        align: "center",
        strokeWidth: 0,
      },
      {
        id: newId("text"),
        type: "text",
        name: "Subtitle",
        visible: true,
        locked: false,
        startMs: 250,
        endMs: 5000,
        x: 720,
        y: 545,
        width: 480,
        height: 52,
        rotation: 0,
        opacity: 0.92,
        scale: 1,
        blendMode: "normal",
        keyframes: [],
        text: "Thanks for the {event}!",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: 30,
        fontWeight: 750,
        color: "#dbe6ff",
        align: "center",
        strokeWidth: 0,
      },
    ],
    tags: ["visual-editor"],
    createdAt: now,
    updatedAt: now,
  };
}

function withProjectMeta(project: Omit<AlertProject, "id" | "createdAt" | "updatedAt">): AlertProject {
  const now = nowIso();
  return {
    ...project,
    id: newId("alert"),
    createdAt: now,
    updatedAt: now,
  };
}

function createTemplateProject(template: TemplateId): AlertProject {
  const base = createProject();
  if (template === "clean-follow") return { ...base, name: "Clean Follow", eventType: "follow" };

  if (template === "neon-sub") {
    return withProjectMeta({
      name: "Neon Sub",
      eventType: "sub",
      durationMs: 5500,
      canvas: base.canvas,
      tags: ["template", "neon"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Neon plate", x: 560, y: 365, width: 800, height: 300, fill: "rgba(7, 10, 28, 0.92)", borderColor: "#5b8cff", borderWidth: 4, radius: 28, endMs: 5500, animation: { preset: "screen-slam", delayMs: 0, durationMs: 520, easing: "ease-out", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Subscriber", x: 610, y: 420, width: 700, height: 90, text: "{user} subscribed", fontSize: 66, color: "#ffffff", endMs: 5500, shadow: "0 0 22px #5b8cff", animation: { preset: "glitch-reveal", delayMs: 150, durationMs: 780, easing: "ease-out", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Subtitle", x: 700, y: 525, width: 520, height: 54, text: "Welcome to the signal", fontSize: 32, color: "#78f7ff", endMs: 5500, animation: { preset: "fade-in", delayMs: 550, durationMs: 650, easing: "ease-out", intensity: 1, loop: false } },
      ],
    });
  }

  if (template === "raid-warning") {
    return withProjectMeta({
      name: "Raid Warning",
      eventType: "raid",
      durationMs: 6500,
      canvas: base.canvas,
      tags: ["template", "raid"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Warning bar", x: 0, y: 405, width: 1920, height: 270, fill: "rgba(255, 90, 103, 0.88)", radius: 0, endMs: 6500, animation: { preset: "slide-in", delayMs: 0, durationMs: 500, easing: "ease-out", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Raid title", x: 420, y: 455, width: 1080, height: 90, text: "RAID INCOMING", fontSize: 84, color: "#ffffff", endMs: 6500, shadow: "0 0 20px rgba(0,0,0,0.6)", animation: { preset: "wiggle", delayMs: 500, durationMs: 700, easing: "ease-in-out", intensity: 1, loop: true } },
        { ...createLayer("text"), id: newId("text"), name: "Raider", x: 560, y: 555, width: 800, height: 60, text: "{user} brought the storm", fontSize: 38, color: "#ffe4e7", endMs: 6500, animation: { preset: "fade-in", delayMs: 700, durationMs: 500, easing: "ease-out", intensity: 1, loop: false } },
      ],
    });
  }

  if (template === "cheer-burst") {
    return withProjectMeta({
      name: "Cheer Burst",
      eventType: "cheer",
      durationMs: 5000,
      canvas: base.canvas,
      tags: ["template", "cheer"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Burst", shape: "ellipse", x: 710, y: 300, width: 500, height: 500, fill: "rgba(246, 199, 111, 0.9)", endMs: 5000, animation: { preset: "pop-in", delayMs: 0, durationMs: 450, easing: "ease-out", intensity: 1.2, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Bits", x: 610, y: 445, width: 700, height: 92, text: "{amount} BITS!", fontSize: 82, color: "#201409", endMs: 5000, animation: { preset: "bounce-in", delayMs: 150, durationMs: 800, easing: "bounce", intensity: 1, loop: false } },
      ],
    });
  }

  return withProjectMeta({
    name: "Meme Pop",
    eventType: "channel_points",
    durationMs: 4200,
    canvas: base.canvas,
    tags: ["template", "meme"],
    layers: [
      { ...createLayer("shape"), id: newId("shape"), name: "Sticker", x: 650, y: 360, width: 620, height: 320, fill: "rgba(255, 255, 255, 0.94)", borderColor: "#111722", borderWidth: 6, radius: 20, endMs: 4200, rotation: -4, animation: { preset: "elastic-in", delayMs: 0, durationMs: 800, easing: "elastic", intensity: 1, loop: false } },
      { ...createLayer("text"), id: newId("text"), name: "Message", x: 710, y: 440, width: 500, height: 110, text: "CHAT DID A THING", fontSize: 58, color: "#111722", endMs: 4200, rotation: -4, animation: { preset: "wiggle", delayMs: 800, durationMs: 600, easing: "ease-in-out", intensity: 1, loop: true } },
    ],
  });
}

function createLayer(type: AlertLayer["type"]): AlertLayer {
  const base = {
    id: newId(type),
    name: type === "text" ? "Text" : type === "shape" ? "Shape" : "Media",
    visible: true,
    locked: false,
    startMs: 0,
    endMs: 5000,
    x: 760,
    y: 430,
    width: type === "text" ? 420 : 360,
    height: type === "text" ? 100 : 240,
    rotation: 0,
    opacity: 1,
    scale: 1,
    blendMode: "normal",
    keyframes: [],
    filter: {
      blur: 0,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      hueRotate: 0,
      glow: 0,
      glowColor: "rgba(91, 140, 255, 0.9)",
    },
  };

  if (type === "text") {
    return {
      ...base,
      type,
      text: "New text",
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: 48,
      fontWeight: 800,
      color: "#ffffff",
      align: "center",
      strokeWidth: 0,
    };
  }

  if (type === "shape") {
    return {
      ...base,
      type,
      shape: "rectangle",
      fill: "rgba(91, 140, 255, 0.8)",
      borderColor: "transparent",
      borderWidth: 0,
      radius: 16,
    };
  }

  if (type === "audio") {
    return {
      ...base,
      type,
      assetUrl: "",
      volume: 1,
      loop: false,
    };
  }

  return {
    ...base,
    type,
    assetUrl: "",
    fit: "contain",
    loop: true,
    muted: true,
    volume: 1,
  };
}

function renderTemplate(text: string, eventType: StreamEventType): string {
  return text
    .replaceAll("{user}", "TestUser")
    .replaceAll("{event}", eventType)
    .replaceAll("{amount}", eventType === "cheer" ? "100" : "1");
}

function cssFilter(layer: AlertLayer): string | undefined {
  const filter = layer.filter;
  if (!filter) return undefined;
  const parts = [
    `brightness(${filter.brightness ?? 1})`,
    `contrast(${filter.contrast ?? 1})`,
    `saturate(${filter.saturation ?? 1})`,
  ];
  if (filter.blur) parts.push(`blur(${filter.blur}px)`);
  if (filter.hueRotate) parts.push(`hue-rotate(${filter.hueRotate}deg)`);
  if (filter.glow) parts.push(`drop-shadow(0 0 ${filter.glow}px ${filter.glowColor ?? "rgba(91, 140, 255, 0.9)"})`);
  return parts.join(" ");
}

function layerStyle(layer: AlertLayer): CSSProperties {
  const animation = layer.animation?.preset && layer.animation.preset !== "none"
    ? `${layer.animation.preset} ${layer.animation.durationMs}ms ${cssEasing(layer.animation.easing)} ${layer.animation.delayMs}ms ${layer.animation.loop ? "infinite" : "both"}`
    : undefined;
  return {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
    transformOrigin: "center",
    mixBlendMode: layer.blendMode as CSSProperties["mixBlendMode"],
    filter: cssFilter(layer),
    display: layer.visible ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    cursor: layer.locked ? "not-allowed" : "move",
    animation,
    "--btv-intensity": String(layer.animation?.intensity ?? 1),
  };
}

function cssEasing(easing?: AlertLayerAnimation["easing"]): string {
  if (easing === "linear") return "linear";
  if (easing === "ease-in") return "ease-in";
  if (easing === "ease-in-out") return "ease-in-out";
  if (easing === "bounce") return "cubic-bezier(.2,1.6,.35,1)";
  if (easing === "elastic") return "cubic-bezier(.2,1.8,.35,1)";
  return "ease-out";
}

function resolvePreviewAssetUrl(assetUrl: string, overlayOrigin: string): string {
  if (!assetUrl) return "";
  if (/^(https?:|data:|blob:)/i.test(assetUrl)) return assetUrl;
  if (assetUrl.startsWith("/")) return `${overlayOrigin.replace(/\/$/, "")}${assetUrl}`;
  return assetUrl;
}

function SelectionHandles({
  disabled,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  disabled: boolean;
  onResizePointerDown: (handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  if (disabled) return null;
  return (
    <>
      <span className="alert-rotate-handle" onPointerDown={onRotatePointerDown} />
      {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
        <span
          key={handle}
          className={`alert-resize-handle ${handle}`}
          onPointerDown={(event) => onResizePointerDown(handle, event)}
        />
      ))}
    </>
  );
}

function PreviewLayer({
  layer,
  eventType,
  selected,
  overlayOrigin,
  onPointerDown,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  layer: AlertLayer;
  eventType: StreamEventType;
  selected: boolean;
  overlayOrigin: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  const mediaUrl = layer.type === "video" || layer.type === "image" || layer.type === "gif"
    ? resolvePreviewAssetUrl(layer.assetUrl, overlayOrigin)
    : "";
  const selectionStyle: CSSProperties = selected
    ? { outline: "3px solid rgba(91, 140, 255, 0.95)", outlineOffset: 4 }
    : {};

  if (layer.type === "text") {
    return (
      <div
        onPointerDown={onPointerDown}
        style={{
          ...layerStyle(layer),
          ...selectionStyle,
          color: layer.color,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          textAlign: layer.align,
          WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor ?? "#000"}` : undefined,
          textShadow: layer.shadow,
          lineHeight: 1.05,
          whiteSpace: "pre-wrap",
        }}
      >
        {renderTemplate(layer.text, eventType)}
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "shape") {
    return (
      <div
        onPointerDown={onPointerDown}
        style={{
          ...layerStyle(layer),
          ...selectionStyle,
          background: layer.fill,
          border: `${layer.borderWidth}px solid ${layer.borderColor}`,
          borderRadius: layer.shape === "ellipse" ? "50%" : layer.radius,
        }}
      >
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "audio") return null;

  return (
    <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer), ...selectionStyle }}>
      {layer.assetUrl ? (
        layer.type === "video" ? (
          <video src={mediaUrl} muted={layer.muted} loop={layer.loop} autoPlay style={{ width: "100%", height: "100%", objectFit: layer.fit }} />
        ) : (
          <img src={mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: layer.fit }} />
        )
      ) : (
        <div style={{ width: "100%", height: "100%", border: "2px dashed rgba(255,255,255,0.35)", borderRadius: 8, display: "grid", placeItems: "center", color: "#dbe6ff" }}>
          Add asset URL
        </div>
      )}
      {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
    </div>
  );
}

function selectedPatch(project: AlertProject, layerId: string, patch: Partial<AlertLayer>): AlertProject {
  return {
    ...project,
    layers: project.layers.map((layer) => (layer.id === layerId ? ({ ...layer, ...patch } as AlertLayer) : layer)),
    updatedAt: nowIso(),
  };
}

function angleFromCenter(point: { x: number; y: number }, centerX: number, centerY: number): number {
  return Math.atan2(point.y - centerY, point.x - centerX) * (180 / Math.PI);
}

function projectSignature(project: AlertProject | null): string {
  return project ? JSON.stringify(project) : "";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+|_+$/g, "") || "alert-project";
}

function formatBytes(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function analyzeProject(project: AlertProject, media: MediaAssetInfo[], sounds: SoundAssetInfo[]): AlertProjectWarning[] {
  const warnings: AlertProjectWarning[] = [];
  const mediaByUrl = new Map(media.map((asset) => [asset.url, asset]));
  const soundsByUrl = new Map(sounds.map((asset) => [asset.url, asset]));
  const mediaLayers = project.layers.filter((layer) => ["image", "gif", "video", "audio"].includes(layer.type));
  const heavyFilterLayers = project.layers.filter((layer) => (layer.filter?.blur ?? 0) > 20 || (layer.filter?.glow ?? 0) > 50);
  const videoLayers = project.layers.filter((layer) => layer.type === "video");

  for (const layer of mediaLayers) {
    if (layer.type !== "image" && layer.type !== "gif" && layer.type !== "video" && layer.type !== "audio") continue;
    if (!layer.assetUrl) {
      warnings.push({ level: "error", message: `${layer.name} has no asset URL.` });
      continue;
    }
    if (/^(https?:|data:|blob:)/i.test(layer.assetUrl)) continue;
    const asset = layer.type === "audio" ? soundsByUrl.get(layer.assetUrl) : mediaByUrl.get(layer.assetUrl);
    if (!asset) {
      warnings.push({ level: "error", message: `${layer.name} points to a local asset that was not found: ${layer.assetUrl}` });
      continue;
    }
    const maxSize = layer.type === "audio" ? 12 * 1024 * 1024 : layer.type === "video" ? 40 * 1024 * 1024 : 15 * 1024 * 1024;
    if (asset.size > maxSize) {
      warnings.push({ level: "warning", message: `${layer.name} is large (${formatBytes(asset.size)}). Consider trimming or compressing it.` });
    }
  }

  if (mediaLayers.length > 8) warnings.push({ level: "warning", message: `${mediaLayers.length} media layers may be heavy for OBS browser source playback.` });
  if (videoLayers.length > 2) warnings.push({ level: "warning", message: `${videoLayers.length} video layers may stutter on lower-end stream PCs.` });
  if (heavyFilterLayers.length > 3) warnings.push({ level: "warning", message: `${heavyFilterLayers.length} layers use heavy blur/glow effects.` });
  if (project.durationMs > 30000) warnings.push({ level: "warning", message: "Alert duration is over 30 seconds." });

  return warnings;
}

export default function AlertEditorPage() {
  const [searchParams] = useSearchParams();
  const { id: routeProjectId } = useParams<{ id: string }>();
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [project, setProject] = useState<AlertProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [previewBackground, setPreviewBackground] = useState<"checkerboard" | "dark" | "transparent">("checkerboard");
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>("fit");
  const [previewFitScale, setPreviewFitScale] = useState(0.34);
  const [giphyQuery, setGiphyQuery] = useState("");
  const [giphyResults, setGiphyResults] = useState<GiphyResult[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetKind, setAssetKind] = useState<"all" | "image" | "gif" | "video" | "audio">("all");
  const [mediaAssets, setMediaAssets] = useState<MediaAssetInfo[]>([]);
  const [soundAssets, setSoundAssets] = useState<SoundAssetInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [overlayOrigin, setOverlayOrigin] = useState("http://127.0.0.1:4782");
  const [savedSignature, setSavedSignature] = useState("");
  const [history, setHistory] = useState<ProjectHistory>({ past: [], future: [] });
  const previewShellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<CanvasDragState | null>(null);
  const toast = useToast();

  const selectedLayer = useMemo(
    () => project?.layers.find((layer) => layer.id === selectedLayerId) ?? project?.layers[0] ?? null,
    [project, selectedLayerId],
  );

  const dirty = useMemo(() => projectSignature(project) !== savedSignature, [project, savedSignature]);
  const previewScale = previewZoom === "fit" ? previewFitScale : previewZoom;
  const activeCanvasPreset = useMemo(() => {
    if (!project) return "";
    const preset = CANVAS_PRESETS.find((item) => item.width === project.canvas.width && item.height === project.canvas.height);
    return preset ? `${preset.width}x${preset.height}` : "custom";
  }, [project?.canvas.width, project?.canvas.height]);
  const projectWarnings = useMemo(
    () => project ? analyzeProject(project, mediaAssets, soundAssets) : [],
    [project, mediaAssets, soundAssets],
  );
  const filteredMediaAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return mediaAssets.filter((asset) => {
      if (assetKind !== "all" && asset.kind !== assetKind) return false;
      return !query || asset.name.toLowerCase().includes(query);
    });
  }, [assetKind, assetSearch, mediaAssets]);
  const filteredSoundAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (assetKind !== "all" && assetKind !== "audio") return [];
    return soundAssets.filter((asset) => !query || asset.name.toLowerCase().includes(query));
  }, [assetKind, assetSearch, soundAssets]);

  const selectProject = (next: AlertProject | null) => {
    setProject(next);
    setSelectedLayerId(next?.layers[0]?.id ?? "");
    setPlayheadMs(0);
    setPlaying(false);
    setHistory({ past: [], future: [] });
    setSavedSignature(projectSignature(next));
  };

  const commitProject = (next: AlertProject, options: { recordHistory?: boolean } = {}) => {
    const recordHistory = options.recordHistory ?? true;
    if (recordHistory && project && project.id === next.id) {
      setHistory((prev) => ({ past: [...prev.past.slice(-49), project], future: [] }));
    }
    setProject(next);
  };

  const load = () => {
    void Promise.all([api.alertProjects(), api.listMedia(), api.listSounds()]).then(([items, media, sounds]) => {
      setProjects(items);
      setMediaAssets(media.media);
      setSoundAssets(sounds.sounds);
      setProject((prev) => {
        const requested = routeProjectId ?? searchParams.get("id");
        const next = (requested ? items.find((item) => item.id === requested) : null) ?? prev ?? items[0] ?? null;
        if (!prev) {
          setSelectedLayerId(next?.layers[0]?.id ?? "");
          setSavedSignature(projectSignature(next));
        }
        return next;
      });
    });
  };

  useEffect(load, []);

  useEffect(() => {
    const id = routeProjectId ?? searchParams.get("id");
    if (!id || !projects.length || project?.id === id) return;
    const next = projects.find((item) => item.id === id);
    if (next) selectProject(next);
  }, [routeProjectId, searchParams, projects, project?.id]);

  useEffect(() => {
    void api.health()
      .then((info) => {
        if (info.overlayUrl) setOverlayOrigin(info.overlayUrl);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!project || !previewShellRef.current) return;
    const shell = previewShellRef.current;
    const updateFitScale = () => {
      const rect = shell.getBoundingClientRect();
      const padding = 24;
      const widthScale = Math.max(0.05, (rect.width - padding) / project.canvas.width);
      const heightScale = Math.max(0.05, (rect.height - padding) / project.canvas.height);
      setPreviewFitScale(Math.min(1, widthScale, heightScale));
    };

    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [project?.canvas.width, project?.canvas.height]);

  useEffect(() => {
    if (!playing || !project) return;
    const startedAt = Date.now() - playheadMs;
    const timer = setInterval(() => {
      const next = Date.now() - startedAt;
      if (next >= project.durationMs) {
        setPlayheadMs(project.durationMs);
        setPlaying(false);
      } else {
        setPlayheadMs(next);
      }
    }, 33);
    return () => clearInterval(timer);
  }, [playing, project?.durationMs]);

  const save = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const next = { ...project, updatedAt: nowIso() };
      await api.saveAlertProject(next);
      setProject(next);
      setSavedSignature(projectSignature(next));
      toast("Alert project saved");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testProjectInObs = async (eventType: StreamEventType) => {
    if (!project) return;
    setSaving(true);
    try {
      const next = { ...project, eventType, updatedAt: nowIso() };
      await api.saveAlertProject(next);
      setProject(next);
      setSavedSignature(projectSignature(next));
      await api.testAlertProject(next.id, eventType);
      setPlayheadMs(0);
      setPlaying(true);
      toast(`Test ${eventType} sent to OBS alert source`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test alert failed");
    } finally {
      setSaving(false);
    }
  };

  const createNew = () => {
    const next = createProject();
    setProjects((prev) => [next, ...prev]);
    setProject(next);
    setSelectedLayerId(next.layers[0]?.id ?? "");
    setPlayheadMs(0);
    setHistory({ past: [], future: [] });
    setSavedSignature("");
  };

  const createFromTemplate = (template: TemplateId) => {
    const next = createTemplateProject(template);
    setProjects((prev) => [next, ...prev]);
    setProject(next);
    setSelectedLayerId(next.layers[0]?.id ?? "");
    setPlayheadMs(0);
    setHistory({ past: [], future: [] });
    setSavedSignature("");
  };

  const duplicateProject = () => {
    if (!project) return;
    const now = nowIso();
    const next: AlertProject = {
      ...project,
      id: newId("alert"),
      name: `${project.name} copy`,
      layers: project.layers.map((layer) => ({ ...layer, id: newId(layer.type) }) as AlertLayer),
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [next, ...prev]);
    setProject(next);
    setSelectedLayerId(next.layers[0]?.id ?? "");
    setPlayheadMs(0);
    setHistory({ past: [], future: [] });
    setSavedSignature("");
  };

  const removeProject = async () => {
    if (!project) return;
    await api.deleteAlertProject(project.id);
    toast("Alert project deleted");
    setProject(null);
    setSelectedLayerId("");
    load();
  };

  const exportProject = () => {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(project.name)}.btv-alert.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as Partial<AlertProject>;
      const now = nowIso();
      const parsed = AlertProjectSchema.safeParse({
        ...raw,
        id: newId("alert"),
        name: raw.name ? `${raw.name} import` : "Imported alert",
        createdAt: now,
        updatedAt: now,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid alert project JSON");
      await api.saveAlertProject(parsed.data);
      setProjects((prev) => [parsed.data, ...prev]);
      selectProject(parsed.data);
      toast("Alert project imported");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed");
    }
  };

  const copyObsAlertUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${overlayOrigin.replace(/\/$/, "")}/o/alerts.html`);
      toast("OBS alert browser source URL copied");
    } catch {
      toast("Could not copy OBS URL");
    }
  };

  const addLayer = (type: AlertLayer["type"]) => {
    if (!project) return;
    const layer = createLayer(type);
    commitProject({ ...project, layers: [...project.layers, layer], updatedAt: nowIso() });
    setSelectedLayerId(layer.id);
  };

  const searchGiphy = async (query = giphyQuery) => {
    setGiphyLoading(true);
    try {
      const res = query.trim() ? await api.giphySearch(query.trim()) : await api.giphyTrending();
      setGiphyResults(res.results);
      if (!res.results.length) toast("No GIPHY results");
    } catch (err) {
      toast(err instanceof Error ? err.message : "GIPHY search failed");
    } finally {
      setGiphyLoading(false);
    }
  };

  const importGif = async (gif: GiphyResult) => {
    if (!project) return;
    setGiphyLoading(true);
    try {
      const saved = await api.importGiphy(gif);
      if (selectedLayer && (selectedLayer.type === "gif" || selectedLayer.type === "image" || selectedLayer.type === "video")) {
        updateSelected({ type: "gif", assetUrl: saved.url, fit: "contain", loop: true, muted: true, volume: 1 } as Partial<AlertLayer>);
      } else {
        const layer = {
          ...createLayer("gif"),
          name: gif.title || "GIPHY GIF",
          assetUrl: saved.url,
          width: Math.min(520, Math.max(240, gif.width || 360)),
          height: Math.min(420, Math.max(180, gif.height || 260)),
        } as AlertLayer;
        commitProject({ ...project, layers: [...project.layers, layer], updatedAt: nowIso() });
        setSelectedLayerId(layer.id);
      }
      toast("GIF imported");
    } catch (err) {
      toast(err instanceof Error ? err.message : "GIPHY import failed");
    } finally {
      setGiphyLoading(false);
    }
  };

  const uploadSelectedAsset = async (file: File) => {
    if (!selectedLayer || (selectedLayer.type !== "audio" && selectedLayer.type !== "video")) return;
    setAssetUploading(true);
    try {
      const data = await fileToBase64(file);
      const saved = selectedLayer.type === "audio"
        ? await api.uploadSound(file.name, data)
        : await api.uploadMedia(file.name, data);
      updateSelected({
        assetUrl: saved.url,
        ...(selectedLayer.type === "video" ? { fit: "contain", loop: true, muted: true, volume: 1 } : { volume: 1, loop: false }),
      } as Partial<AlertLayer>);
      toast(`${selectedLayer.type === "audio" ? "Audio" : "Video"} uploaded`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Asset upload failed");
    } finally {
      setAssetUploading(false);
    }
  };

  const applyMediaAsset = (asset: MediaAssetInfo) => {
    if (!project) return;
    if (selectedLayer && (selectedLayer.type === "image" || selectedLayer.type === "gif" || selectedLayer.type === "video")) {
      updateSelected({ type: asset.kind, assetUrl: asset.url, fit: "contain", loop: true, muted: true, volume: 1 } as Partial<AlertLayer>);
      return;
    }
    const layer = {
      ...createLayer(asset.kind),
      name: asset.name,
      assetUrl: asset.url,
    } as AlertLayer;
    commitProject({ ...project, layers: [...project.layers, layer], updatedAt: nowIso() });
    setSelectedLayerId(layer.id);
  };

  const applySoundAsset = (asset: SoundAssetInfo) => {
    if (!project) return;
    if (selectedLayer?.type === "audio") {
      updateSelected({ assetUrl: asset.url, volume: 1, loop: false } as Partial<AlertLayer>);
      return;
    }
    const layer = {
      ...createLayer("audio"),
      name: asset.name,
      assetUrl: asset.url,
    } as AlertLayer;
    commitProject({ ...project, layers: [...project.layers, layer], updatedAt: nowIso() });
    setSelectedLayerId(layer.id);
  };

  const uploadLibraryAsset = async (file: File, kind: "media" | "sound") => {
    setAssetUploading(true);
    try {
      const data = await fileToBase64(file);
      if (kind === "sound") {
        const saved = await api.uploadSound(file.name, data);
        setSoundAssets((prev) => [...prev.filter((asset) => asset.name !== saved.name), { ...saved, size: file.size }].sort((a, b) => a.name.localeCompare(b.name)));
        applySoundAsset({ ...saved, size: file.size });
      } else {
        const saved = await api.uploadMedia(file.name, data);
        const media = { ...saved, kind: saved.kind as MediaAssetInfo["kind"], size: file.size };
        setMediaAssets((prev) => [...prev.filter((asset) => asset.name !== media.name), media].sort((a, b) => a.name.localeCompare(b.name)));
        applyMediaAsset(media);
      }
      toast("Asset uploaded");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Asset upload failed");
    } finally {
      setAssetUploading(false);
    }
  };

  const deleteLibraryAsset = async (asset: MediaAssetInfo | SoundAssetInfo, kind: "media" | "sound") => {
    try {
      if (kind === "sound") {
        await api.deleteSound(asset.name);
        setSoundAssets((prev) => prev.filter((item) => item.name !== asset.name));
      } else {
        await api.deleteMedia(asset.name);
        setMediaAssets((prev) => prev.filter((item) => item.name !== asset.name));
      }
      toast("Asset deleted");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const updateSelected = (patch: Partial<AlertLayer>) => {
    if (!project || !selectedLayer) return;
    commitProject(selectedPatch(project, selectedLayer.id, patch));
  };

  const updateSelectedFilter = (patch: Partial<NonNullable<AlertLayer["filter"]>>) => {
    if (!selectedLayer) return;
    updateSelected({
      filter: {
        blur: selectedLayer.filter?.blur ?? 0,
        brightness: selectedLayer.filter?.brightness ?? 1,
        contrast: selectedLayer.filter?.contrast ?? 1,
        saturation: selectedLayer.filter?.saturation ?? 1,
        hueRotate: selectedLayer.filter?.hueRotate ?? 0,
        glow: selectedLayer.filter?.glow ?? 0,
        glowColor: selectedLayer.filter?.glowColor ?? "rgba(91, 140, 255, 0.9)",
        ...patch,
      },
    } as Partial<AlertLayer>);
  };

  const visibleAtPlayhead = (layer: AlertLayer) => {
    return layer.visible && playheadMs >= layer.startMs && playheadMs <= layer.endMs;
  };

  const canvasPoint = (event: PointerEvent | ReactPointerEvent) => {
    if (!project || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = rect.width / project.canvas.width;
    const scaleY = rect.height / project.canvas.height;
    return {
      x: (event.clientX - rect.left) / scaleX,
      y: (event.clientY - rect.top) / scaleY,
    };
  };

  const startDrag = (layer: AlertLayer, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    if (layer.locked) return;
    const point = canvasPoint(event);
    if (!point) return;
    setHistory((prev) => ({ past: [...prev.past.slice(-49), project!], future: [] }));
    dragRef.current = {
      kind: "move",
      layerId: layer.id,
      offsetX: point.x - layer.x,
      offsetY: point.y - layer.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startResize = (layer: AlertLayer, handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    if (layer.locked) return;
    const point = canvasPoint(event);
    if (!point) return;
    setHistory((prev) => ({ past: [...prev.past.slice(-49), project!], future: [] }));
    dragRef.current = {
      kind: "resize",
      layerId: layer.id,
      handle,
      startX: point.x,
      startY: point.y,
      layer: {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startRotate = (layer: AlertLayer, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    if (layer.locked) return;
    const point = canvasPoint(event);
    if (!point) return;
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    setHistory((prev) => ({ past: [...prev.past.slice(-49), project!], future: [] }));
    dragRef.current = {
      kind: "rotate",
      layerId: layer.id,
      centerX,
      centerY,
      startAngle: angleFromCenter(point, centerX, centerY),
      startRotation: layer.rotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragLayer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!project || !dragRef.current) return;
    const point = canvasPoint(event);
    if (!point) return;
    const drag = dragRef.current;

    if (drag.kind === "move") {
      const layer = project.layers.find((item) => item.id === drag.layerId);
      if (!layer) return;
      let x = Math.round(point.x - drag.offsetX);
      let y = Math.round(point.y - drag.offsetY);
      const snapDistance = 12;
      const canvasCenterX = project.canvas.width / 2;
      const canvasCenterY = project.canvas.height / 2;
      if (Math.abs(x + layer.width / 2 - canvasCenterX) <= snapDistance) x = Math.round(canvasCenterX - layer.width / 2);
      if (Math.abs(y + layer.height / 2 - canvasCenterY) <= snapDistance) y = Math.round(canvasCenterY - layer.height / 2);
      const safeLeft = Math.round(project.canvas.width * 0.05);
      const safeTop = Math.round(project.canvas.height * 0.05);
      const safeRight = Math.round(project.canvas.width * 0.95);
      const safeBottom = Math.round(project.canvas.height * 0.95);
      if (Math.abs(x - safeLeft) <= snapDistance) x = safeLeft;
      if (Math.abs(y - safeTop) <= snapDistance) y = safeTop;
      if (Math.abs(x + layer.width - safeRight) <= snapDistance) x = safeRight - layer.width;
      if (Math.abs(y + layer.height - safeBottom) <= snapDistance) y = safeBottom - layer.height;
      setProject(selectedPatch(project, drag.layerId, { x, y }));
      return;
    }

    if (drag.kind === "rotate") {
      const angle = angleFromCenter(point, drag.centerX, drag.centerY);
      const rawRotation = drag.startRotation + angle - drag.startAngle;
      const rotation = event.shiftKey ? Math.round(rawRotation / 15) * 15 : Math.round(rawRotation);
      setProject(selectedPatch(project, drag.layerId, { rotation }));
      return;
    }

    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const minSize = 24;
    let x = drag.layer.x;
    let y = drag.layer.y;
    let width = drag.layer.width;
    let height = drag.layer.height;

    if (drag.handle.includes("e")) width = Math.max(minSize, drag.layer.width + dx);
    if (drag.handle.includes("s")) height = Math.max(minSize, drag.layer.height + dy);
    if (drag.handle.includes("w")) {
      width = Math.max(minSize, drag.layer.width - dx);
      x = drag.layer.x + (drag.layer.width - width);
    }
    if (drag.handle.includes("n")) {
      height = Math.max(minSize, drag.layer.height - dy);
      y = drag.layer.y + (drag.layer.height - height);
    }

    setProject(selectedPatch(project, drag.layerId, {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    }));
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  const duplicateLayer = () => {
    if (!project || !selectedLayer) return;
    const layer = { ...selectedLayer, id: newId(selectedLayer.type), name: `${selectedLayer.name} copy`, x: selectedLayer.x + 30, y: selectedLayer.y + 30 } as AlertLayer;
    commitProject({ ...project, layers: [...project.layers, layer], updatedAt: nowIso() });
    setSelectedLayerId(layer.id);
  };

  const deleteLayer = () => {
    if (!project || !selectedLayer) return;
    const layers = project.layers.filter((layer) => layer.id !== selectedLayer.id);
    commitProject({ ...project, layers, updatedAt: nowIso() });
    setSelectedLayerId(layers[0]?.id ?? "");
  };

  const moveLayer = (direction: -1 | 1) => {
    if (!project || !selectedLayer) return;
    const index = project.layers.findIndex((layer) => layer.id === selectedLayer.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= project.layers.length) return;
    const layers = [...project.layers];
    const [layer] = layers.splice(index, 1);
    if (!layer) return;
    layers.splice(nextIndex, 0, layer);
    commitProject({ ...project, layers, updatedAt: nowIso() });
  };

  const alignSelected = (mode: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (!project || !selectedLayer) return;
    const patch: Partial<AlertLayer> = {};
    if (mode === "left") patch.x = 0;
    if (mode === "center") patch.x = Math.round((project.canvas.width - selectedLayer.width) / 2);
    if (mode === "right") patch.x = project.canvas.width - selectedLayer.width;
    if (mode === "top") patch.y = 0;
    if (mode === "middle") patch.y = Math.round((project.canvas.height - selectedLayer.height) / 2);
    if (mode === "bottom") patch.y = project.canvas.height - selectedLayer.height;
    updateSelected(patch);
  };

  const applyCanvasPreset = (value: string) => {
    if (!project || value === "custom") return;
    const preset = CANVAS_PRESETS.find((item) => `${item.width}x${item.height}` === value);
    if (!preset) return;
    commitProject({
      ...project,
      canvas: {
        ...project.canvas,
        width: preset.width,
        height: preset.height,
      },
      updatedAt: nowIso(),
    });
    setPreviewZoom("fit");
  };

  const restartPreview = () => {
    setPlayheadMs(0);
    setPlaying(true);
  };

  const applyAnimationPreset = (preset: AlertLayerAnimation["preset"]) => {
    if (!selectedLayer) return;
    const animation: AlertLayerAnimation = {
      preset,
      delayMs: selectedLayer.animation?.delayMs ?? 0,
      durationMs: selectedLayer.animation?.durationMs ?? (preset.includes("out") ? 550 : 700),
      easing: preset === "bounce-in" ? "bounce" : preset === "elastic-in" ? "elastic" : "ease-out",
      intensity: selectedLayer.animation?.intensity ?? 1,
      loop: ["pulse", "float", "wiggle", "glow-pulse"].includes(preset),
    };
    updateSelected({ animation } as Partial<AlertLayer>);
    restartPreview();
  };

  const undoProject = () => {
    setHistory((prev) => {
      const previous = prev.past.at(-1);
      if (!previous || !project) return prev;
      setProject(previous);
      setSelectedLayerId((current) => previous.layers.some((layer) => layer.id === current) ? current : previous.layers[0]?.id ?? "");
      return { past: prev.past.slice(0, -1), future: [project, ...prev.future] };
    });
  };

  const redoProject = () => {
    setHistory((prev) => {
      const next = prev.future[0];
      if (!next || !project) return prev;
      setProject(next);
      setSelectedLayerId((current) => next.layers.some((layer) => layer.id === current) ? current : next.layers[0]?.id ?? "");
      return { past: [...prev.past, project], future: prev.future.slice(1) };
    });
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selectedLayer || selectedLayer.locked) return;
    updateSelected({ x: selectedLayer.x + dx, y: selectedLayer.y + dy });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoProject();
        return;
      }
      if ((mod && key === "y") || (mod && event.shiftKey && key === "z")) {
        event.preventDefault();
        redoProject();
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        duplicateLayer();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteLayer();
        return;
      }
      const nudge = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelected(-nudge, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelected(nudge, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeSelected(0, -nudge);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeSelected(0, nudge);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [project, selectedLayer]);

  return (
    <>
      <h1>Visual Alert Editor</h1>
      <p className="subtitle">Create, test, and manage BTV's primary cinematic alert projects.</p>

      <div className="actions" style={{ marginBottom: 16, alignItems: "center" }}>
        <select
          value={project?.id ?? ""}
          onChange={(e) => selectProject(projects.find((item) => item.id === e.target.value) ?? null)}
          style={{ width: 240 }}
        >
          {projects.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={!project || saving}>
          {saving ? "Saving..." : dirty ? "Save project *" : "Save project"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={undoProject} disabled={!history.past.length}>Undo</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={redoProject} disabled={!history.future.length}>Redo</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={createNew}>New project</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={duplicateProject} disabled={!project}>Duplicate project</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={exportProject} disabled={!project}>Export JSON</button>
        <label className="btn btn-secondary btn-sm">
          Import JSON
          <input
            type="file"
            accept="application/json,.json,.btv-alert.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) void importProject(file);
            }}
          />
        </label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyObsAlertUrl()}>Copy OBS URL</button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeProject()} disabled={!project}>Delete</button>
        <Link className="btn btn-secondary btn-sm" to="/alert-rules">Advanced routing</Link>
        <Link className="btn btn-secondary btn-sm" to="/themes">Legacy themes</Link>
        <span className={`alert-save-status${dirty ? " dirty" : ""}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>

      {project && (
        <div className="alert-editor-grid">
          <section className="card">
            <h2>Project</h2>
            <div className="form-row">
              <label>Start from template</label>
              <select value="" onChange={(e) => e.target.value && createFromTemplate(e.target.value as TemplateId)}>
                <option value="">Choose template</option>
                <option value="clean-follow">Clean Follow</option>
                <option value="neon-sub">Neon Sub</option>
                <option value="raid-warning">Raid Warning</option>
                <option value="cheer-burst">Cheer Burst</option>
                <option value="meme-pop">Meme Pop</option>
              </select>
            </div>
            <div className="form-row">
              <label>Name</label>
              <input value={project.name} onChange={(e) => commitProject({ ...project, name: e.target.value, updatedAt: nowIso() })} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label>Event type</label>
                <select value={project.eventType} onChange={(e) => commitProject({ ...project, eventType: e.target.value as StreamEventType, updatedAt: nowIso() })}>
                  {EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label>Duration (ms)</label>
                <input type="number" min={500} max={60000} value={project.durationMs} onChange={(e) => commitProject({ ...project, durationMs: Number(e.target.value), updatedAt: nowIso() })} />
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label>Canvas preset</label>
                <select value={activeCanvasPreset} onChange={(e) => applyCanvasPreset(e.target.value)}>
                  {CANVAS_PRESETS.map((preset) => (
                    <option key={preset.label} value={`${preset.width}x${preset.height}`}>{preset.label} ({preset.width}x{preset.height})</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label>Canvas size</label>
                <div className="alert-canvas-size">
                  <input
                    type="number"
                    min={320}
                    value={project.canvas.width}
                    onChange={(e) => commitProject({ ...project, canvas: { ...project.canvas, width: Number(e.target.value) }, updatedAt: nowIso() })}
                    aria-label="Canvas width"
                  />
                  <span>x</span>
                  <input
                    type="number"
                    min={180}
                    value={project.canvas.height}
                    onChange={(e) => commitProject({ ...project, canvas: { ...project.canvas, height: Number(e.target.value) }, updatedAt: nowIso() })}
                    aria-label="Canvas height"
                  />
                </div>
              </div>
            </div>
            <div className="actions" style={{ marginTop: 0, marginBottom: 16 }}>
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`btn btn-sm ${project.eventType === type ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => void testProjectInObs(type)}
                  disabled={saving}
                >
                  Test {type}
                </button>
              ))}
            </div>

            <h2 style={{ marginTop: 16 }}>Layers</h2>
            {projectWarnings.length > 0 && (
              <section className="alert-health-panel">
                <h3>Project checks</h3>
                {projectWarnings.slice(0, 5).map((warning, index) => (
                  <p key={`${warning.message}-${index}`} className={warning.level}>
                    {warning.message}
                  </p>
                ))}
                {projectWarnings.length > 5 && (
                  <p className="warning">{projectWarnings.length - 5} more issue(s) hidden.</p>
                )}
              </section>
            )}
            <div className="actions" style={{ marginBottom: 12 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("text")}>Text</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("shape")}>Shape</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("image")}>Image</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("gif")}>GIF</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("video")}>Video</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("audio")}>Audio</button>
            </div>
            <div className="layer-list">
              {project.layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={`layer-row${selectedLayer?.id === layer.id ? " active" : ""}`}
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  <span>{layer.visible ? "Shown" : "Hidden"}</span>
                  <strong>{layer.name}</strong>
                  <em>{layer.type}</em>
                </button>
              ))}
            </div>
            <div className="actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveLayer(-1)} disabled={!selectedLayer}>Up</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveLayer(1)} disabled={!selectedLayer}>Down</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={duplicateLayer} disabled={!selectedLayer}>Duplicate</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={deleteLayer} disabled={!selectedLayer}>Delete layer</button>
            </div>

            <h2 style={{ marginTop: 18 }}>Assets</h2>
            <div className="grid" style={{ gridTemplateColumns: "1fr 120px" }}>
              <div>
                <label>Search local assets</label>
                <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="filename..." />
              </div>
              <div>
                <label>Type</label>
                <select value={assetKind} onChange={(e) => setAssetKind(e.target.value as typeof assetKind)}>
                  <option value="all">All</option>
                  <option value="image">Images</option>
                  <option value="gif">GIFs</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                </select>
              </div>
            </div>
            <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
              <label className="btn btn-secondary btn-sm">
                Upload media
                <input
                  type="file"
                  accept="image/*,video/*,.gif,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
                  style={{ display: "none" }}
                  disabled={assetUploading}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void uploadLibraryAsset(file, "media");
                  }}
                />
              </label>
              <label className="btn btn-secondary btn-sm">
                Upload sound
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                  style={{ display: "none" }}
                  disabled={assetUploading}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void uploadLibraryAsset(file, "sound");
                  }}
                />
              </label>
            </div>
            <div className="asset-library-grid">
              {filteredMediaAssets.map((asset) => (
                <div key={asset.url} className="asset-card">
                  <button type="button" onClick={() => applyMediaAsset(asset)} title={`Use ${asset.name}`}>
                    {asset.kind === "video" ? (
                      <video src={resolvePreviewAssetUrl(asset.url, overlayOrigin)} muted />
                    ) : (
                      <img src={resolvePreviewAssetUrl(asset.url, overlayOrigin)} alt="" />
                    )}
                    <strong>{asset.name}</strong>
                    <span>{asset.kind} - {formatBytes(asset.size)}</span>
                  </button>
                  <button type="button" className="asset-delete" onClick={() => void deleteLibraryAsset(asset, "media")}>Delete</button>
                </div>
              ))}
              {filteredSoundAssets.map((asset) => (
                <div key={asset.url} className="asset-card audio">
                  <button type="button" onClick={() => applySoundAsset(asset)} title={`Use ${asset.name}`}>
                    <strong>{asset.name}</strong>
                    <span>audio - {formatBytes(asset.size)}</span>
                  </button>
                  <button type="button" className="asset-delete" onClick={() => void deleteLibraryAsset(asset, "sound")}>Delete</button>
                </div>
              ))}
            </div>
            {!filteredMediaAssets.length && !filteredSoundAssets.length && (
              <p className="subtitle">No local assets match this filter.</p>
            )}

            <h2 style={{ marginTop: 18 }}>GIPHY</h2>
            <div className="form-row">
              <label>Search GIFs</label>
              <input
                value={giphyQuery}
                onChange={(e) => setGiphyQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void searchGiphy();
                }}
                placeholder="hype, raid, explosion..."
              />
            </div>
            <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void searchGiphy()} disabled={giphyLoading}>
                {giphyLoading ? "Searching..." : "Search"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void searchGiphy("")} disabled={giphyLoading}>
                Trending
              </button>
            </div>
            <div className="giphy-grid">
              {giphyResults.map((gif) => (
                <button key={gif.id} type="button" className="giphy-card" onClick={() => void importGif(gif)} title={gif.title}>
                  <img src={gif.previewUrl} alt={gif.title} />
                  <span>{gif.title || "Import GIF"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card alert-preview-card">
            <div className="alert-editor-panel-title">
              <h2>Live Preview</h2>
              <div className="actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlaying((v) => !v)}>
                  {playing ? "Pause" : "Play"}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={restartPreview}>Restart</button>
              </div>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
              <div>
                <label>Preview background</label>
                <select value={previewBackground} onChange={(e) => setPreviewBackground(e.target.value as typeof previewBackground)}>
                  <option value="checkerboard">Checkerboard</option>
                  <option value="dark">Dark</option>
                  <option value="transparent">Transparent</option>
                </select>
              </div>
              <label style={{ alignSelf: "center", marginTop: 16 }}>
                <input type="checkbox" checked={showSafeZones} onChange={(e) => setShowSafeZones(e.target.checked)} /> Safe zones
              </label>
            </div>
            <div className="alert-preview-tools">
              <span>{project.canvas.width}x{project.canvas.height}</span>
              <div className="segmented">
                <button type="button" className={previewZoom === "fit" ? "active" : ""} onClick={() => setPreviewZoom("fit")}>Fit</button>
                <button type="button" className={previewZoom === 0.25 ? "active" : ""} onClick={() => setPreviewZoom(0.25)}>25%</button>
                <button type="button" className={previewZoom === 0.5 ? "active" : ""} onClick={() => setPreviewZoom(0.5)}>50%</button>
                <button type="button" className={previewZoom === 1 ? "active" : ""} onClick={() => setPreviewZoom(1)}>100%</button>
              </div>
            </div>
            <div className="alert-preview-shell" ref={previewShellRef}>
              <div
                ref={canvasRef}
                className={`alert-preview-canvas ${previewBackground === "checkerboard" ? "checkerboard" : ""} ${previewBackground === "dark" ? "dark" : ""}`}
                onPointerMove={dragLayer}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                style={{
                  width: project.canvas.width,
                  height: project.canvas.height,
                  background: project.canvas.background === "solid" ? project.canvas.backgroundColor : undefined,
                  transform: `scale(${previewScale})`,
                }}
              >
                {showSafeZones && <div className="alert-safe-zone" />}
                {project.layers.filter(visibleAtPlayhead).map((layer) => (
                  <PreviewLayer
                    key={layer.id}
                    layer={layer}
                    eventType={project.eventType}
                    selected={selectedLayer?.id === layer.id}
                    overlayOrigin={overlayOrigin}
                    onPointerDown={(event) => startDrag(layer, event)}
                    onResizePointerDown={(handle, event) => startResize(layer, handle, event)}
                    onRotatePointerDown={(event) => startRotate(layer, event)}
                  />
                ))}
              </div>
            </div>
            <div className="alert-timeline">
              <div className="alert-timeline-header">
                <span>{Math.round(playheadMs)}ms</span>
                <input
                  type="range"
                  min={0}
                  max={project.durationMs}
                  value={playheadMs}
                  onChange={(e) => {
                    setPlaying(false);
                    setPlayheadMs(Number(e.target.value));
                  }}
                />
                <span>{project.durationMs}ms</span>
              </div>
              <div className="alert-timeline-tracks">
                {project.layers.map((layer) => {
                  const left = `${(layer.startMs / project.durationMs) * 100}%`;
                  const width = `${((layer.endMs - layer.startMs) / project.durationMs) * 100}%`;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={`alert-timeline-track${selectedLayer?.id === layer.id ? " active" : ""}`}
                      onClick={() => setSelectedLayerId(layer.id)}
                    >
                      <span>{layer.name}</span>
                      <i style={{ left, width }} />
                    </button>
                  );
                })}
                <b className="alert-playhead" style={{ left: `${(playheadMs / project.durationMs) * 100}%` }} />
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Properties</h2>
            {selectedLayer ? (
              <>
                <div className="form-row">
                  <label>Layer name</label>
                  <input value={selectedLayer.name} onChange={(e) => updateSelected({ name: e.target.value })} />
                </div>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <label><input type="checkbox" checked={selectedLayer.visible} onChange={(e) => updateSelected({ visible: e.target.checked })} /> Visible</label>
                  <label><input type="checkbox" checked={selectedLayer.locked} onChange={(e) => updateSelected({ locked: e.target.checked })} /> Locked</label>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div><label>X</label><input type="number" value={selectedLayer.x} onChange={(e) => updateSelected({ x: Number(e.target.value) })} /></div>
                  <div><label>Y</label><input type="number" value={selectedLayer.y} onChange={(e) => updateSelected({ y: Number(e.target.value) })} /></div>
                  <div><label>Width</label><input type="number" value={selectedLayer.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></div>
                  <div><label>Height</label><input type="number" value={selectedLayer.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} /></div>
                  <div><label>Rotation</label><input type="number" value={selectedLayer.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} /></div>
                  <div><label>Scale</label><input type="number" step="0.05" value={selectedLayer.scale} onChange={(e) => updateSelected({ scale: Number(e.target.value) })} /></div>
                </div>
                <div className="form-row">
                  <label>Animation preset</label>
                  <select
                    value={selectedLayer.animation?.preset ?? "none"}
                    onChange={(e) => applyAnimationPreset(e.target.value as AlertLayerAnimation["preset"])}
                  >
                    {ANIMATION_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>
                {selectedLayer.animation && selectedLayer.animation.preset !== "none" && (
                  <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label>Anim delay (ms)</label>
                      <input
                        type="number"
                        value={selectedLayer.animation.delayMs}
                        onChange={(e) => updateSelected({ animation: { ...selectedLayer.animation!, delayMs: Number(e.target.value) } } as Partial<AlertLayer>)}
                      />
                    </div>
                    <div>
                      <label>Anim duration (ms)</label>
                      <input
                        type="number"
                        value={selectedLayer.animation.durationMs}
                        onChange={(e) => updateSelected({ animation: { ...selectedLayer.animation!, durationMs: Number(e.target.value) } } as Partial<AlertLayer>)}
                      />
                    </div>
                    <div>
                      <label>Intensity</label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={5}
                        value={selectedLayer.animation.intensity}
                        onChange={(e) => updateSelected({ animation: { ...selectedLayer.animation!, intensity: Number(e.target.value) } } as Partial<AlertLayer>)}
                      />
                    </div>
                    <label style={{ alignSelf: "center", marginTop: 16 }}>
                      <input
                        type="checkbox"
                        checked={selectedLayer.animation.loop}
                        onChange={(e) => updateSelected({ animation: { ...selectedLayer.animation!, loop: e.target.checked } } as Partial<AlertLayer>)}
                      />{" "}
                      Loop
                    </label>
                  </div>
                )}
                <div className="actions" style={{ marginBottom: 16 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alignSelected("left")}>Left</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alignSelected("center")}>Center</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alignSelected("right")}>Right</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alignSelected("top")}>Top</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alignSelected("middle")}>Middle</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => alignSelected("bottom")}>Bottom</button>
                </div>
                <div className="form-row">
                  <label>Opacity ({selectedLayer.opacity})</label>
                  <input type="range" min={0} max={1} step={0.05} value={selectedLayer.opacity} onChange={(e) => updateSelected({ opacity: Number(e.target.value) })} />
                </div>
                <div className="form-row">
                  <label>Blend mode</label>
                  <select value={selectedLayer.blendMode} onChange={(e) => updateSelected({ blendMode: e.target.value })}>
                    {BLEND_MODES.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <label>Glow</label>
                    <input type="number" min={0} max={120} value={selectedLayer.filter?.glow ?? 0} onChange={(e) => updateSelectedFilter({ glow: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Glow color</label>
                    <input value={selectedLayer.filter?.glowColor ?? "rgba(91, 140, 255, 0.9)"} onChange={(e) => updateSelectedFilter({ glowColor: e.target.value })} />
                  </div>
                  <div>
                    <label>Blur</label>
                    <input type="number" min={0} max={80} value={selectedLayer.filter?.blur ?? 0} onChange={(e) => updateSelectedFilter({ blur: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Hue rotate</label>
                    <input type="number" min={-360} max={360} value={selectedLayer.filter?.hueRotate ?? 0} onChange={(e) => updateSelectedFilter({ hueRotate: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Brightness</label>
                    <input type="number" min={0} max={3} step={0.05} value={selectedLayer.filter?.brightness ?? 1} onChange={(e) => updateSelectedFilter({ brightness: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Contrast</label>
                    <input type="number" min={0} max={3} step={0.05} value={selectedLayer.filter?.contrast ?? 1} onChange={(e) => updateSelectedFilter({ contrast: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Saturation</label>
                    <input type="number" min={0} max={3} step={0.05} value={selectedLayer.filter?.saturation ?? 1} onChange={(e) => updateSelectedFilter({ saturation: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div><label>Start (ms)</label><input type="number" value={selectedLayer.startMs} onChange={(e) => updateSelected({ startMs: Number(e.target.value) })} /></div>
                  <div><label>End (ms)</label><input type="number" value={selectedLayer.endMs} onChange={(e) => updateSelected({ endMs: Number(e.target.value) })} /></div>
                </div>

                {selectedLayer.type === "text" && (
                  <>
                    <div className="form-row"><label>Text</label><textarea rows={3} value={selectedLayer.text} onChange={(e) => updateSelected({ text: e.target.value } as Partial<AlertLayer>)} /></div>
                    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div><label>Font size</label><input type="number" value={selectedLayer.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                      <div><label>Weight</label><input type="number" value={selectedLayer.fontWeight} onChange={(e) => updateSelected({ fontWeight: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                      <div><label>Color</label><input type="color" value={selectedLayer.color} onChange={(e) => updateSelected({ color: e.target.value } as Partial<AlertLayer>)} /></div>
                      <div><label>Align</label><select value={selectedLayer.align} onChange={(e) => updateSelected({ align: e.target.value } as Partial<AlertLayer>)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
                      <div><label>Text shadow</label><input value={selectedLayer.shadow ?? ""} onChange={(e) => updateSelected({ shadow: e.target.value } as Partial<AlertLayer>)} placeholder="0 0 18px #5b8cff" /></div>
                      <div><label>Stroke width</label><input type="number" min={0} max={24} value={selectedLayer.strokeWidth} onChange={(e) => updateSelected({ strokeWidth: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                      <div><label>Stroke color</label><input value={selectedLayer.strokeColor ?? "#000000"} onChange={(e) => updateSelected({ strokeColor: e.target.value } as Partial<AlertLayer>)} /></div>
                    </div>
                  </>
                )}

                {selectedLayer.type === "shape" && (
                  <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div><label>Fill</label><input value={selectedLayer.fill} onChange={(e) => updateSelected({ fill: e.target.value } as Partial<AlertLayer>)} /></div>
                    <div><label>Radius</label><input type="number" value={selectedLayer.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                    <div><label>Shape</label><select value={selectedLayer.shape} onChange={(e) => updateSelected({ shape: e.target.value } as Partial<AlertLayer>)}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option></select></div>
                  </div>
                )}

                {(selectedLayer.type === "image" || selectedLayer.type === "gif" || selectedLayer.type === "video" || selectedLayer.type === "audio") && (
                  <>
                    <div className="form-row"><label>Asset URL</label><input value={selectedLayer.assetUrl} onChange={(e) => updateSelected({ assetUrl: e.target.value } as Partial<AlertLayer>)} /></div>
                    {(selectedLayer.type === "audio" || selectedLayer.type === "video") && (
                      <div className="form-row">
                        <label>{selectedLayer.type === "audio" ? "Upload audio" : "Upload video"}</label>
                        <input
                          type="file"
                          accept={selectedLayer.type === "audio" ? "audio/*,.mp3,.wav,.ogg,.m4a,.webm" : "video/*,.mp4,.webm,.mov"}
                          disabled={assetUploading}
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            e.currentTarget.value = "";
                            if (file) void uploadSelectedAsset(file);
                          }}
                        />
                        {assetUploading && <p className="subtitle">Uploading asset...</p>}
                      </div>
                    )}
                    {selectedLayer.type !== "audio" && (
                      <div className="form-row"><label>Fit</label><select value={selectedLayer.fit} onChange={(e) => updateSelected({ fit: e.target.value } as Partial<AlertLayer>)}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Fill</option></select></div>
                    )}
                    {selectedLayer.type === "audio" && (
                      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <div><label>Volume</label><input type="number" min={0} max={1} step={0.05} value={selectedLayer.volume} onChange={(e) => updateSelected({ volume: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                        <label style={{ alignSelf: "center", marginTop: 16 }}><input type="checkbox" checked={selectedLayer.loop} onChange={(e) => updateSelected({ loop: e.target.checked } as Partial<AlertLayer>)} /> Loop</label>
                      </div>
                    )}
                    {selectedLayer.type === "video" && (
                      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label><input type="checkbox" checked={selectedLayer.loop} onChange={(e) => updateSelected({ loop: e.target.checked } as Partial<AlertLayer>)} /> Loop</label>
                        <label><input type="checkbox" checked={selectedLayer.muted} onChange={(e) => updateSelected({ muted: e.target.checked } as Partial<AlertLayer>)} /> Muted</label>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="subtitle">Select a layer to edit its properties.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
