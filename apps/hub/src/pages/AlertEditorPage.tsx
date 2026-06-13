import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertProjectSchema } from "@btv/shared";
import type { AlertChaosModifier, AlertKeyframe, AlertLayer, AlertLayerAnimation, AlertProject, AlertVariation, StreamEventType } from "@btv/shared";
import { api, type GiphyAssetType, type GiphyResult, type MediaAssetInfo, type SoundAssetInfo } from "../api";
import { AlertAssetLibrary, formatAssetBytes, type AlertAssetKind } from "../components/alerts/AlertAssetLibrary";
import { AlertCanvasWorkspace, type PreviewBackground, type PreviewZoom } from "../components/alerts/AlertCanvasWorkspace";
import { AlertLayersPanel } from "../components/alerts/AlertLayersPanel";
import { AlertLayerInspector, type AlertKeyframeProperty } from "../components/alerts/AlertLayerInspector";
import { AlertLayerTypeInspector } from "../components/alerts/AlertLayerTypeInspector";
import { AlertProjectInspector } from "../components/alerts/AlertProjectInspector";
import {
  alertProjectSignature,
  downloadAlertProject,
  importAlertProject as importAlertProjectFile,
  loadAlertEditorResources,
  normalizeAlertProject,
  persistAlertProject,
  persistAndTestAlertProject,
} from "../components/alerts/alertProjectPersistence";
import { AlertTestInspector } from "../components/alerts/AlertTestInspector";
import {
  PreviewLayer,
  resolvePreviewAssetUrl,
  type ResizeHandle,
  type TestPayload,
} from "../components/alerts/AlertPreview";
import { AlertEditorBreadcrumbs, AlertEditorToolbar } from "../components/alerts/AlertEditorToolbar";
import { useRegisterSaveStatus } from "../context/SaveStatusContext";
import { useToast } from "../hooks/useToast";
import { resolveOverlayOrigin } from "../lib/serverUrls";
import { PageHeader } from "../ui";

const EVENT_TYPES: StreamEventType[] = ["follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points"];
const CANVAS_PRESETS = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "720p", width: 1280, height: 720 },
];
const CHAOS_MODIFIERS: Array<{ id: AlertChaosModifier; label: string }> = [
  { id: "shake", label: "Shake" },
  { id: "flash", label: "Flash" },
  { id: "hue_shift", label: "Hue shift" },
  { id: "scale_punch", label: "Scale punch" },
];
const DEFAULT_TEST_PAYLOAD = `{
  "user": "TestUser",
  "login": "testuser",
  "amount": 100,
  "message": "Test visual alert from hub",
  "variables": {
    "hype": 10
  },
  "payload": {
    "rewardTitle": "Hydrate",
    "streak": 3
  }
}`;
const LOOPING_ANIMATION_PRESETS: AlertLayerAnimation["preset"][] = ["pulse", "float", "wiggle", "glow-pulse", "rgb-split", "vhs-jitter", "bass-shake"];
const EXIT_ANIMATION_PRESETS: AlertLayerAnimation["preset"][] = ["fade-out", "pop-out", "slide-out", "glitch-out", "explode-out"];

type TemplateId =
  | "clean-follow"
  | "neon-sub"
  | "raid-warning"
  | "gift-bomb"
  | "cheer-burst"
  | "channel-point-chaos"
  | "cozy-minimal"
  | "horror-glitch"
  | "ocean-sci-fi"
  | "meme-pop";
type ProjectHistory = { past: AlertProject[]; future: AlertProject[] };
type ProjectHistoryStep = {
  project: AlertProject;
  history: ProjectHistory;
  selectedLayerId: string;
};
type AlertProjectWarning = { level: "warning" | "error"; message: string };
type TemplateInfo = { id: TemplateId; name: string; description: string };
type AlertProjectDraft = Partial<Omit<AlertProject, "id" | "createdAt" | "updatedAt">> & Pick<AlertProject, "name" | "eventType" | "durationMs" | "canvas" | "layers">;
type LocalTemplate = {
  id: string;
  name: string;
  description: string;
  project: AlertProject;
  savedAt: string;
};

function stepAlertProjectHistory(
  direction: "undo" | "redo",
  currentProject: AlertProject | null,
  currentSelectedLayerId: string,
  history: ProjectHistory,
): ProjectHistoryStep | null {
  if (!currentProject) return null;
  if (direction === "undo") {
    const previous = history.past.at(-1);
    if (!previous) return null;
    return {
      project: previous,
      selectedLayerId: previous.layers.some((layer) => layer.id === currentSelectedLayerId) ? currentSelectedLayerId : previous.layers[0]?.id ?? "",
      history: { past: history.past.slice(0, -1), future: [currentProject, ...history.future] },
    };
  }

  const next = history.future[0];
  if (!next) return null;
  return {
    project: next,
    selectedLayerId: next.layers.some((layer) => layer.id === currentSelectedLayerId) ? currentSelectedLayerId : next.layers[0]?.id ?? "",
    history: { past: [...history.past, currentProject], future: history.future.slice(1) },
  };
}

type LayerOf<T extends AlertLayer["type"]> = T extends "image" | "gif" | "video"
  ? Extract<AlertLayer, { type: "image" | "gif" | "video" }>
  : Extract<AlertLayer, { type: T }>;

const TEMPLATE_INFOS: TemplateInfo[] = [
  { id: "clean-follow", name: "Clean Follow", description: "Simple starter card with title and subtitle text." },
  { id: "neon-sub", name: "Neon Sub", description: "Punchy subscriber alert with glow and glitch reveal." },
  { id: "raid-warning", name: "Raid Warning", description: "Full-width high-energy raid intro with movement." },
  { id: "gift-bomb", name: "Gift Bomb", description: "Big gifted-sub celebration with stacked count callout." },
  { id: "cheer-burst", name: "Cheer Burst", description: "Bits alert with a bright pop-in burst." },
  { id: "channel-point-chaos", name: "Channel Point Chaos", description: "Reward-driven alert with a punchy title and action line." },
  { id: "cozy-minimal", name: "Cozy Minimal", description: "Soft, calm alert for relaxed streams." },
  { id: "horror-glitch", name: "Horror Glitch", description: "Dark flicker-style alert for spooky streams." },
  { id: "ocean-sci-fi", name: "Ocean/Sci-Fi", description: "Cool blue signal alert for exploration or sci-fi streams." },
  { id: "meme-pop", name: "Meme Pop", description: "Sticker-like channel point alert for playful moments." },
];
const LOCAL_TEMPLATES_KEY = "btv.alertEditor.localTemplates";
const DEFAULT_CHAOS: AlertProject["chaos"] = {
  enabled: false,
  intensity: 0.35,
  modifiers: ["shake", "flash", "hue_shift", "scale_punch"],
  legendaryBoost: 0,
};
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
    timeline: {
      durationMs: 5000,
      fps: 60,
      snapMs: 100,
      zoom: 1,
    },
    chaos: DEFAULT_CHAOS,
    safeMode: false,
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
    variations: [],
    tags: ["visual-editor"],
    createdAt: now,
    updatedAt: now,
  };
}

