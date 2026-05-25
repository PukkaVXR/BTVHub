import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertProjectSchema } from "@btv/shared";
import type { AlertChaosModifier, AlertKeyframe, AlertLayer, AlertLayerAnimation, AlertProject, AlertVariation, StreamEventType } from "@btv/shared";
import { api, type GiphyAssetType, type GiphyResult, type MediaAssetInfo, type SoundAssetInfo } from "../api";
import { useRegisterSaveStatus } from "../context/SaveStatusContext";
import { useToast } from "../hooks/useToast";
import { PageHeader } from "../ui";

const EVENT_TYPES: StreamEventType[] = ["follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points"];
const CANVAS_PRESETS = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "720p", width: 1280, height: 720 },
];
const BLEND_MODES = ["normal", "screen", "multiply", "overlay", "lighten", "darken", "color-dodge", "difference"] as const;
const KEYFRAME_PROPERTIES = ["opacity", "position", "scale", "rotation"] as const;
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
  "rgb-split",
  "vhs-jitter",
  "bass-shake",
  "glow-pulse",
  "fade-out",
  "pop-out",
  "slide-out",
  "glitch-out",
  "explode-out",
];
const LOOPING_ANIMATION_PRESETS: AlertLayerAnimation["preset"][] = ["pulse", "float", "wiggle", "glow-pulse", "rgb-split", "vhs-jitter", "bass-shake"];
const EXIT_ANIMATION_PRESETS: AlertLayerAnimation["preset"][] = ["fade-out", "pop-out", "slide-out", "glitch-out", "explode-out"];
const ANIMATION_PRESET_LABELS: Record<AlertLayerAnimation["preset"], string> = {
  "none": "None",
  "fade-in": "Fade in",
  "pop-in": "Pop in",
  "slide-in": "Slide in",
  "bounce-in": "Bounce in",
  "elastic-in": "Elastic in",
  "spin-in": "Spin in",
  "screen-slam": "Screen slam",
  "glitch-reveal": "Glitch reveal",
  "pulse": "Pulse",
  "float": "Float",
  "wiggle": "Wiggle",
  "rgb-split": "RGB split",
  "vhs-jitter": "VHS jitter",
  "bass-shake": "Bass shake",
  "glow-pulse": "Glow pulse",
  "fade-out": "Fade out",
  "pop-out": "Pop out",
  "slide-out": "Slide out",
  "glitch-out": "Glitch out",
  "explode-out": "Explode out",
};

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
type PreviewZoom = "fit" | 0.25 | 0.5 | 1;
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
type TestPayload = {
  user?: string;
  login?: string;
  amount?: number;
  message?: string;
  variables?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};
type LayerStyle = CSSProperties & { "--btv-intensity"?: string };
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

function payloadPath(payload: Record<string, unknown> | undefined, path: string): string {
  let value: unknown = payload;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object") return "";
    value = (value as Record<string, unknown>)[key];
  }
  return value == null ? "" : String(value);
}

function renderTemplate(text: string, eventType: StreamEventType, testPayload: TestPayload): string {
  return text
    .replaceAll("{user}", testPayload.user ?? "TestUser")
    .replaceAll("{login}", testPayload.login ?? "testuser")
    .replaceAll("{event}", eventType)
    .replaceAll("{amount}", String(testPayload.amount ?? (eventType === "cheer" ? 100 : 1)))
    .replaceAll("{message}", testPayload.message ?? "Test visual alert from hub")
    .replace(/\{var:([^}]+)\}/g, (_, key: string) => payloadPath(testPayload.variables, key.trim()))
    .replace(/\{payload\.([^}]+)\}/g, (_, path: string) => payloadPath(testPayload.payload, path));
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

function numericKeyframeValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function layerAtPlayhead(layer: AlertLayer, playheadMs: number): AlertLayer {
  if (!layer.keyframes.length) return layer;
  const frames = [...layer.keyframes].sort((a, b) => a.atMs - b.atMs);
  const before = [...frames].reverse().find((frame) => frame.atMs <= playheadMs);
  const after = frames.find((frame) => frame.atMs >= playheadMs && frame.id !== before?.id);
  const readFrame = (frame: AlertKeyframe | undefined, key: string, fallback: number) => numericKeyframeValue(frame?.properties[key], fallback);

  if (!before && !after) return layer;
  if (before && !after) {
    return {
      ...layer,
      x: readFrame(before, "x", layer.x),
      y: readFrame(before, "y", layer.y),
      opacity: readFrame(before, "opacity", layer.opacity),
      scale: readFrame(before, "scale", layer.scale),
      rotation: readFrame(before, "rotation", layer.rotation),
    } as AlertLayer;
  }

  if (!before && after) {
    return {
      ...layer,
      x: readFrame(after, "x", layer.x),
      y: readFrame(after, "y", layer.y),
      opacity: readFrame(after, "opacity", layer.opacity),
      scale: readFrame(after, "scale", layer.scale),
      rotation: readFrame(after, "rotation", layer.rotation),
    } as AlertLayer;
  }

  const span = Math.max(1, after!.atMs - before!.atMs);
  const t = Math.max(0, Math.min(1, (playheadMs - before!.atMs) / span));
  return {
    ...layer,
    x: lerp(readFrame(before, "x", layer.x), readFrame(after, "x", layer.x), t),
    y: lerp(readFrame(before, "y", layer.y), readFrame(after, "y", layer.y), t),
    opacity: lerp(readFrame(before, "opacity", layer.opacity), readFrame(after, "opacity", layer.opacity), t),
    scale: lerp(readFrame(before, "scale", layer.scale), readFrame(after, "scale", layer.scale), t),
    rotation: lerp(readFrame(before, "rotation", layer.rotation), readFrame(after, "rotation", layer.rotation), t),
  } as AlertLayer;
}

function layerStyle(layer: AlertLayer, playheadMs?: number): LayerStyle {
  const displayLayer = playheadMs == null ? layer : layerAtPlayhead(layer, playheadMs);
  const animation = layer.animation?.preset && layer.animation.preset !== "none"
    ? `${layer.animation.preset} ${layer.animation.durationMs}ms ${cssEasing(layer.animation.easing)} ${layer.animation.delayMs}ms ${layer.animation.loop ? "infinite" : "both"}`
    : undefined;
  return {
    position: "absolute",
    left: displayLayer.x,
    top: displayLayer.y,
    width: displayLayer.width,
    height: displayLayer.height,
    opacity: displayLayer.opacity,
    transform: `rotate(${displayLayer.rotation}deg) scale(${displayLayer.scale})`,
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
  } satisfies LayerStyle;
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

class AlertPreviewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, message: error instanceof Error ? error.message : "Preview render failed" };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Alert preview render error:", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="alert-preview-error">
          <strong>Preview render failed</strong>
          <span>{this.state.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function PreviewLayer({
  layer,
  eventType,
  testPayload,
  selected,
  playheadMs,
  overlayOrigin,
  onPointerDown,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  layer: AlertLayer;
  eventType: StreamEventType;
  testPayload: TestPayload;
  selected: boolean;
  playheadMs?: number;
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
          ...layerStyle(layer, playheadMs),
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
        {renderTemplate(layer.text, eventType, testPayload)}
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "shape") {
    return (
      <div
        onPointerDown={onPointerDown}
        style={{
          ...layerStyle(layer, playheadMs),
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

  if (layer.type === "particle") {
    return (
      <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer, playheadMs), ...selectionStyle }}>
        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: layer.color, border: `2px dashed ${layer.color}`, borderRadius: 12 }}>
          {layer.particle} particles
        </div>
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "browser") {
    return (
      <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer, playheadMs), ...selectionStyle }}>
        <iframe
          title={layer.name}
          sandbox={layer.sandbox ? "allow-same-origin" : undefined}
          srcDoc={`<style>${layer.css}</style>${layer.html}`}
          style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none", background: "transparent" }}
        />
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  return (
    <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer, playheadMs), ...selectionStyle }}>
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

