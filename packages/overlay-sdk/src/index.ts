import {
  BusMessageSchema,
  type BusMessage,
  OVERLAY_WS_URL,
} from "@btv/shared";

export type BusMessageHandler = (msg: BusMessage) => void;
export type ConnectionStateHandler = (
  state: "connecting" | "connected" | "disconnected",
) => void;

export interface OverlayClientOptions {
  wsUrl?: string;
  channels?: string[];
  onMessage?: BusMessageHandler;
  onStateChange?: ConnectionStateHandler;
}

export class OverlayClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private backoffMs = 1000;
  private readonly maxBackoffMs = 30000;
  private disposed = false;

  constructor(private readonly options: OverlayClientOptions = {}) {}

  connect(): void {
    if (this.disposed) return;
    this.options.onStateChange?.("connecting");
    const url = new URL(this.options.wsUrl ?? OVERLAY_WS_URL);
    if (this.options.channels?.length) {
      url.searchParams.set("channels", this.options.channels.join(","));
    }
    if (typeof location !== "undefined") {
      url.searchParams.set("route", location.pathname);
    }
    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.backoffMs = 1000;
      this.options.onStateChange?.("connected");
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 15000);
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data));
        const msg = BusMessageSchema.parse(data);
        this.options.onMessage?.(msg);
      } catch {
        /* ignore malformed */
      }
    };

    this.ws.onclose = () => {
      this.options.onStateChange?.("disconnected");
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.connect();
    }, this.backoffMs);
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.ws?.close();
    this.ws = null;
  }

  private sendHeartbeat(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      kind: "overlay:heartbeat",
      route: typeof location !== "undefined" ? location.pathname : undefined,
      at: new Date().toISOString(),
    }));
  }
}

export function renderAlert(
  container: HTMLElement,
  alert: Extract<BusMessage, { kind: "alert:play" }>["alert"],
): () => void {
  const visualProject = (alert as { visualProject?: unknown }).visualProject;
  if (visualProject && typeof visualProject === "object") {
    return renderVisualAlert(container, alert, visualProject as VisualAlertProject);
  }

  const slot = document.createElement("div");
  slot.className = "btv-alert-slot";
  const root = document.createElement("div");
  root.className = "btv-alert-root";
  root.innerHTML = alert.html;
  slot.appendChild(root);
  const style = document.createElement("style");
  style.textContent = alert.css;
  container.appendChild(style);
  container.appendChild(slot);

  const removeAll = () => {
    slot.remove();
    style.remove();
  };

  let cleanup: (() => void) | undefined;
  if (alert.js) {
    try {
      const fn = new Function(
        "event",
        "root",
        "onHide",
        `${alert.js}\nif (typeof onShow === 'function') onShow(event, root, onHide);`,
      );
      const onHide = () => {
        removeAll();
        cleanup?.();
      };
      fn(alert.event, root, onHide);
    } catch (e) {
      console.error("Alert theme JS error:", e);
    }
  } else {
    root.classList.add("btv-alert-default");
    const title = root.querySelector(".alert-title") ?? root;
    if (title) {
      title.textContent = `${alert.event.user?.displayName ?? "Someone"} — ${alert.event.type}`;
    }
  }

  if (alert.soundUrl) {
    const audio = new Audio(alert.soundUrl);
    audio.play().catch(() => undefined);
  }

  const timeout = setTimeout(() => {
    removeAll();
    cleanup?.();
  }, alert.durationMs);

  return () => {
    clearTimeout(timeout);
    removeAll();
    cleanup?.();
  };
}

interface VisualAlertProject {
  durationMs?: number;
  canvas?: {
    width?: number;
    height?: number;
    background?: string;
    backgroundColor?: string;
  };
  layers?: VisualAlertLayer[];
}

type VisualAlertLayer = {
  id: string;
  type: string;
  name?: string;
  visible?: boolean;
  startMs?: number;
  endMs?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  scale?: number;
  blendMode?: string;
  filter?: {
    blur?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hueRotate?: number;
    glow?: number;
    glowColor?: string;
  };
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: string;
  shape?: "rectangle" | "ellipse";
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  assetUrl?: string;
  fit?: "contain" | "cover" | "fill";
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  animation?: {
    preset?: string;
    delayMs?: number;
    durationMs?: number;
    easing?: string;
    intensity?: number;
    loop?: boolean;
  };
};