function withProjectMeta(project: AlertProjectDraft): AlertProject {
  const now = nowIso();
  return {
    ...project,
    timeline: project.timeline ?? {
      durationMs: project.durationMs,
      fps: 60,
      snapMs: 100,
      zoom: 1,
    },
    chaos: project.chaos ?? DEFAULT_CHAOS,
    safeMode: project.safeMode ?? false,
    layers: project.layers ?? [],
    variations: project.variations ?? [],
    tags: project.tags ?? [],
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

  if (template === "gift-bomb") {
    return withProjectMeta({
      name: "Gift Bomb",
      eventType: "gift_sub",
      durationMs: 6200,
      canvas: base.canvas,
      tags: ["template", "gift-sub"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Gold shockwave", shape: "ellipse", x: 510, y: 150, width: 900, height: 650, fill: "rgba(255, 210, 95, 0.34)", endMs: 6200, animation: { preset: "pulse", delayMs: 0, durationMs: 900, easing: "ease-in-out", intensity: 1.4, loop: true } },
        { ...createLayer("shape"), id: newId("shape"), name: "Gift plate", x: 525, y: 350, width: 870, height: 340, fill: "rgba(20, 14, 28, 0.94)", borderColor: "#ffd65f", borderWidth: 5, radius: 30, endMs: 6200, animation: { preset: "screen-slam", delayMs: 0, durationMs: 520, easing: "ease-out", intensity: 1.1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Gift count", x: 620, y: 400, width: 680, height: 105, text: "{user} DROPPED GIFTS", fontSize: 64, color: "#fff4c7", endMs: 6200, shadow: "0 0 24px rgba(255,214,95,0.85)", animation: { preset: "bounce-in", delayMs: 150, durationMs: 760, easing: "bounce", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Amount", x: 710, y: 525, width: 500, height: 80, text: "{amount} gifted subs", fontSize: 46, color: "#ffd65f", endMs: 6200, animation: { preset: "fade-in", delayMs: 650, durationMs: 420, easing: "ease-out", intensity: 1, loop: false } },
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

  if (template === "channel-point-chaos") {
    return withProjectMeta({
      name: "Channel Point Chaos",
      eventType: "channel_points",
      durationMs: 4800,
      canvas: base.canvas,
      tags: ["template", "channel-points", "chaos"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Chaos slab", x: 455, y: 330, width: 1010, height: 380, fill: "rgba(33, 255, 169, 0.88)", borderColor: "#111722", borderWidth: 8, radius: 18, rotation: 2, endMs: 4800, animation: { preset: "elastic-in", delayMs: 0, durationMs: 650, easing: "elastic", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Reward", x: 555, y: 400, width: 810, height: 100, text: "{payload.rewardTitle}", fontSize: 70, color: "#08110d", endMs: 4800, rotation: 2, animation: { preset: "glitch-reveal", delayMs: 160, durationMs: 540, easing: "ease-out", intensity: 0.8, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Redeemer", x: 660, y: 520, width: 600, height: 70, text: "{user} activated chaos", fontSize: 34, color: "#13251d", endMs: 4800, rotation: 2, animation: { preset: "wiggle", delayMs: 780, durationMs: 500, easing: "ease-in-out", intensity: 1, loop: true } },
      ],
    });
  }

  if (template === "cozy-minimal") {
    return withProjectMeta({
      name: "Cozy Minimal",
      eventType: "follow",
      durationMs: 5200,
      canvas: base.canvas,
      tags: ["template", "cozy", "minimal"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Soft card", x: 585, y: 390, width: 750, height: 270, fill: "rgba(34, 44, 50, 0.88)", borderColor: "rgba(196, 226, 212, 0.36)", borderWidth: 2, radius: 26, endMs: 5200, animation: { preset: "fade-in", delayMs: 0, durationMs: 700, easing: "ease-out", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Welcome", x: 665, y: 445, width: 590, height: 74, text: "Welcome, {user}", fontSize: 48, color: "#e6fff3", endMs: 5200, animation: { preset: "float", delayMs: 400, durationMs: 1800, easing: "ease-in-out", intensity: 0.35, loop: true } },
        { ...createLayer("text"), id: newId("text"), name: "Subtitle", x: 720, y: 535, width: 480, height: 54, text: "Thanks for the {event}", fontSize: 28, color: "#b7d8ca", endMs: 5200, animation: { preset: "fade-in", delayMs: 450, durationMs: 650, easing: "ease-out", intensity: 1, loop: false } },
      ],
    });
  }

  if (template === "horror-glitch") {
    return withProjectMeta({
      name: "Horror Glitch",
      eventType: "raid",
      durationMs: 5600,
      canvas: base.canvas,
      tags: ["template", "horror", "glitch"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Dark flash", x: 0, y: 0, width: 1920, height: 1080, fill: "rgba(6, 2, 8, 0.72)", radius: 0, endMs: 5600, animation: { preset: "glitch-reveal", delayMs: 0, durationMs: 600, easing: "ease-out", intensity: 1.3, loop: false } },
        { ...createLayer("shape"), id: newId("shape"), name: "Red scan", x: 0, y: 475, width: 1920, height: 130, fill: "rgba(255, 42, 73, 0.72)", radius: 0, endMs: 5600, filter: { blur: 8, brightness: 1, contrast: 1.25, saturation: 1.4, hueRotate: 0, glow: 24, glowColor: "rgba(255,42,73,0.86)" }, animation: { preset: "pulse", delayMs: 350, durationMs: 520, easing: "ease-in-out", intensity: 1.2, loop: true } },
        { ...createLayer("text"), id: newId("text"), name: "Warning", x: 500, y: 425, width: 920, height: 110, text: "SIGNAL BREACH", fontSize: 88, color: "#fff0f3", endMs: 5600, shadow: "0 0 28px #ff2a49", animation: { preset: "glitch-reveal", delayMs: 160, durationMs: 900, easing: "ease-out", intensity: 1.3, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Source", x: 625, y: 550, width: 670, height: 60, text: "{user} entered the room", fontSize: 34, color: "#ffb9c4", endMs: 5600, animation: { preset: "fade-in", delayMs: 760, durationMs: 450, easing: "ease-out", intensity: 1, loop: false } },
      ],
    });
  }

  if (template === "ocean-sci-fi") {
    return withProjectMeta({
      name: "Ocean/Sci-Fi",
      eventType: "sub",
      durationMs: 5800,
      canvas: base.canvas,
      tags: ["template", "ocean", "sci-fi"],
      layers: [
        { ...createLayer("shape"), id: newId("shape"), name: "Deep field", x: 470, y: 315, width: 980, height: 450, fill: "rgba(5, 24, 42, 0.9)", borderColor: "rgba(89, 214, 255, 0.58)", borderWidth: 3, radius: 34, endMs: 5800, filter: { blur: 0, brightness: 1, contrast: 1, saturation: 1.2, hueRotate: 0, glow: 28, glowColor: "rgba(89,214,255,0.8)" }, animation: { preset: "slide-in", delayMs: 0, durationMs: 620, easing: "ease-out", intensity: 0.55, loop: false } },
        { ...createLayer("shape"), id: newId("shape"), name: "Signal orb", shape: "ellipse", x: 815, y: 270, width: 290, height: 290, fill: "rgba(89, 214, 255, 0.24)", borderColor: "rgba(167, 239, 255, 0.8)", borderWidth: 3, endMs: 5800, animation: { preset: "glow-pulse", delayMs: 200, durationMs: 1200, easing: "ease-in-out", intensity: 1.1, loop: true } },
        { ...createLayer("text"), id: newId("text"), name: "Transmission", x: 560, y: 460, width: 800, height: 88, text: "TRANSMISSION: {user}", fontSize: 58, color: "#e4fbff", endMs: 5800, shadow: "0 0 22px rgba(89,214,255,0.9)", animation: { preset: "fade-in", delayMs: 430, durationMs: 620, easing: "ease-out", intensity: 1, loop: false } },
        { ...createLayer("text"), id: newId("text"), name: "Subtitle", x: 650, y: 560, width: 620, height: 56, text: "subscribed to the expedition", fontSize: 30, color: "#93dff0", endMs: 5800, animation: { preset: "float", delayMs: 750, durationMs: 1800, easing: "ease-in-out", intensity: 0.35, loop: true } },
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

function createLayer<T extends AlertLayer["type"]>(type: T): LayerOf<T> {
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
    } as unknown as LayerOf<T>;
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
    } as unknown as LayerOf<T>;
  }

  if (type === "particle") {
    return {
      ...base,
      type,
      name: "Particles",
      particle: "confetti",
      count: 80,
      color: "#5b8cff",
      spread: 120,
      speed: 3,
    } as unknown as LayerOf<T>;
  }

  if (type === "browser") {
    return {
      ...base,
      type,
      name: "Custom HTML",
      html: "<div class=\"custom-alert\">Custom HTML layer</div>",
      css: ".custom-alert { color: white; font: 800 48px Inter, sans-serif; }",
      js: "",
      sandbox: true,
    } as unknown as LayerOf<T>;
  }

  if (type === "audio") {
    return {
      ...base,
      type,
      assetUrl: "",
      volume: 1,
      loop: false,
      muted: false,
      startOffsetMs: 0,
      fadeInMs: 0,
      fadeOutMs: 0,
      reactive: {
        enabled: false,
        mode: "none",
        sensitivity: 1,
      },
    } as unknown as LayerOf<T>;
  }

  return {
    ...base,
    type,
    assetUrl: "",
    fit: "contain",
    loop: true,
    muted: true,
    volume: 1,
  } as unknown as LayerOf<T>;
}

function TemplatePreview({
  templateId,
  overlayOrigin,
  testPayload,
  onApply,
  large = false,
}: {
  templateId: TemplateId;
  overlayOrigin: string;
  testPayload: TestPayload;
  onApply: () => void;
  large?: boolean;
}) {
  const previewProject = useMemo(() => createTemplateProject(templateId), [templateId]);
  const info = templateInfo(templateId);
  const scale = large ? 0.24 : 0.12;
  const noopPointer = () => undefined;
  const noopResize = () => undefined;
  const noopRotate = () => undefined;

  return (
    <div className={`alert-template-preview${large ? " large" : ""}`}>
      <div>
        <h3>{info.name}</h3>
        <p>{info.description}</p>
      </div>
      <div className="alert-template-preview-frame">
        <div
          className="alert-preview-canvas checkerboard"
          style={{
            width: previewProject.canvas.width,
            height: previewProject.canvas.height,
            transform: `scale(${scale})`,
          }}
        >
          {previewProject.layers.map((layer) => (
            <PreviewLayer
              key={layer.id}
              layer={layer}
              eventType={previewProject.eventType}
              testPayload={testPayload}
              selected={false}
              overlayOrigin={overlayOrigin}
              onPointerDown={noopPointer}
              onResizePointerDown={noopResize}
              onRotatePointerDown={noopRotate}
            />
          ))}
        </div>
      </div>
      <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={onApply}>
        Use this template
      </button>
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

function templateInfo(id: TemplateId): TemplateInfo {
  return TEMPLATE_INFOS.find((template) => template.id === id) ?? TEMPLATE_INFOS[0]!;
}

function loadLocalTemplates(): LocalTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((template) => {
      if (!template || typeof template !== "object") return false;
      if (typeof template.id !== "string" || typeof template.name !== "string") return false;
      return AlertProjectSchema.safeParse(template.project).success;
    });
  } catch {
    return [];
  }
}

function persistLocalTemplates(templates: LocalTemplate[]): void {
  localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(templates));
}

function cloneProjectAsNew(project: AlertProject, name = project.name): AlertProject {
  const now = nowIso();
  const normalized = normalizeAlertProject(project);
  return {
    ...normalized,
    id: newId("alert"),
    name,
    layers: normalized.layers.map((layer) => ({ ...layer, id: newId(layer.type) }) as AlertLayer),
    createdAt: now,
    updatedAt: now,
  };
}

function resetProjectToTemplate(project: AlertProject, template: TemplateId): AlertProject {
  const defaults = createTemplateProject(template);
  return {
    ...defaults,
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: nowIso(),
    tags: [...new Set([...(defaults.tags ?? []), ...(project.tags ?? []), `template:${template}`])],
  };
}

function normalizeAssetUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function applyAudioFade(audio: HTMLAudioElement, targetVolume: number, fadeInMs = 0, fadeOutMs = 0, durationMs?: number): ReturnType<typeof setInterval>[] {
  const timers: ReturnType<typeof setInterval>[] = [];
  const clampedTarget = Math.max(0, Math.min(1, targetVolume));
  if (fadeInMs > 0) {
    audio.volume = 0;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / fadeInMs);
      audio.volume = clampedTarget * progress;
      if (progress >= 1) clearInterval(timer);
    }, 33);
    timers.push(timer);
  } else {
    audio.volume = clampedTarget;
  }

  if (fadeOutMs > 0 && durationMs && durationMs > fadeOutMs) {
    const timeout = setTimeout(() => {
      const startedAt = Date.now();
      const startVolume = audio.volume;
      const timer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / fadeOutMs);
        audio.volume = Math.max(0, startVolume * (1 - progress));
        if (progress >= 1) clearInterval(timer);
      }, 33);
      timers.push(timer);
    }, durationMs - fadeOutMs);
    timers.push(timeout as unknown as ReturnType<typeof setInterval>);
  }

  return timers;
}

function analyzeProject(project: AlertProject, media: MediaAssetInfo[], sounds: SoundAssetInfo[]): AlertProjectWarning[] {
  const warnings: AlertProjectWarning[] = [];
  const mediaByUrl = new Map(media.flatMap((asset) => [[asset.url, asset], [normalizeAssetUrl(asset.url), asset]]));
  const soundsByUrl = new Map(sounds.flatMap((asset) => [[asset.url, asset], [normalizeAssetUrl(asset.url), asset]]));
  const mediaLayers = project.layers.filter((layer) => ["image", "gif", "video", "audio"].includes(layer.type));
  const heavyFilterLayers = project.layers.filter((layer) => (layer.filter?.blur ?? 0) > 20 || (layer.filter?.glow ?? 0) > 50);
  const videoLayers = project.layers.filter((layer) => layer.type === "video");
  const browserLayers = project.layers.filter((layer) => layer.type === "browser");
  const customScriptLayers = browserLayers.filter((layer) => layer.js.trim() || layer.sandbox === false);

  for (const layer of mediaLayers) {
    if (layer.type !== "image" && layer.type !== "gif" && layer.type !== "video" && layer.type !== "audio") continue;
    if (!layer.assetUrl) {
      warnings.push({ level: "error", message: `${layer.name} has no asset URL.` });
      continue;
    }
    if (/^(https?:|data:|blob:)/i.test(layer.assetUrl)) continue;
    const lookupUrl = normalizeAssetUrl(layer.assetUrl);
    const asset = layer.type === "audio" ? soundsByUrl.get(lookupUrl) : mediaByUrl.get(lookupUrl);
    if (!asset) {
      warnings.push({ level: "error", message: `${layer.name} points to a local asset that was not found: ${layer.assetUrl}` });
      continue;
    }
    const maxSize = layer.type === "audio" ? 12 * 1024 * 1024 : layer.type === "video" ? 40 * 1024 * 1024 : 15 * 1024 * 1024;
    if (asset.size > maxSize) {
      warnings.push({ level: "warning", message: `${layer.name} is large (${formatAssetBytes(asset.size)}). Consider trimming or compressing it.` });
    }
  }

  if (mediaLayers.length > 8) warnings.push({ level: "warning", message: `${mediaLayers.length} media layers may be heavy for OBS browser source playback.` });
  if (videoLayers.length > 2) warnings.push({ level: "warning", message: `${videoLayers.length} video layers may stutter on lower-end stream PCs.` });
  if (heavyFilterLayers.length > 3) warnings.push({ level: "warning", message: `${heavyFilterLayers.length} layers use heavy blur/glow effects.` });
  if (browserLayers.length) warnings.push({ level: "warning", message: "Browser/custom HTML layers depend on iframe support in OBS browser sources." });
  if (customScriptLayers.length && !project.safeMode) warnings.push({ level: "warning", message: "Custom JS layers can behave differently in OBS. Enable Safe mode before going live if this alert misbehaves." });
  if (customScriptLayers.length && project.safeMode) warnings.push({ level: "warning", message: "Safe mode is enabled, so custom JS in browser layers will be disabled during playback." });
  if (project.durationMs > 30000) warnings.push({ level: "warning", message: "Alert duration is over 30 seconds." });

  return warnings;
}

export default function AlertEditorPage() {
  const [searchParams] = useSearchParams();
  const { id: routeProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [project, setProject] = useState<AlertProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>("checkerboard");
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>("fit");
  const [inspectorTab, setInspectorTab] = useState<"properties" | "test">("properties");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templatePreviewId, setTemplatePreviewId] = useState<TemplateId>("clean-follow");
  const [localTemplates, setLocalTemplates] = useState<LocalTemplate[]>([]);
  const [selectedLocalTemplateId, setSelectedLocalTemplateId] = useState("");
  const [testPayloadJson, setTestPayloadJson] = useState(DEFAULT_TEST_PAYLOAD);
  const [giphyAssetType, setGiphyAssetType] = useState<GiphyAssetType>("gif");
  const [giphyQuery, setGiphyQuery] = useState("");
  const [giphyResults, setGiphyResults] = useState<GiphyResult[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetKind, setAssetKind] = useState<AlertAssetKind>("all");
  const [mediaAssets, setMediaAssets] = useState<MediaAssetInfo[]>([]);
  const [soundAssets, setSoundAssets] = useState<SoundAssetInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [overlayOrigin, setOverlayOrigin] = useState(resolveOverlayOrigin);
  const [savedSignature, setSavedSignature] = useState("");
  const [history, setHistory] = useState<ProjectHistory>({ past: [], future: [] });
  const canvasRef = useRef<HTMLDivElement>(null);
  const templateDialogPanelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<CanvasDragState | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const toast = useToast();

  const selectedLayer = useMemo(
    () => project?.layers?.find((layer) => layer.id === selectedLayerId) ?? null,
    [project, selectedLayerId],
  );

  const dirty = useMemo(() => alertProjectSignature(project) !== savedSignature, [project, savedSignature]);
  useRegisterSaveStatus("visual-alert-editor", "Alert editor", saving ? "saving" : dirty ? "dirty" : "saved");
  const activeCanvasPreset = useMemo(() => {
    if (!project) return "";
    const preset = CANVAS_PRESETS.find((item) => item.width === project.canvas.width && item.height === project.canvas.height);
    return preset ? `${preset.width}x${preset.height}` : "custom";
  }, [project?.canvas.width, project?.canvas.height]);
  const projectWarnings = useMemo(
    () => project ? analyzeProject(project, mediaAssets, soundAssets) : [],
    [project, mediaAssets, soundAssets],
  );
  const selectedLocalTemplate = useMemo(
    () => localTemplates.find((template) => template.id === selectedLocalTemplateId) ?? null,
    [localTemplates, selectedLocalTemplateId],
  );
  const selectedVariation = useMemo(
    () => project?.variations?.find((variation) => variation.id === selectedVariationId) ?? null,
    [project?.variations, selectedVariationId],
  );
  const testAudioLayer = useMemo(
    () => {
      const selectedAudio = selectedLayer?.type === "audio" ? selectedLayer : null;
      return selectedAudio ?? project?.layers.find((layer) => layer.type === "audio") ?? null;
    },
    [project?.layers, selectedLayer],
  );
  const previewTestPayload = useMemo<TestPayload>(() => {
    try {
      const parsed = JSON.parse(testPayloadJson) as TestPayload;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [testPayloadJson]);
  const testPayloadError = useMemo(() => {
    try {
      JSON.parse(testPayloadJson);
      return "";
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  }, [testPayloadJson]);
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
    const normalized = next ? normalizeAlertProject(next) : null;
    setProject(normalized);
    setSelectedLayerId(normalized?.layers[0]?.id ?? "");
    setSelectedVariationId(normalized?.variations[0]?.id ?? "");
    setPlayheadMs(0);
    setPlaying(false);
    setHistory({ past: [], future: [] });
    setSavedSignature(alertProjectSignature(normalized));
    if (normalized && normalized.id !== routeProjectId) {
      navigate(`/alerts/${encodeURIComponent(normalized.id)}`);
    }
  };

  const commitProject = (next: AlertProject, options: { recordHistory?: boolean } = {}) => {
    const recordHistory = options.recordHistory ?? true;
    if (recordHistory && project && project.id === next.id) {
      setHistory((prev) => ({ past: [...prev.past.slice(-49), project], future: [] }));
    }
    setProject(normalizeAlertProject(next));
  };

  const load = () => {
    void loadAlertEditorResources()
      .then(({ projects: items, media, sounds }) => {
        setProjects(items);
        setMediaAssets(media);
        setSoundAssets(sounds);
        setProject((prev) => {
          const requested = routeProjectId ?? searchParams.get("id");
          const next = (requested ? items.find((item) => item.id === requested) : null) ?? prev ?? items[0] ?? null;
          const normalized = next ? normalizeAlertProject(next) : null;
          if (!prev) {
            setSelectedLayerId(normalized?.layers[0]?.id ?? "");
            setSelectedVariationId(normalized?.variations[0]?.id ?? "");
            setSavedSignature(alertProjectSignature(normalized));
          }
          return normalized;
        });
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : "Alert editor resources could not be loaded");
      });
  };

  useEffect(load, []);

  useEffect(() => {
    const templates = loadLocalTemplates();
    setLocalTemplates(templates);
    setSelectedLocalTemplateId(templates[0]?.id ?? "");
  }, []);

  useEffect(() => {
    if (!templateDialogOpen) return;
    window.setTimeout(() => {
      const firstButton = templateDialogPanelRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
      firstButton?.focus();
    }, 0);
  }, [templateDialogOpen]);

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

  useEffect(() => () => {
    testAudioRef.current?.pause();
    testAudioRef.current = null;
    for (const timer of testAudioTimersRef.current) clearTimeout(timer);
    testAudioTimersRef.current = [];
  }, []);

  const save = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const next = await persistAlertProject(project);
      setProject(next);
      setSavedSignature(alertProjectSignature(next));
      toast("Alert project saved");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testProjectInObs = async (eventType: StreamEventType, variationId?: string) => {
    if (!project) return;
    setSaving(true);
    try {
      const next = await persistAndTestAlertProject(project, eventType, testPayloadJson, variationId);
      setProject(next);
      setSavedSignature(alertProjectSignature(next));
      setPlayheadMs(0);
      setPlaying(true);
      toast(`Test ${eventType}${variationId ? " variation" : ""} sent to OBS alert source`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Test alert failed. Check payload JSON.");
    } finally {
      setSaving(false);
    }
  };

  const createNew = () => {
    const next = createProject();
    setProjects((prev) => [next, ...prev]);
    selectProject(next);
    setSavedSignature("");
  };

  const createFromTemplate = (template: TemplateId) => {
    const next = createTemplateProject(template);
    setProjects((prev) => [next, ...prev]);
    selectProject(next);
    setSavedSignature("");
  };

  const resetCurrentToTemplate = (template: TemplateId) => {
    if (!project) return;
    const info = templateInfo(template);
    const confirmed = window.confirm(`Reset "${project.name}" to the ${info.name} template defaults? This keeps the project name and can be undone before saving.`);
    if (!confirmed) return;
    const next = resetProjectToTemplate(project, template);
    commitProject(next);
    setSelectedLayerId(next.layers[0]?.id ?? "");
    setPlayheadMs(0);
    setPlaying(false);
    toast(`Reset to ${info.name} defaults`);
  };

  const saveCurrentAsLocalTemplate = () => {
    if (!project) return;
    const name = window.prompt("Template name", `${project.name} template`)?.trim();
    if (!name) return;
    const template: LocalTemplate = {
      id: newId("local-template"),
      name,
      description: `Saved from ${project.name}`,
      project: {
        ...project,
        tags: [...new Set([...(project.tags ?? []), "local-template"])],
      },
      savedAt: nowIso(),
    };
    const next = [template, ...localTemplates].slice(0, 50);
    setLocalTemplates(next);
    setSelectedLocalTemplateId(template.id);
    persistLocalTemplates(next);
    toast("Local template saved");
  };

  const createFromLocalTemplate = (template: LocalTemplate) => {
    const next = cloneProjectAsNew(template.project, template.name);
    setProjects((prev) => [next, ...prev]);
    selectProject(next);
    setSavedSignature("");
  };

  const deleteLocalTemplate = (templateId: string) => {
    const next = localTemplates.filter((template) => template.id !== templateId);
    setLocalTemplates(next);
    setSelectedLocalTemplateId(next[0]?.id ?? "");
    persistLocalTemplates(next);
    toast("Local template deleted");
  };

  const createSamplePack = async () => {
    setSaving(true);
    try {
      const now = nowIso();
      const pack = TEMPLATE_INFOS.map((template) => ({
        ...createTemplateProject(template.id),
        name: `Starter Pack - ${template.name}`,
        tags: ["starter-pack", template.id],
        createdAt: now,
        updatedAt: now,
      }));
      await Promise.all(pack.map((item) => api.saveAlertProject(item)));
      setProjects((prev) => [...pack, ...prev]);
      selectProject(pack[0] ?? null);
      toast("Sample alert pack created");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Sample pack failed");
    } finally {
      setSaving(false);
    }
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
    selectProject(next);
    setSavedSignature("");
  };

  const removeProject = async () => {
    if (!project) return;
    await api.deleteAlertProject(project.id);
    toast("Alert project deleted");
    setProject(null);
    setSelectedLayerId("");
    navigate("/alerts");
    load();
  };

  const exportProject = () => {
    if (!project) return;
    downloadAlertProject(project);
  };

  const importProject = async (file: File) => {
    try {
      const imported = await importAlertProjectFile(file, newId("alert"));
      setProjects((prev) => [imported, ...prev]);
      selectProject(imported);
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
      const res = query.trim() ? await api.giphySearch(query.trim(), giphyAssetType) : await api.giphyTrending(giphyAssetType);
      setGiphyResults(res.results);
      if (!res.results.length) toast(`No GIPHY ${giphyAssetType === "sticker" ? "stickers" : "GIFs"} found`);
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
      const media: MediaAssetInfo = {
        ...saved,
        kind: saved.kind as MediaAssetInfo["kind"],
        size: saved.size,
        metadata: {
          source: "giphy",
          sourceType: gif.type,
          sourceId: gif.id,
          sourceUrl: gif.sourceUrl,
          title: gif.title,
          username: gif.username,
          importedAt: new Date().toISOString(),
        },
      };
      setMediaAssets((prev) => [...prev.filter((asset) => asset.name !== media.name), media].sort((a, b) => a.name.localeCompare(b.name)));
      if (selectedLayer && (selectedLayer.type === "gif" || selectedLayer.type === "image" || selectedLayer.type === "video")) {
        updateSelected({ type: "gif", assetUrl: saved.url, fit: "contain", loop: true, muted: true, volume: 1 } as Partial<AlertLayer>);
      } else {
        const layer = {
          ...createLayer("gif"),
          name: gif.title || (gif.type === "sticker" ? "GIPHY Sticker" : "GIPHY GIF"),
          assetUrl: saved.url,
          width: Math.min(520, Math.max(240, gif.width || 360)),
          height: Math.min(420, Math.max(180, gif.height || 260)),
        } as AlertLayer;
        commitProject({ ...project, layers: [...project.layers, layer], updatedAt: nowIso() });
        setSelectedLayerId(layer.id);
      }
      toast(`${gif.type === "sticker" ? "Sticker" : "GIF"} imported`);
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

  const testAudioLayerPlayback = (layer = testAudioLayer) => {
    if (!layer || layer.type !== "audio" || !layer.assetUrl) {
      toast("Select an audio layer with an asset URL first");
      return;
    }
    stopTestAudio();
    if (layer.muted) {
      toast("Audio layer is muted");
      return;
    }
    const audio = new Audio(resolvePreviewAssetUrl(layer.assetUrl, overlayOrigin));
    audio.loop = Boolean(layer.loop);
    const offsetMs = Math.max(0, Number(layer.startOffsetMs ?? 0));
    audio.currentTime = offsetMs / 1000;
    testAudioTimersRef.current = applyAudioFade(
      audio,
      Number(layer.volume ?? 1),
      Number(layer.fadeInMs ?? 0),
      Number(layer.fadeOutMs ?? 0),
      Math.max(0, Number(layer.endMs ?? 0) - Number(layer.startMs ?? 0)),
    );
    testAudioRef.current = audio;
    audio.addEventListener("ended", () => {
      if (testAudioRef.current === audio) testAudioRef.current = null;
    }, { once: true });
    void audio.play().catch(() => {
      if (testAudioRef.current === audio) testAudioRef.current = null;
      toast("Could not play test audio");
    });
  };

  const testSelectedAudio = () => testAudioLayerPlayback(selectedLayer?.type === "audio" ? selectedLayer : null);

  const stopTestAudio = () => {
    testAudioRef.current?.pause();
    testAudioRef.current = null;
    for (const timer of testAudioTimersRef.current) clearTimeout(timer);
    testAudioTimersRef.current = [];
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

  const addKeyframe = (property: AlertKeyframeProperty) => {
    if (!selectedLayer) return;
    const properties: Record<string, unknown> = {};
    if (property === "opacity") properties.opacity = selectedLayer.opacity;
    if (property === "position") {
      properties.x = selectedLayer.x;
      properties.y = selectedLayer.y;
    }
    if (property === "scale") properties.scale = selectedLayer.scale;
    if (property === "rotation") properties.rotation = selectedLayer.rotation;
    const frame: AlertKeyframe = {
      id: newId("keyframe"),
      atMs: Math.round(playheadMs),
      easing: "ease-out",
      properties,
    };
    const keyframes = [...selectedLayer.keyframes.filter((item) => item.atMs !== frame.atMs || Object.keys(item.properties).some((key) => !(key in properties))), frame]
      .sort((a, b) => a.atMs - b.atMs);
    updateSelected({ keyframes } as Partial<AlertLayer>);
  };

  const updateKeyframe = (keyframeId: string, patch: Partial<AlertKeyframe>) => {
    if (!selectedLayer) return;
    updateSelected({
      keyframes: selectedLayer.keyframes
        .map((frame) => frame.id === keyframeId ? { ...frame, ...patch } : frame)
        .sort((a, b) => a.atMs - b.atMs),
    } as Partial<AlertLayer>);
  };

  const deleteKeyframe = (keyframeId: string) => {
    if (!selectedLayer) return;
    updateSelected({ keyframes: selectedLayer.keyframes.filter((frame) => frame.id !== keyframeId) } as Partial<AlertLayer>);
  };

  const addVariationFromCurrent = () => {
    if (!project) return;
    const variation: AlertVariation = {
      id: newId("variation"),
      name: `Variant ${project.variations.length + 1}`,
      enabled: true,
      priority: project.variations.length,
      legendary: false,
      condition: { eventType: project.eventType },
      durationMs: project.durationMs,
      canvas: project.canvas,
      timeline: project.timeline,
      layers: project.layers.map((layer) => ({ ...layer, id: newId(layer.type) }) as AlertLayer),
    };
    commitProject({ ...project, variations: [...project.variations, variation], updatedAt: nowIso() });
    setSelectedVariationId(variation.id);
  };

  const updateVariation = (variationId: string, patch: Partial<AlertVariation>) => {
    if (!project) return;
    commitProject({
      ...project,
      variations: project.variations.map((variation) => variation.id === variationId ? { ...variation, ...patch } : variation),
      updatedAt: nowIso(),
    });
  };

  const duplicateVariation = (variation: AlertVariation) => {
    if (!project) return;
    const copy = {
      ...variation,
      id: newId("variation"),
      name: `${variation.name} copy`,
      layers: variation.layers.map((layer) => ({ ...layer, id: newId(layer.type) }) as AlertLayer),
    };
    commitProject({ ...project, variations: [...project.variations, copy], updatedAt: nowIso() });
    setSelectedVariationId(copy.id);
  };

  const deleteVariation = (variationId: string) => {
    if (!project) return;
    const variations = project.variations.filter((variation) => variation.id !== variationId);
    commitProject({ ...project, variations, updatedAt: nowIso() });
    setSelectedVariationId(variations[0]?.id ?? "");
  };

  const updateTimeline = (patch: Partial<NonNullable<AlertProject["timeline"]>>) => {
    if (!project) return;
    const current = project.timeline ?? normalizeAlertProject(project).timeline!;
    const timeline = { ...current, ...patch };
    commitProject({
      ...project,
      timeline,
      durationMs: patch.durationMs ?? project.durationMs,
      updatedAt: nowIso(),
    });
  };

  const updateChaos = (patch: Partial<AlertProject["chaos"]>) => {
    if (!project) return;
    const current = normalizeAlertProject(project).chaos;
    commitProject({ ...project, chaos: { ...current, ...patch }, updatedAt: nowIso() });
  };

  const toggleChaosModifier = (modifier: AlertChaosModifier) => {
    if (!project) return;
    const current = normalizeAlertProject(project).chaos;
    const modifiers = current.modifiers.includes(modifier)
      ? current.modifiers.filter((item) => item !== modifier)
      : [...current.modifiers, modifier];
    updateChaos({ modifiers });
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
      durationMs: selectedLayer.animation?.durationMs ?? (EXIT_ANIMATION_PRESETS.includes(preset) ? 550 : 700),
      easing: preset === "bounce-in" ? "bounce" : preset === "elastic-in" ? "elastic" : "ease-out",
      intensity: selectedLayer.animation?.intensity ?? 1,
      loop: LOOPING_ANIMATION_PRESETS.includes(preset),
    };
    updateSelected({ animation } as Partial<AlertLayer>);
    restartPreview();
  };

  const undoProject = () => {
    setHistory((prev) => {
      const step = stepAlertProjectHistory("undo", project, selectedLayerId, prev);
      if (!step) return prev;
      setProject(step.project);
      setSelectedLayerId(step.selectedLayerId);
      return step.history;
    });
  };

  const redoProject = () => {
    setHistory((prev) => {
      const step = stepAlertProjectHistory("redo", project, selectedLayerId, prev);
      if (!step) return prev;
      setProject(step.project);
      setSelectedLayerId(step.selectedLayerId);
      return step.history;
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

      if (mod && key === "s") {
        event.preventDefault();
        void save();
        return;
      }
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
      <AlertEditorBreadcrumbs projectName={project?.name} />
      <PageHeader title="Visual Alert Editor" description="Create, test, and manage BTV's primary cinematic alert projects." />

      <AlertEditorToolbar
        projects={projects}
        eventTypes={EVENT_TYPES}
        selectedProjectId={project?.id ?? ""}
        selectedTestEventType={selectedVariation?.condition.eventType ?? project?.eventType ?? "follow"}
        selectedVariationId={selectedVariationId}
        variationOptions={project?.variations.map((variation) => ({ id: variation.id, name: variation.name })) ?? []}
        saving={saving}
        dirty={dirty}
        canUndo={Boolean(history.past.length)}
        canRedo={Boolean(history.future.length)}
        canUseProject={Boolean(project)}
        onSelectProject={(projectId) => selectProject(projects.find((item) => item.id === projectId) ?? null)}
        onSelectTestEventType={(eventType) => {
          if (selectedVariation) {
            updateVariation(selectedVariation.id, { condition: { ...selectedVariation.condition, eventType } });
          } else if (project) {
            commitProject({ ...project, eventType, updatedAt: nowIso() });
          }
        }}
        onSelectVariation={setSelectedVariationId}
        onTestInObs={() => void testProjectInObs(selectedVariation?.condition.eventType ?? project?.eventType ?? "follow", selectedVariationId || undefined)}
        onSave={() => void save()}
        onUndo={undoProject}
        onRedo={redoProject}
        onCreateProject={createNew}
        onCreateSamplePack={() => void createSamplePack()}
        onSaveTemplate={saveCurrentAsLocalTemplate}
        onDuplicateProject={duplicateProject}
        onExportProject={exportProject}
        onImportProject={(file) => void importProject(file)}
        onCopyObsUrl={() => void copyObsAlertUrl()}
        onDeleteProject={() => void removeProject()}
      />

      {!project && (
        <section className="card alert-empty-state">
          <div>
            <h2>Create your first alert</h2>
            <p className="subtitle">
              Start with a template, test it in OBS, then swap in your own GIFs, stickers, sounds, and text.
            </p>
            <ol>
              <li>Pick a template that matches the Twitch event.</li>
              <li>Edit layers, timing, animation, and media in the panels.</li>
              <li>Use the test buttons to fire the alert into your OBS browser source.</li>
            </ol>
          </div>
          <div className="alert-template-grid">
            {TEMPLATE_INFOS.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`alert-template-card${templatePreviewId === template.id ? " active" : ""}`}
                onClick={() => setTemplatePreviewId(template.id)}
              >
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
          <TemplatePreview
            templateId={templatePreviewId}
            overlayOrigin={overlayOrigin}
            testPayload={previewTestPayload}
            onApply={() => createFromTemplate(templatePreviewId)}
          />
          <div className="actions" style={{ marginBottom: 0 }}>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={createNew}>Blank alert</button>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => void createSamplePack()} disabled={saving}>
              Add sample pack
            </button>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => void copyObsAlertUrl()}>Copy OBS URL</button>
          </div>
        </section>
      )}

      {templateDialogOpen && (
        <div className="alert-template-dialog" role="dialog" aria-modal="true" aria-labelledby="alert-template-dialog-title">
          <div className="alert-template-dialog__backdrop" aria-hidden="true" onClick={() => setTemplateDialogOpen(false)} />
          <section
            ref={templateDialogPanelRef}
            className="card alert-template-dialog__panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setTemplateDialogOpen(false);
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                templateDialogPanelRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              );
              if (!focusable.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="alert-template-dialog__header">
              <div>
                <h2 id="alert-template-dialog-title">Template Gallery</h2>
                <p className="subtitle">Preview cinematic starting points at a larger size before applying them.</p>
              </div>
              <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setTemplateDialogOpen(false)}>Close</button>
            </div>
            <div className="alert-template-dialog__body">
              <div className="alert-template-dialog__list">
                {TEMPLATE_INFOS.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`alert-template-card${templatePreviewId === template.id ? " active" : ""}`}
                    onClick={() => setTemplatePreviewId(template.id)}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              <div className="alert-template-dialog__preview">
                <TemplatePreview
                  templateId={templatePreviewId}
                  overlayOrigin={overlayOrigin}
                  testPayload={previewTestPayload}
                  large
                  onApply={() => {
                    createFromTemplate(templatePreviewId);
                    setTemplateDialogOpen(false);
                  }}
                />
                {project && (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    onClick={() => {
                      resetCurrentToTemplate(templatePreviewId);
                      setTemplateDialogOpen(false);
                    }}
                  >
                    Reset current project to this template
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {project && (
        <div className="alert-editor-grid">
          <details className="card alert-shortcuts-card alert-collapsible-card">
            <summary>Quick Reference</summary>
            <div className="shortcut-grid">
              <span><kbd>Ctrl</kbd> <kbd>Z</kbd> Undo</span>
              <span><kbd>Ctrl</kbd> <kbd>Y</kbd> Redo</span>
              <span><kbd>Ctrl</kbd> <kbd>D</kbd> Duplicate layer</span>
              <span><kbd>Delete</kbd> Delete layer</span>
              <span><kbd>Arrows</kbd> Nudge 1px</span>
              <span><kbd>Shift</kbd> <kbd>Arrows</kbd> Nudge 10px</span>
            </div>
          </details>

          <details className="card alert-help-card alert-collapsible-card">
            <summary>OBS Setup & Troubleshooting</summary>
            <div>
              <h2>OBS Setup</h2>
              <ol>
                <li>Add a Browser Source in OBS using the copied alert URL.</li>
                <li>Set the source to 1920x1080 or match your canvas preset.</li>
                <li>Keep custom CSS transparent and leave the source active while testing.</li>
              </ol>
              <div className="actions" style={{ marginBottom: 0 }}>
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => void copyObsAlertUrl()}>Copy OBS URL</button>
                <Link className="ui-button ui-button--secondary ui-button--sm" to="/overlays">All overlay URLs</Link>
                <Link className="ui-button ui-button--secondary ui-button--sm" to="/">Dashboard checks</Link>
              </div>
            </div>
            <div>
              <h2>Transparent Source Troubleshooting</h2>
              <ul>
                <li>If OBS shows black, verify the Browser Source URL starts with <code>{overlayOrigin}</code>.</li>
                <li>If tests do nothing, open Dashboard and run browser-source repair.</li>
                <li>If media is missing, check Project Checks for broken local asset paths.</li>
              </ul>
            </div>
          </details>

          <section className="card alert-editor-side-panel alert-project-panel">
            <h2>Project</h2>
            <details className="alert-compact-section">
              <summary>Templates</summary>
              <div className="form-row">
                <label>Start from template</label>
                <select value={templatePreviewId} onChange={(e) => setTemplatePreviewId(e.target.value as TemplateId)}>
                  {TEMPLATE_INFOS.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="actions" style={{ marginBottom: 10 }}>
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setTemplateDialogOpen(true)}>
                  Browse template gallery
                </button>
                <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => createFromTemplate(templatePreviewId)}>
                  Create from selected
                </button>
              </div>
              <div className="alert-template-grid compact">
                {TEMPLATE_INFOS.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`alert-template-card${templatePreviewId === template.id ? " active" : ""}`}
                    onClick={() => setTemplatePreviewId(template.id)}
                    title={template.description}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              <TemplatePreview
                templateId={templatePreviewId}
                overlayOrigin={overlayOrigin}
                testPayload={previewTestPayload}
                onApply={() => createFromTemplate(templatePreviewId)}
              />
              <div className="actions" style={{ marginTop: -6 }}>
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => resetCurrentToTemplate(templatePreviewId)}>
                  Reset current to template
                </button>
              </div>
              <div className="alert-local-templates">
                <h2>Local Templates</h2>
                {localTemplates.length ? (
                  <>
                    <div className="alert-template-grid compact">
                      {localTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className={`alert-template-card${selectedLocalTemplateId === template.id ? " active" : ""}`}
                          onClick={() => setSelectedLocalTemplateId(template.id)}
                          title={`Saved ${new Date(template.savedAt).toLocaleString()}`}
                        >
                          <strong>{template.name}</strong>
                          <span>{template.description}</span>
                        </button>
                      ))}
                    </div>
                    {selectedLocalTemplate && (
                      <div className="actions" style={{ marginBottom: 0 }}>
                        <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => createFromLocalTemplate(selectedLocalTemplate)}>
                          Use local template
                        </button>
                        <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => deleteLocalTemplate(selectedLocalTemplate.id)}>
                          Delete template
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="subtitle">Save a finished alert as a local template to reuse it in future alert projects.</p>
                )}
              </div>
            </details>
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
            <details className="alert-variation-panel alert-compact-section">
              <summary>Variations</summary>
              <div className="alert-editor-panel-title">
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={addVariationFromCurrent}>Capture current</button>
              </div>
              {project.variations.length ? (
                <>
                  <div className="alert-template-grid compact">
                    {project.variations.map((variation) => (
                      <button
                        key={variation.id}
                        type="button"
                        className={`alert-template-card${selectedVariationId === variation.id ? " active" : ""}`}
                        onClick={() => setSelectedVariationId(variation.id)}
                      >
                        <strong>{variation.name}</strong>
                        <span>{variation.enabled ? "Enabled" : "Disabled"} - priority {variation.priority}{variation.legendary ? " - legendary" : ""}</span>
                      </button>
                    ))}
                  </div>
                  {selectedVariation && (
                    <div className="variation-editor">
                      <div className="form-row">
                        <label>Name</label>
                        <input value={selectedVariation.name} onChange={(e) => updateVariation(selectedVariation.id, { name: e.target.value })} />
                      </div>
                      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label><input type="checkbox" checked={selectedVariation.enabled} onChange={(e) => updateVariation(selectedVariation.id, { enabled: e.target.checked })} /> Enabled</label>
                        <label><input type="checkbox" checked={selectedVariation.legendary} onChange={(e) => updateVariation(selectedVariation.id, { legendary: e.target.checked })} /> Legendary</label>
                        <div><label>Priority</label><input type="number" value={selectedVariation.priority} onChange={(e) => updateVariation(selectedVariation.id, { priority: Number(e.target.value) })} /></div>
                        <div><label>Random chance %</label><input type="number" min={0} max={100} value={selectedVariation.condition.randomChance ?? ""} onChange={(e) => updateVariation(selectedVariation.id, { condition: { ...selectedVariation.condition, randomChance: e.target.value ? Number(e.target.value) : undefined } })} /></div>
                        <div><label>Event type</label><select value={selectedVariation.condition.eventType ?? ""} onChange={(e) => updateVariation(selectedVariation.id, { condition: { ...selectedVariation.condition, eventType: e.target.value ? e.target.value as StreamEventType : undefined } })}><option value="">Any</option>{EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
                        <div><label>Min amount</label><input type="number" min={0} value={selectedVariation.condition.minAmount ?? ""} onChange={(e) => updateVariation(selectedVariation.id, { condition: { ...selectedVariation.condition, minAmount: e.target.value ? Number(e.target.value) : undefined } })} /></div>
                        <div><label>User role</label><select value={selectedVariation.condition.userRole ?? ""} onChange={(e) => updateVariation(selectedVariation.id, { condition: { ...selectedVariation.condition, userRole: e.target.value ? e.target.value as NonNullable<AlertVariation["condition"]["userRole"]> : undefined } })}><option value="">Any</option><option value="broadcaster">Broadcaster</option><option value="moderator">Moderator</option><option value="subscriber">Subscriber</option><option value="vip">VIP</option></select></div>
                        <div><label>Channel point title</label><input value={selectedVariation.condition.channelPointTitle ?? ""} onChange={(e) => updateVariation(selectedVariation.id, { condition: { ...selectedVariation.condition, channelPointTitle: e.target.value || undefined } })} /></div>
                      </div>
                      <div className="actions" style={{ marginBottom: 0 }}>
                        <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => void testProjectInObs(selectedVariation.condition.eventType ?? project.eventType, selectedVariation.id)}>Test selected variation</button>
                        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => duplicateVariation(selectedVariation)}>Duplicate variation</button>
                        <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => deleteVariation(selectedVariation.id)}>Delete variation</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="subtitle">Capture the current alert as a variation to add rare, threshold, role, or channel-point-specific versions.</p>
              )}
            </details>
            <details className="alert-chaos-panel alert-compact-section">
              <summary>Chaos Engine</summary>
              <label>
                <input
                  type="checkbox"
                  checked={project.chaos.enabled}
                  onChange={(e) => updateChaos({ enabled: e.target.checked })}
                /> Enable random modifiers
              </label>
              <div className="form-row">
                <label>Chaos intensity ({Math.round(project.chaos.intensity * 100)}%)</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={project.chaos.intensity}
                  onChange={(e) => updateChaos({ intensity: Number(e.target.value) })}
                />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label>Legendary boost %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={project.chaos.legendaryBoost}
                    onChange={(e) => updateChaos({ legendaryBoost: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="chaos-modifier-list">
                {CHAOS_MODIFIERS.map((modifier) => (
                  <label key={modifier.id}>
                    <input
                      type="checkbox"
                      checked={project.chaos.modifiers.includes(modifier.id)}
                      onChange={() => toggleChaosModifier(modifier.id)}
                    /> {modifier.label}
                  </label>
                ))}
              </div>
              <p className="subtitle">When enabled, BTV may apply one selected modifier during alert playback. Legendary variants can receive an extra chance boost.</p>
            </details>
            <details className="alert-safety-panel alert-compact-section">
              <summary>Safety</summary>
              <label>
                <input
                  type="checkbox"
                  checked={project.safeMode}
                  onChange={(e) => commitProject({ ...project, safeMode: e.target.checked, updatedAt: nowIso() })}
                /> Safe mode playback
              </label>
              <p className="subtitle">Safe mode disables custom browser-layer JavaScript during playback and keeps risky custom code contained before going live.</p>
            </details>
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
            <AlertLayersPanel
              layers={project.layers}
              selectedLayerId={selectedLayerId}
              warnings={projectWarnings}
              onAddLayer={addLayer}
              onSelectLayer={setSelectedLayerId}
              onMoveLayer={moveLayer}
              onDuplicateLayer={duplicateLayer}
              onDeleteLayer={deleteLayer}
            />

            <AlertAssetLibrary
              assetSearch={assetSearch}
              assetKind={assetKind}
              assetUploading={assetUploading}
              mediaAssets={filteredMediaAssets}
              soundAssets={filteredSoundAssets}
              overlayOrigin={overlayOrigin}
              giphyAssetType={giphyAssetType}
              giphyQuery={giphyQuery}
              giphyResults={giphyResults}
              giphyLoading={giphyLoading}
              onAssetSearchChange={setAssetSearch}
              onAssetKindChange={setAssetKind}
              onUpload={(file, kind) => void uploadLibraryAsset(file, kind)}
              onApplyMedia={applyMediaAsset}
              onApplySound={applySoundAsset}
              onDelete={(asset, kind) => void deleteLibraryAsset(asset, kind)}
              onGiphyAssetTypeChange={(type) => {
                setGiphyAssetType(type);
                setGiphyResults([]);
              }}
              onGiphyQueryChange={setGiphyQuery}
              onGiphySearch={(query) => void searchGiphy(query)}
              onGiphyImport={(asset) => void importGif(asset)}
            />
          </section>

          <AlertCanvasWorkspace
            project={project}
            visibleLayers={project.layers.filter(visibleAtPlayhead)}
            selectedLayerId={selectedLayerId}
            playheadMs={playheadMs}
            playing={playing}
            showSafeZones={showSafeZones}
            previewBackground={previewBackground}
            previewZoom={previewZoom}
            testPayload={previewTestPayload}
            overlayOrigin={overlayOrigin}
            canvasRef={canvasRef}
            onPlayingChange={setPlaying}
            onRestart={restartPreview}
            onSafeZonesChange={setShowSafeZones}
            onBackgroundChange={setPreviewBackground}
            onZoomChange={setPreviewZoom}
            onSelectLayer={setSelectedLayerId}
            onPlayheadChange={setPlayheadMs}
            onTimelineZoomChange={(zoom) => updateTimeline({ zoom })}
            onCanvasPointerMove={dragLayer}
            onCanvasPointerEnd={stopDrag}
            onLayerPointerDown={startDrag}
            onLayerResizePointerDown={startResize}
            onLayerRotatePointerDown={startRotate}
          />

          <section className="card alert-editor-side-panel alert-inspector-panel">
            <div className="alert-inspector-tabs">
              <h2>{inspectorTab === "test" ? "Test" : "Properties"}</h2>
              <div className="segmented" role="tablist" aria-label="Inspector panels">
                <button type="button" className={inspectorTab === "properties" ? "active" : ""} onClick={() => setInspectorTab("properties")}>Properties</button>
                <button type="button" className={inspectorTab === "test" ? "active" : ""} onClick={() => setInspectorTab("test")}>Test</button>
              </div>
            </div>
            {inspectorTab === "test" ? (
              <AlertTestInspector
                project={project}
                eventTypes={EVENT_TYPES}
                selectedVariationId={selectedVariationId}
                selectedVariation={selectedVariation}
                audioLayer={testAudioLayer}
                payloadJson={testPayloadJson}
                payloadError={testPayloadError}
                saving={saving}
                onTestEvent={(eventType, variationId) => void testProjectInObs(eventType, variationId)}
                onVariationChange={setSelectedVariationId}
                onTestAudio={(layer) => {
                  setSelectedLayerId(layer.id);
                  testAudioLayerPlayback(layer);
                }}
                onPayloadJsonChange={setTestPayloadJson}
              />
            ) : selectedLayer ? (
              <>
                <AlertLayerInspector
                  layer={selectedLayer}
                  projectDurationMs={project.durationMs}
                  onUpdate={updateSelected}
                  onUpdateFilter={updateSelectedFilter}
                  onAlign={alignSelected}
                  onApplyAnimation={applyAnimationPreset}
                  onAddKeyframe={addKeyframe}
                  onUpdateKeyframe={updateKeyframe}
                  onDeleteKeyframe={deleteKeyframe}
                />

                <AlertLayerTypeInspector
                  layer={selectedLayer}
                  assetUploading={assetUploading}
                  onUpdate={updateSelected}
                  onUploadAsset={(file) => void uploadSelectedAsset(file)}
                  onTestAudio={testSelectedAudio}
                  onStopAudio={stopTestAudio}
                />
              </>
            ) : (
              <AlertProjectInspector
                project={project}
                eventTypes={EVENT_TYPES}
                canvasPresets={CANVAS_PRESETS}
                activeCanvasPreset={activeCanvasPreset}
                onUpdate={commitProject}
                onApplyCanvasPreset={applyCanvasPreset}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