function TemplatePreview({
  templateId,
  overlayOrigin,
  testPayload,
  onApply,
}: {
  templateId: TemplateId;
  overlayOrigin: string;
  testPayload: TestPayload;
  onApply: () => void;
}) {
  const previewProject = useMemo(() => createTemplateProject(templateId), [templateId]);
  const info = templateInfo(templateId);
  const scale = 0.12;
  const noopPointer = () => undefined;
  const noopResize = () => undefined;
  const noopRotate = () => undefined;

  return (
    <div className="alert-template-preview">
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
      <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
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

function assetAttribution(asset: MediaAssetInfo | SoundAssetInfo): string {
  const metadata = asset.metadata;
  if (!metadata?.source) return "";
  if (metadata.source === "giphy") {
    const kind = metadata.sourceType === "sticker" ? "GIPHY sticker" : "GIPHY GIF";
    return metadata.username ? `${kind} by ${metadata.username}` : kind;
  }
  return "Uploaded locally";
}

function pct(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
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
  const normalized = withTimeline(project);
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

function withTimeline(project: AlertProject): AlertProject {
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
    canvas: project.canvas ?? {
      width: 1920,
      height: 1080,
      background: "transparent",
      backgroundColor: "transparent",
    },
    layers: project.layers ?? [],
    variations: project.variations ?? [],
    tags: project.tags ?? [],
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
      warnings.push({ level: "warning", message: `${layer.name} is large (${formatBytes(asset.size)}). Consider trimming or compressing it.` });
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
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [project, setProject] = useState<AlertProject | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [previewBackground, setPreviewBackground] = useState<"checkerboard" | "dark" | "transparent">("checkerboard");
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>("fit");
  const [previewFitScale, setPreviewFitScale] = useState(0.34);
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
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const toast = useToast();

  const selectedLayer = useMemo(
    () => project?.layers?.find((layer) => layer.id === selectedLayerId) ?? project?.layers?.[0] ?? null,
    [project, selectedLayerId],
  );

  const dirty = useMemo(() => projectSignature(project) !== savedSignature, [project, savedSignature]);
  useRegisterSaveStatus("visual-alert-editor", "Alert editor", saving ? "saving" : dirty ? "dirty" : "saved");
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
  const selectedLocalTemplate = useMemo(
    () => localTemplates.find((template) => template.id === selectedLocalTemplateId) ?? null,
    [localTemplates, selectedLocalTemplateId],
  );
  const selectedVariation = useMemo(
    () => project?.variations?.find((variation) => variation.id === selectedVariationId) ?? null,
    [project?.variations, selectedVariationId],
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
    const normalized = next ? withTimeline(next) : null;
    setProject(normalized);
    setSelectedLayerId(normalized?.layers[0]?.id ?? "");
    setSelectedVariationId(normalized?.variations[0]?.id ?? "");
    setPlayheadMs(0);
    setPlaying(false);
    setHistory({ past: [], future: [] });
    setSavedSignature(projectSignature(normalized));
  };

  const commitProject = (next: AlertProject, options: { recordHistory?: boolean } = {}) => {
    const recordHistory = options.recordHistory ?? true;
    if (recordHistory && project && project.id === next.id) {
      setHistory((prev) => ({ past: [...prev.past.slice(-49), project], future: [] }));
    }
    setProject(withTimeline(next));
  };

  const load = () => {
    void Promise.all([api.alertProjects(), api.listMedia(), api.listSounds()]).then(([items, media, sounds]) => {
      setProjects(items);
      setMediaAssets(media.media);
      setSoundAssets(sounds.sounds);
      setProject((prev) => {
        const requested = routeProjectId ?? searchParams.get("id");
        const next = (requested ? items.find((item) => item.id === requested) : null) ?? prev ?? items[0] ?? null;
        const normalized = next ? withTimeline(next) : null;
        if (!prev) {
          setSelectedLayerId(normalized?.layers[0]?.id ?? "");
          setSelectedVariationId(normalized?.variations[0]?.id ?? "");
          setSavedSignature(projectSignature(normalized));
        }
        return normalized;
      });
    });
  };

  useEffect(load, []);

  useEffect(() => {
    const templates = loadLocalTemplates();
    setLocalTemplates(templates);
    setSelectedLocalTemplateId(templates[0]?.id ?? "");
  }, []);

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
      const timeline = project.timeline ?? {
        durationMs: project.durationMs,
        fps: 60,
        snapMs: 100,
        zoom: 1,
      };
      const next = withTimeline({
        ...project,
        timeline: { durationMs: project.durationMs, fps: timeline.fps, snapMs: timeline.snapMs, zoom: timeline.zoom },
        updatedAt: nowIso(),
      });
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

  const testProjectInObs = async (eventType: StreamEventType, variationId?: string) => {
    if (!project) return;
    setSaving(true);
    try {
      const parsedPayload = JSON.parse(testPayloadJson) as Record<string, unknown>;
      const next = { ...project, eventType, updatedAt: nowIso() };
      await api.saveAlertProject(next);
      setProject(next);
      setSavedSignature(projectSignature(next));
      await api.testAlertProject(next.id, eventType, parsedPayload, variationId);
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
    setProject(next);
    setSelectedLayerId(next.layers[0]?.id ?? "");
    setPlayheadMs(0);
    setPlaying(false);
    setHistory({ past: [], future: [] });
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

  const testSelectedAudio = () => {
    if (!selectedLayer || selectedLayer.type !== "audio" || !selectedLayer.assetUrl) {
      toast("Select an audio layer with an asset URL first");
      return;
    }
    stopTestAudio();
    if (selectedLayer.muted) {
      toast("Audio layer is muted");
      return;
    }
    const audio = new Audio(resolvePreviewAssetUrl(selectedLayer.assetUrl, overlayOrigin));
    audio.loop = Boolean(selectedLayer.loop);
    const offsetMs = Math.max(0, Number(selectedLayer.startOffsetMs ?? 0));
    audio.currentTime = offsetMs / 1000;
    testAudioTimersRef.current = applyAudioFade(
      audio,
      Number(selectedLayer.volume ?? 1),
      Number(selectedLayer.fadeInMs ?? 0),
      Number(selectedLayer.fadeOutMs ?? 0),
      Math.max(0, Number(selectedLayer.endMs ?? 0) - Number(selectedLayer.startMs ?? 0)),
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

  const addKeyframe = (property: typeof KEYFRAME_PROPERTIES[number]) => {
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
    const current = project.timeline ?? withTimeline(project).timeline!;
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
    const current = withTimeline(project).chaos;
    commitProject({ ...project, chaos: { ...current, ...patch }, updatedAt: nowIso() });
  };

  const toggleChaosModifier = (modifier: AlertChaosModifier) => {
    if (!project) return;
    const current = withTimeline(project).chaos;
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
      <PageHeader title="Visual Alert Editor" description="Create, test, and manage BTV's primary cinematic alert projects." />

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
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void createSamplePack()} disabled={saving}>Sample pack</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={saveCurrentAsLocalTemplate} disabled={!project}>Save as template</button>
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
        <Link className="btn btn-secondary btn-sm" to="/alerts/routing">Advanced routing</Link>
        <Link className="btn btn-secondary btn-sm" to="/themes">Legacy themes</Link>
        <span className={`alert-save-status${dirty ? " dirty" : ""}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>

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
            <button type="button" className="btn btn-primary btn-sm" onClick={createNew}>Blank alert</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void createSamplePack()} disabled={saving}>
              Add sample pack
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyObsAlertUrl()}>Copy OBS URL</button>
          </div>
        </section>
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyObsAlertUrl()}>Copy OBS URL</button>
                <Link className="btn btn-secondary btn-sm" to="/overlays">All overlay URLs</Link>
                <Link className="btn btn-secondary btn-sm" to="/">Dashboard checks</Link>
              </div>
            </div>
            <div>
              <h2>Transparent Source Troubleshooting</h2>
              <ul>
                <li>If OBS shows black, verify the Browser Source URL starts with <code>http://127.0.0.1:4782</code>.</li>
                <li>If tests do nothing, open Dashboard and run browser-source repair.</li>
                <li>If media is missing, check Project Checks for broken local asset paths.</li>
              </ul>
            </div>
          </details>

          <section className="card alert-editor-side-panel">
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => resetCurrentToTemplate(templatePreviewId)}>
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
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => createFromLocalTemplate(selectedLocalTemplate)}>
                          Use local template
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteLocalTemplate(selectedLocalTemplate.id)}>
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={addVariationFromCurrent}>Capture current</button>
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
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => void testProjectInObs(selectedVariation.condition.eventType ?? project.eventType, selectedVariation.id)}>Test selected variation</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => duplicateVariation(selectedVariation)}>Duplicate variation</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteVariation(selectedVariation.id)}>Delete variation</button>
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
            <div className="actions" style={{ marginTop: 0, marginBottom: 16 }}>
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`btn btn-sm ${project.eventType === type ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => void testProjectInObs(type)}
                  disabled={saving || Boolean(testPayloadError)}
                >
                  Test {type}
                </button>
              ))}
            </div>
            <details className="alert-compact-section">
              <summary>Test payload JSON</summary>
              <div className="form-row">
                <textarea
                  rows={7}
                  value={testPayloadJson}
                  onChange={(e) => setTestPayloadJson(e.target.value)}
                  spellCheck={false}
                />
                <p className={testPayloadError ? "form-error" : "subtitle"}>
                  {testPayloadError
                    ? `Invalid JSON: ${testPayloadError}`
                    : (
                      <>
                        Template variables: <code>{"{user}"}</code>, <code>{"{login}"}</code>, <code>{"{event}"}</code>, <code>{"{amount}"}</code>, <code>{"{message}"}</code>, <code>{"{payload.rewardTitle}"}</code>.
                      </>
                    )}
                </p>
              </div>
            </details>

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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("particle")}>Particles</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addLayer("browser")}>HTML</button>
            </div>
            <div className="layer-list">
              {project.layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={`layer-row${selectedLayer?.id === layer.id ? " active" : ""}`}
                  onClick={() => setSelectedLayerId(layer.id)}
                  title="Select this layer to edit its timeline, visual, and media properties."
                >
                  <span>{layer.visible ? "Shown" : "Hidden"}</span>
                  <strong>{layer.name}</strong>
                  <em>{layer.type}</em>
                </button>
              ))}
            </div>
            <div className="actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveLayer(-1)} disabled={!selectedLayer} title="Move selected layer earlier in the stack.">Up</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveLayer(1)} disabled={!selectedLayer} title="Move selected layer later in the stack.">Down</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={duplicateLayer} disabled={!selectedLayer} title="Duplicate selected layer. Shortcut: Ctrl+D.">Duplicate</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={deleteLayer} disabled={!selectedLayer} title="Delete selected layer. Shortcut: Delete.">Delete layer</button>
            </div>

            <details className="alert-compact-section">
              <summary>Assets</summary>
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
                      {assetAttribution(asset) && <span>{assetAttribution(asset)}</span>}
                    </button>
                    <button type="button" className="asset-delete" onClick={() => void deleteLibraryAsset(asset, "media")}>Delete</button>
                  </div>
                ))}
                {filteredSoundAssets.map((asset) => (
                  <div key={asset.url} className="asset-card audio">
                    <button type="button" onClick={() => applySoundAsset(asset)} title={`Use ${asset.name}`}>
                      <strong>{asset.name}</strong>
                      <span>audio - {formatBytes(asset.size)}</span>
                      {assetAttribution(asset) && <span>{assetAttribution(asset)}</span>}
                    </button>
                    <button type="button" className="asset-delete" onClick={() => void deleteLibraryAsset(asset, "sound")}>Delete</button>
                  </div>
                ))}
              </div>
              {!filteredMediaAssets.length && !filteredSoundAssets.length && (
                <p className="subtitle">No local assets match this filter.</p>
              )}
            </details>

            <details className="alert-compact-section">
              <summary>GIPHY</summary>
              <div className="segmented" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={giphyAssetType === "gif" ? "active" : ""}
                  onClick={() => {
                    setGiphyAssetType("gif");
                    setGiphyResults([]);
                  }}
                >
                  GIFs
                </button>
                <button
                  type="button"
                  className={giphyAssetType === "sticker" ? "active" : ""}
                  onClick={() => {
                    setGiphyAssetType("sticker");
                    setGiphyResults([]);
                  }}
                >
                  Stickers
                </button>
              </div>
              <div className="form-row">
                <label>Search {giphyAssetType === "sticker" ? "stickers" : "GIFs"}</label>
                <input
                  value={giphyQuery}
                  onChange={(e) => setGiphyQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchGiphy();
                  }}
                  placeholder={giphyAssetType === "sticker" ? "sparkle, hype, emote..." : "hype, raid, explosion..."}
                />
              </div>
              <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void searchGiphy()} disabled={giphyLoading}>
                  {giphyLoading ? "Searching..." : "Search"}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void searchGiphy("")} disabled={giphyLoading}>
                  Trending {giphyAssetType === "sticker" ? "stickers" : "GIFs"}
                </button>
              </div>
              <div className="giphy-grid">
                {giphyResults.map((gif) => (
                  <button key={gif.id} type="button" className="giphy-card" onClick={() => void importGif(gif)} title={gif.title}>
                    <img src={gif.previewUrl} alt={gif.title} />
                    <span>{gif.title || (gif.type === "sticker" ? "Import sticker" : "Import GIF")}</span>
                  </button>
                ))}
              </div>
            </details>
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
                <button type="button" className={previewZoom === "fit" ? "active" : ""} onClick={() => setPreviewZoom("fit")} title="Fit the full alert canvas into the preview area.">Fit</button>
                <button type="button" className={previewZoom === 0.25 ? "active" : ""} onClick={() => setPreviewZoom(0.25)} title="Preview at 25% scale.">25%</button>
                <button type="button" className={previewZoom === 0.5 ? "active" : ""} onClick={() => setPreviewZoom(0.5)} title="Preview at 50% scale.">50%</button>
                <button type="button" className={previewZoom === 1 ? "active" : ""} onClick={() => setPreviewZoom(1)} title="Preview at full canvas scale.">100%</button>
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
                <AlertPreviewErrorBoundary>
                  {showSafeZones && <div className="alert-safe-zone" />}
                  {project.layers.filter(visibleAtPlayhead).map((layer) => (
                    <PreviewLayer
                      key={layer.id}
                      layer={layer}
                      eventType={project.eventType}
                      testPayload={previewTestPayload}
                      selected={selectedLayer?.id === layer.id}
                      playheadMs={playheadMs}
                      overlayOrigin={overlayOrigin}
                      onPointerDown={(event) => startDrag(layer, event)}
                      onResizePointerDown={(handle, event) => startResize(layer, handle, event)}
                      onRotatePointerDown={(event) => startRotate(layer, event)}
                    />
                  ))}
                </AlertPreviewErrorBoundary>
              </div>
            </div>
            <div className="alert-timeline">
              <div className="alert-timeline-header">
                <span>{Math.round(playheadMs)}ms</span>
                <input
                  title="Scrub the alert timeline preview."
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
                <label className="timeline-zoom-control">
                  Zoom
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.25}
                    value={project.timeline?.zoom ?? 1}
                    onChange={(e) => updateTimeline({ zoom: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="alert-timeline-tracks" style={{ minWidth: `${Math.round((project.timeline?.zoom ?? 1) * 100)}%` }}>
                {project.layers.map((layer) => {
                  const left = pct(layer.startMs, project.durationMs);
                  const width = pct(layer.endMs - layer.startMs, project.durationMs);
                  const layerDuration = Math.max(1, layer.endMs - layer.startMs);
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={`alert-timeline-track${selectedLayer?.id === layer.id ? " active" : ""}${layer.type === "audio" ? " audio" : ""}`}
                      onClick={() => setSelectedLayerId(layer.id)}
                      title="Layer timing. Edit Start and End in Properties."
                    >
                      <span>{layer.name}</span>
                      <i style={{ left, width }} />
                      {layer.type === "audio" && (
                        <b
                          className="alert-audio-bar"
                          style={{
                            left,
                            width,
                            "--offset": pct(layer.startOffsetMs ?? 0, layerDuration),
                            "--fade-in": pct(layer.fadeInMs ?? 0, layerDuration),
                            "--fade-out": pct(layer.fadeOutMs ?? 0, layerDuration),
                          } as CSSProperties}
                        />
                      )}
                    </button>
                  );
                })}
                <b className="alert-playhead" style={{ left: `${(playheadMs / project.durationMs) * 100}%` }} />
              </div>
            </div>
          </section>

          <section className="card alert-editor-side-panel">
            <h2>Properties</h2>
            {selectedLayer ? (
              <>
                <div className="form-row">
                  <label title="Name shown in the layer stack and timeline.">Layer name</label>
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
                      <option key={preset} value={preset}>{ANIMATION_PRESET_LABELS[preset]}</option>
                    ))}
                  </select>
                </div>
                <div className="animation-preset-gallery">
                  {ANIMATION_PRESETS.filter((preset) => preset !== "none").map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={selectedLayer.animation?.preset === preset ? "active" : ""}
                      onClick={() => applyAnimationPreset(preset)}
                      title={`Apply ${ANIMATION_PRESET_LABELS[preset]}`}
                    >
                      <span className={`animation-preset-swatch preset-${preset}`} />
                      <strong>{ANIMATION_PRESET_LABELS[preset]}</strong>
                    </button>
                  ))}
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
                  <div><label title="When this layer appears during the alert.">Start (ms)</label><input type="number" value={selectedLayer.startMs} onChange={(e) => updateSelected({ startMs: Number(e.target.value) })} /></div>
                  <div><label title="When this layer disappears during the alert.">End (ms)</label><input type="number" value={selectedLayer.endMs} onChange={(e) => updateSelected({ endMs: Number(e.target.value) })} /></div>
                </div>
                <div className="alert-keyframe-panel">
                  <h3>Keyframes</h3>
                  <div className="actions" style={{ marginBottom: 10 }}>
                    {KEYFRAME_PROPERTIES.map((property) => (
                      <button key={property} type="button" className="btn btn-secondary btn-sm" onClick={() => addKeyframe(property)}>
                        Add {property}
                      </button>
                    ))}
                  </div>
                  {selectedLayer.keyframes.length ? (
                    <div className="keyframe-list">
                      {selectedLayer.keyframes.map((frame) => (
                        <div key={frame.id} className="keyframe-row">
                          <input
                            type="number"
                            min={0}
                            max={project.durationMs}
                            value={frame.atMs}
                            title="Keyframe time in milliseconds."
                            onChange={(e) => updateKeyframe(frame.id, { atMs: Number(e.target.value) })}
                          />
                          <select value={frame.easing} onChange={(e) => updateKeyframe(frame.id, { easing: e.target.value as AlertKeyframe["easing"] })}>
                            <option value="linear">linear</option>
                            <option value="ease-in">ease-in</option>
                            <option value="ease-out">ease-out</option>
                            <option value="ease-in-out">ease-in-out</option>
                            <option value="bounce">bounce</option>
                            <option value="elastic">elastic</option>
                          </select>
                          <span>{Object.keys(frame.properties).join(", ") || "empty"}</span>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteKeyframe(frame.id)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="subtitle">Move the playhead, adjust the layer, then add a keyframe for the property you want to animate.</p>
                  )}
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

                {selectedLayer.type === "particle" && (
                  <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div><label>Particle type</label><select value={selectedLayer.particle} onChange={(e) => updateSelected({ particle: e.target.value } as Partial<AlertLayer>)}><option value="confetti">Confetti</option><option value="spark">Spark</option><option value="burst">Burst</option><option value="embers">Embers</option><option value="snow">Snow</option></select></div>
                    <div><label>Count</label><input type="number" min={1} max={1000} value={selectedLayer.count} onChange={(e) => updateSelected({ count: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                    <div><label>Color</label><input type="color" value={selectedLayer.color} onChange={(e) => updateSelected({ color: e.target.value } as Partial<AlertLayer>)} /></div>
                    <div><label>Spread</label><input type="number" min={0} max={360} value={selectedLayer.spread} onChange={(e) => updateSelected({ spread: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                    <div><label>Speed</label><input type="number" min={0} max={10} step={0.1} value={selectedLayer.speed} onChange={(e) => updateSelected({ speed: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                  </div>
                )}

                {selectedLayer.type === "browser" && (
                  <div className="alert-advanced-panel">
                    <h3>Advanced Code</h3>
                    <p className="subtitle">Custom browser layers are sandboxed by default. JavaScript is disabled unless you turn off the sandbox, and Safe mode disables it during playback.</p>
                    <div className="form-row"><label>HTML</label><textarea rows={4} value={selectedLayer.html} onChange={(e) => updateSelected({ html: e.target.value } as Partial<AlertLayer>)} /></div>
                    <div className="form-row"><label>CSS</label><textarea rows={4} value={selectedLayer.css} onChange={(e) => updateSelected({ css: e.target.value } as Partial<AlertLayer>)} /></div>
                    <div className="form-row"><label>JavaScript hook</label><textarea rows={3} value={selectedLayer.js} onChange={(e) => updateSelected({ js: e.target.value } as Partial<AlertLayer>)} /></div>
                    <label><input type="checkbox" checked={selectedLayer.sandbox} onChange={(e) => updateSelected({ sandbox: e.target.checked } as Partial<AlertLayer>)} /> Sandbox iframe</label>
                    <details>
                      <summary>Event payload and lifecycle notes</summary>
                      <p className="subtitle">Text layers support <code>{"{user}"}</code>, <code>{"{login}"}</code>, <code>{"{event}"}</code>, <code>{"{amount}"}</code>, <code>{"{message}"}</code>, <code>{"{var:hype}"}</code>, and <code>{"{payload.rewardTitle}"}</code>. Browser layer JavaScript runs inside the iframe when sandbox scripts are allowed; keep setup code self-contained.</p>
                    </details>
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
                      <>
                        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                          <div><label>Volume</label><input type="number" min={0} max={1} step={0.05} value={selectedLayer.volume} onChange={(e) => updateSelected({ volume: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                          <div><label>Start offset (ms)</label><input type="number" min={0} value={selectedLayer.startOffsetMs ?? 0} onChange={(e) => updateSelected({ startOffsetMs: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                          <div><label>Fade in (ms)</label><input type="number" min={0} value={selectedLayer.fadeInMs ?? 0} onChange={(e) => updateSelected({ fadeInMs: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                          <div><label>Fade out (ms)</label><input type="number" min={0} value={selectedLayer.fadeOutMs ?? 0} onChange={(e) => updateSelected({ fadeOutMs: Number(e.target.value) } as Partial<AlertLayer>)} /></div>
                          <label style={{ alignSelf: "center", marginTop: 16 }}><input type="checkbox" checked={selectedLayer.loop} onChange={(e) => updateSelected({ loop: e.target.checked } as Partial<AlertLayer>)} /> Loop</label>
                          <label style={{ alignSelf: "center", marginTop: 0 }}><input type="checkbox" checked={selectedLayer.muted} onChange={(e) => updateSelected({ muted: e.target.checked } as Partial<AlertLayer>)} /> Muted</label>
                        </div>
                        <div className="actions" style={{ marginTop: 0 }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={testSelectedAudio} disabled={!selectedLayer.assetUrl || selectedLayer.muted}>
                            Test sound
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={stopTestAudio}>
                            Stop sound
                          </button>
                        </div>
                        <div className="form-row">
                          <label>Future audio-reactive data</label>
                          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label style={{ alignSelf: "center", marginTop: 16 }}>
                              <input
                                type="checkbox"
                                checked={selectedLayer.reactive?.enabled ?? false}
                                onChange={(e) => updateSelected({ reactive: { ...(selectedLayer.reactive ?? { mode: "none", sensitivity: 1 }), enabled: e.target.checked } } as Partial<AlertLayer>)}
                              /> Reactive
                            </label>
                            <div>
                              <label>Mode</label>
                              <select
                                value={selectedLayer.reactive?.mode ?? "none"}
                                onChange={(e) => updateSelected({ reactive: { ...(selectedLayer.reactive ?? { enabled: false, sensitivity: 1 }), mode: e.target.value as "none" | "amplitude" | "bass" } } as Partial<AlertLayer>)}
                              >
                                <option value="none">None</option>
                                <option value="amplitude">Amplitude</option>
                                <option value="bass">Bass</option>
                              </select>
                            </div>
                            <div>
                              <label>Sensitivity</label>
                              <input
                                type="number"
                                min={0}
                                max={5}
                                step={0.1}
                                value={selectedLayer.reactive?.sensitivity ?? 1}
                                onChange={(e) => updateSelected({ reactive: { ...(selectedLayer.reactive ?? { enabled: false, mode: "none" }), sensitivity: Number(e.target.value) } } as Partial<AlertLayer>)}
                              />
                            </div>
                          </div>
                        </div>
                      </>
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