function renderVisualAlert(
  container: HTMLElement,
  alert: Extract<BusMessage, { kind: "alert:play" }>["alert"],
  project: VisualAlertProject,
): () => void {
  const slot = document.createElement("div");
  slot.className = "btv-alert-slot btv-visual-alert-slot";
  const root = document.createElement("div");
  root.className = "btv-visual-alert-root";
  const width = Number(project.canvas?.width ?? 1920);
  const height = Number(project.canvas?.height ?? 1080);
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    width: `${width}px`,
    height: `${height}px`,
    transformOrigin: "top left",
    pointerEvents: "none",
    overflow: "hidden",
    background: project.canvas?.background === "solid" ? project.canvas.backgroundColor ?? "transparent" : "transparent",
  });
  slot.appendChild(root);
  const style = document.createElement("style");
  style.textContent = VISUAL_ALERT_ANIMATION_CSS;
  slot.appendChild(style);
  container.appendChild(slot);

  const timers: ReturnType<typeof setTimeout>[] = [];
  const audios: HTMLAudioElement[] = [];

  for (const layer of project.layers ?? []) {
    if (layer.visible === false) continue;
    const el = createVisualLayer(layer, alert);
    if (!el) continue;
    root.appendChild(el);
    const startMs = Math.max(0, Number(layer.startMs ?? 0));
    const endMs = Math.max(startMs, Number(layer.endMs ?? project.durationMs ?? alert.durationMs));
    el.style.display = startMs > 0 ? "none" : "";
    if (startMs > 0) timers.push(setTimeout(() => (el.style.display = ""), startMs));
    timers.push(setTimeout(() => el.remove(), endMs));
    if (el instanceof HTMLAudioElement) audios.push(el);
  }

  if (alert.soundUrl) {
    const audio = new Audio(alert.soundUrl);
    audios.push(audio);
    audio.play().catch(() => undefined);
  }

  const cleanup = () => {
    for (const timer of timers) clearTimeout(timer);
    for (const audio of audios) {
      audio.pause();
      audio.currentTime = 0;
    }
    slot.remove();
  };
  timers.push(setTimeout(cleanup, alert.durationMs ?? project.durationMs ?? 5000));
  return cleanup;
}

function createVisualLayer(
  layer: VisualAlertLayer,
  alert: Extract<BusMessage, { kind: "alert:play" }>["alert"],
): HTMLElement | HTMLAudioElement | null {
  if (layer.type === "audio") {
    if (!layer.assetUrl) return null;
    const audio = new Audio(layer.assetUrl);
    audio.volume = clamp(Number(layer.volume ?? 1), 0, 1);
    audio.loop = Boolean(layer.loop);
    audio.play().catch(() => undefined);
    return audio;
  }

  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    left: `${Number(layer.x ?? 0)}px`,
    top: `${Number(layer.y ?? 0)}px`,
    width: `${Number(layer.width ?? 100)}px`,
    height: `${Number(layer.height ?? 100)}px`,
    opacity: String(clamp(Number(layer.opacity ?? 1), 0, 1)),
    transform: `rotate(${Number(layer.rotation ?? 0)}deg) scale(${Number(layer.scale ?? 1)})`,
    transformOrigin: "center",
    mixBlendMode: layer.blendMode ?? "normal",
    filter: cssLayerFilter(layer),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    overflow: "hidden",
    animation: cssAnimation(layer.animation),
    "--btv-intensity": String(layer.animation?.intensity ?? 1),
  });

  if (layer.type === "text") {
    el.textContent = renderAlertTemplate(String(layer.text ?? ""), alert);
    Object.assign(el.style, {
      color: layer.color ?? "#fff",
      fontFamily: layer.fontFamily ?? "Inter, Segoe UI, sans-serif",
      fontSize: `${Number(layer.fontSize ?? 48)}px`,
      fontWeight: String(layer.fontWeight ?? 800),
      textAlign: layer.align ?? "center",
      lineHeight: "1.05",
      whiteSpace: "pre-wrap",
      textShadow: layer.shadow ?? "",
      WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor ?? "#000"}` : "",
    });
    return el;
  }

  if (layer.type === "shape") {
    Object.assign(el.style, {
      background: layer.fill ?? "rgba(91, 140, 255, 0.8)",
      border: `${Number(layer.borderWidth ?? 0)}px solid ${layer.borderColor ?? "transparent"}`,
      borderRadius: layer.shape === "ellipse" ? "50%" : `${Number(layer.radius ?? 0)}px`,
    });
    return el;
  }

  if (layer.type === "image" || layer.type === "gif" || layer.type === "video") {
    if (!layer.assetUrl) return el;
    const media = layer.type === "video" ? document.createElement("video") : document.createElement("img");
    if (media instanceof HTMLVideoElement) {
      media.autoplay = true;
      media.loop = Boolean(layer.loop);
      media.muted = layer.muted !== false;
      media.playsInline = true;
    }
    media.setAttribute("src", layer.assetUrl);
    Object.assign(media.style, {
      width: "100%",
      height: "100%",
      objectFit: layer.fit ?? "contain",
    });
    el.appendChild(media);
    return el;
  }

  return el;
}

function cssLayerFilter(layer: VisualAlertLayer): string {
  const filter = layer.filter;
  if (!filter) return "";
  const parts = [
    `brightness(${Number(filter.brightness ?? 1)})`,
    `contrast(${Number(filter.contrast ?? 1)})`,
    `saturate(${Number(filter.saturation ?? 1)})`,
  ];
  if (filter.blur) parts.push(`blur(${Number(filter.blur)}px)`);
  if (filter.hueRotate) parts.push(`hue-rotate(${Number(filter.hueRotate)}deg)`);
  if (filter.glow) parts.push(`drop-shadow(0 0 ${Number(filter.glow)}px ${filter.glowColor ?? "rgba(91, 140, 255, 0.9)"})`);
  return parts.join(" ");
}

function renderAlertTemplate(
  template: string,
  alert: Extract<BusMessage, { kind: "alert:play" }>["alert"],
): string {
  return template
    .replaceAll("{user}", alert.event.user?.displayName ?? "Someone")
    .replaceAll("{login}", alert.event.user?.login ?? "viewer")
    .replaceAll("{event}", alert.event.type)
    .replaceAll("{amount}", String(alert.event.amount ?? ""));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function cssAnimation(animation: VisualAlertLayer["animation"]): string {
  if (!animation?.preset || animation.preset === "none") return "";
  return `${animation.preset} ${Number(animation.durationMs ?? 700)}ms ${cssEasing(animation.easing)} ${Number(animation.delayMs ?? 0)}ms ${animation.loop ? "infinite" : "both"}`;
}

function cssEasing(easing?: string): string {
  if (easing === "linear") return "linear";
  if (easing === "ease-in") return "ease-in";
  if (easing === "ease-in-out") return "ease-in-out";
  if (easing === "bounce") return "cubic-bezier(.2,1.6,.35,1)";
  if (easing === "elastic") return "cubic-bezier(.2,1.8,.35,1)";
  return "ease-out";
}

const VISUAL_ALERT_ANIMATION_CSS = `
@keyframes fade-in { from { opacity: 0; } }
@keyframes pop-in { from { opacity: 0; transform: scale(0.35); } 70% { transform: scale(calc(1 + (0.18 * var(--btv-intensity, 1)))); } }
@keyframes slide-in { from { opacity: 0; transform: translateX(calc(-140px * var(--btv-intensity, 1))); } }
@keyframes bounce-in { from { opacity: 0; transform: translateY(calc(-120px * var(--btv-intensity, 1))) scale(0.7); } 60% { transform: translateY(calc(24px * var(--btv-intensity, 1))) scale(1.08); } }
@keyframes elastic-in { from { opacity: 0; transform: scaleX(0.25) scaleY(1.4); } 60% { transform: scaleX(1.14) scaleY(0.88); } }
@keyframes spin-in { from { opacity: 0; transform: rotate(calc(-180deg * var(--btv-intensity, 1))) scale(0.4); } }
@keyframes screen-slam { from { opacity: 0; transform: scale(2.2); filter: blur(12px); } 70% { transform: scale(0.94); filter: blur(0); } }
@keyframes glitch-reveal { from { opacity: 0; clip-path: inset(0 100% 0 0); filter: hue-rotate(90deg); } 35% { clip-path: inset(0 0 70% 0); transform: translateX(calc(20px * var(--btv-intensity, 1))); } 55% { clip-path: inset(65% 0 0 0); transform: translateX(calc(-14px * var(--btv-intensity, 1))); } to { opacity: 1; clip-path: inset(0); filter: none; } }
@keyframes pulse { 50% { transform: scale(calc(1 + (0.08 * var(--btv-intensity, 1)))); } }
@keyframes float { 50% { transform: translateY(calc(-24px * var(--btv-intensity, 1))); } }
@keyframes wiggle { 25% { transform: rotate(calc(-3deg * var(--btv-intensity, 1))); } 75% { transform: rotate(calc(3deg * var(--btv-intensity, 1))); } }
@keyframes glow-pulse { 50% { filter: drop-shadow(0 0 calc(24px * var(--btv-intensity, 1)) rgba(91, 140, 255, 0.95)); } }
@keyframes fade-out { to { opacity: 0; } }
@keyframes glitch-out { to { opacity: 0; filter: hue-rotate(180deg) blur(6px); transform: translateX(calc(40px * var(--btv-intensity, 1))); } }
`;
