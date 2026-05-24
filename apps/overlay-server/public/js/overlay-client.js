export class OverlayClient {
  constructor(options = {}) {
    this.options = options;
    this.backoffMs = 1000;
    this.disposed = false;
    this.heartbeatTimer = null;
  }

  connect() {
    if (this.disposed) return;
    this.options.onStateChange?.("connecting");
    const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(`${wsProto}//${location.host}/ws`);
    if (this.options.channels?.length) {
      url.searchParams.set("channels", this.options.channels.join(","));
    }
    url.searchParams.set("route", location.pathname);
    this.ws = new WebSocket(url.toString());
    this.ws.onopen = () => {
      this.backoffMs = 1000;
      this.options.onStateChange?.("connected");
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 15000);
    };
    this.ws.onmessage = (ev) => {
      try {
        this.options.onMessage?.(JSON.parse(ev.data));
      } catch { /* ignore */ }
    };
    this.ws.onclose = () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.options.onStateChange?.("disconnected");
      setTimeout(() => {
        this.backoffMs = Math.min(this.backoffMs * 2, 30000);
        this.connect();
      }, this.backoffMs);
    };
    this.ws.onerror = () => this.ws?.close();
  }

  sendHeartbeat() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      kind: "overlay:heartbeat",
      route: location.pathname,
      at: new Date().toISOString(),
    }));
  }
}

let activeMediaCleanup = null;
let activeSoundCleanup = null;
const activeAudios = new Set();

const DEFAULT_LOOP_CAP_MS = 60_000;

function layoutSlotStyle(placement) {
  const p = placement ?? { anchor: "top-center", offsetX: 0, offsetY: 80, width: 420 };
  const { anchor, offsetX, offsetY, width } = p;
  const base = {
    position: "fixed",
    width: `${width}px`,
    maxWidth: "calc(100vw - 48px)",
    pointerEvents: "none",
    zIndex: "500",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  switch (anchor) {
    case "top-left":
      return { ...base, top: `${offsetY}px`, left: `${24 + offsetX}px` };
    case "top-center":
      return {
        ...base,
        top: `${offsetY}px`,
        left: "50%",
        marginLeft: `${offsetX}px`,
        transform: "translateX(-50%)",
      };
    case "top-right":
      return { ...base, top: `${offsetY}px`, right: `${24 - offsetX}px` };
    case "center":
      return {
        ...base,
        top: "50%",
        left: "50%",
        marginLeft: `${offsetX}px`,
        marginTop: `${offsetY}px`,
        transform: "translate(-50%, -50%)",
      };
    case "bottom-left":
      return { ...base, bottom: `${offsetY}px`, left: `${24 + offsetX}px` };
    case "bottom-center":
      return {
        ...base,
        bottom: `${offsetY}px`,
        left: "50%",
        marginLeft: `${offsetX}px`,
        transform: "translateX(-50%)",
      };
    case "bottom-right":
      return { ...base, bottom: `${offsetY}px`, right: `${24 - offsetX}px` };
    default:
      return layoutSlotStyle({ anchor: "top-center", offsetX: 0, offsetY: 80, width: 420 });
  }
}

function resolveMediaUrl(config) {
  if (config.mediaUrl) return String(config.mediaUrl);
  const asset = String(config.mediaAsset ?? "").replace(/^\//, "");
  if (!asset) return "";
  if (asset.startsWith("http") || asset.startsWith("/")) return asset.startsWith("/") ? asset : `/${asset}`;
  return `/assets/${asset}`;
}

function inferKindFromUrl(url, config) {
  if (config.mediaKind) return config.mediaKind;
  const lower = url.toLowerCase();
  if (lower.endsWith(".gif")) return "gif";
  if (/\.(mp4|webm|mov)(\?|$)/.test(lower)) return "video";
  return "image";
}

export function clearMediaEffect() {
  activeMediaCleanup?.();
  activeMediaCleanup = null;
}

export function playMediaEffect(container, config) {
  clearMediaEffect();

  const url = resolveMediaUrl(config);
  if (!url) return () => {};

  const loop = Boolean(config.loop);
  let durationMs = Number(config.durationMs ?? 0);
  if (loop && durationMs <= 0) durationMs = DEFAULT_LOOP_CAP_MS;

  const slot = document.createElement("div");
  slot.className = "btv-media-slot";
  if (config.fullscreen) {
    slot.classList.add("btv-media-slot--fullscreen");
    Object.assign(slot.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: "500",
    });
  } else {
    Object.assign(slot.style, layoutSlotStyle(config.placement));
  }

  const kind = inferKindFromUrl(url, config);
  let mediaEl;

  if (kind === "video") {
    mediaEl = document.createElement("video");
    mediaEl.src = url;
    mediaEl.autoplay = true;
    mediaEl.playsInline = true;
    mediaEl.loop = loop;
    mediaEl.muted = Boolean(config.mute);
    mediaEl.volume = Math.min(1, Math.max(0, Number(config.volume ?? 1)));
    mediaEl.className = "btv-media-video";
  } else {
    mediaEl = document.createElement("img");
    mediaEl.src = url;
    mediaEl.alt = "";
    mediaEl.className = kind === "gif" ? "btv-media-gif" : "btv-media-image";
  }

  slot.appendChild(mediaEl);
  container.appendChild(slot);

  const timers = [];

  const cleanup = () => {
    for (const t of timers) clearTimeout(t);
    slot.remove();
    if (activeMediaCleanup === cleanup) activeMediaCleanup = null;
  };

  if (durationMs > 0) {
    timers.push(setTimeout(cleanup, durationMs));
  } else if (kind === "video" && !loop) {
    mediaEl.addEventListener("ended", cleanup, { once: true });
  }

  activeMediaCleanup = cleanup;
  return cleanup;
}

export function playSoundEffect(config) {
  activeSoundCleanup?.();
  activeSoundCleanup = null;

  const url = config.soundUrl || (config.soundAsset ? `/assets/${String(config.soundAsset).replace(/^\//, "")}` : "");
  if (!url) return () => {};

  const audio = new Audio(url);
  activeAudios.add(audio);
  audio.loop = Boolean(config.loop);
  void audio.play().catch(() => {});

  const timers = [];
  let durationMs = Number(config.durationMs ?? 0);
  if (audio.loop && durationMs <= 0) durationMs = DEFAULT_LOOP_CAP_MS;

  const cleanup = () => {
    for (const t of timers) clearTimeout(t);
    audio.pause();
    audio.currentTime = 0;
    activeAudios.delete(audio);
    activeSoundCleanup = null;
  };

  if (durationMs > 0) {
    timers.push(setTimeout(cleanup, durationMs));
  } else if (!audio.loop) {
    audio.addEventListener("ended", cleanup, { once: true });
  }

  activeSoundCleanup = cleanup;
  return cleanup;
}

export function stopAllSounds() {
  activeSoundCleanup?.();
  activeSoundCleanup = null;
  for (const audio of activeAudios) {
    audio.pause();
    audio.currentTime = 0;
  }
  activeAudios.clear();
}

export function playVisualEffect(layer, config) {
  const style = config.style || "flash";
  layer.className = `effect-active effect-${style}`;
  setTimeout(() => {
    layer.className = "";
  }, Number(config.durationMs ?? 800));
}

export function renderAlert(container, alert) {
  if (alert.visualProject && typeof alert.visualProject === "object") {
    try {
      return renderVisualAlert(container, alert, alert.visualProject);
    } catch (error) {
      console.error("Visual alert render error:", error);
      return renderAlertFallback(container, alert);
    }
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

  if (alert.js) {
    try {
      const fn = new Function(
        "event", "root", "onHide",
        `${alert.js}\nif (typeof onShow === 'function') onShow(event, root, onHide);`,
      );
      const onHide = () => removeAll();
      fn(alert.event, root, onHide);
    } catch (e) { console.error(e); }
  } else {
    const title = root.querySelector(".alert-title");
    if (title) title.textContent = `${alert.event.user?.displayName ?? "Someone"}`;
  }

  if (alert.soundUrl) {
    const audio = new Audio(alert.soundUrl);
    activeAudios.add(audio);
    audio.addEventListener("ended", () => activeAudios.delete(audio), { once: true });
    audio.play().catch(() => activeAudios.delete(audio));
  }

  const t = setTimeout(() => removeAll(), alert.durationMs ?? 5000);
  return () => { clearTimeout(t); removeAll(); };
}

function renderAlertFallback(container, alert) {
  const slot = document.createElement("div");
  slot.className = "btv-alert-slot btv-visual-alert-slot";
  const fallback = document.createElement("div");
  Object.assign(fallback.style, {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    padding: "28px 36px",
    borderRadius: "18px",
    background: "rgba(16, 22, 32, 0.92)",
    border: "2px solid rgba(255, 91, 110, 0.82)",
    color: "#fff",
    font: "800 42px Inter, Segoe UI, sans-serif",
    textAlign: "center",
  });
  fallback.textContent = `${alert.event.user?.displayName ?? "Someone"} - ${alert.event.type}`;
  slot.appendChild(fallback);
  container.appendChild(slot);
  const t = setTimeout(() => slot.remove(), alert.durationMs ?? 5000);
  return () => { clearTimeout(t); slot.remove(); };
}

function renderVisualAlert(container, alert, project) {
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
  style.textContent = `${VISUAL_ALERT_ANIMATION_CSS}\n${visualKeyframeCss(project)}`;
  slot.appendChild(style);
  container.appendChild(slot);

  const timers = [];
  const audios = [];

  for (const layer of project.layers ?? []) {
    if (layer.visible === false) continue;
    const el = createVisualLayer(layer, alert, Boolean(project.safeMode));
    if (!el) continue;
    root.appendChild(el);
    const startMs = Math.max(0, Number(layer.startMs ?? 0));
    const endMs = Math.max(startMs, Number(layer.endMs ?? project.durationMs ?? alert.durationMs));
    if (el instanceof HTMLAudioElement) {
      audios.push(el);
      const playAudio = () => playVisualAudio(el, layer, endMs - startMs, timers);
      if (startMs > 0) timers.push(setTimeout(playAudio, startMs));
      else playAudio();
      timers.push(setTimeout(() => {
        el.pause();
        el.currentTime = 0;
        activeAudios.delete(el);
        el.remove();
      }, endMs));
    } else {
      el.style.display = startMs > 0 ? "none" : "";
      if (startMs > 0) timers.push(setTimeout(() => (el.style.display = ""), startMs));
      timers.push(setTimeout(() => el.remove(), endMs));
    }
  }

  if (alert.soundUrl) {
    const audio = new Audio(alert.soundUrl);
    audios.push(audio);
    activeAudios.add(audio);
    audio.addEventListener("ended", () => activeAudios.delete(audio), { once: true });
    audio.play().catch(() => activeAudios.delete(audio));
  }

  const cleanup = () => {
    for (const timer of timers) clearTimeout(timer);
    for (const audio of audios) {
      audio.pause();
      audio.currentTime = 0;
      activeAudios.delete(audio);
    }
    slot.remove();
  };
  timers.push(setTimeout(cleanup, alert.durationMs ?? project.durationMs ?? 5000));
  return cleanup;
}

function createVisualLayer(layer, alert, safeMode = false) {
  if (layer.type === "audio") {
    if (!layer.assetUrl || layer.muted) return null;
    const audio = new Audio(layer.assetUrl);
    audio.loop = Boolean(layer.loop);
    activeAudios.add(audio);
    audio.addEventListener("ended", () => activeAudios.delete(audio), { once: true });
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
    animation: layer.keyframes?.length ? cssKeyframeAnimation(layer, alert) : cssAnimation(layer.animation),
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
    media.src = layer.assetUrl;
    Object.assign(media.style, {
      width: "100%",
      height: "100%",
      objectFit: layer.fit ?? "contain",
    });
    el.appendChild(media);
    return el;
  }

  if (layer.type === "particle") {
    Object.assign(el.style, {
      border: `2px dashed ${layer.color ?? "#5b8cff"}`,
      borderRadius: "12px",
      color: layer.color ?? "#5b8cff",
      font: "800 32px Inter, Segoe UI, sans-serif",
    });
    el.textContent = `${layer.particle ?? "confetti"} particles`;
    return el;
  }

  if (layer.type === "browser") {
    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-same-origin");
    if (!safeMode && layer.sandbox === false) iframe.sandbox.add("allow-scripts");
    iframe.srcdoc = `<style>${layer.css ?? ""}</style>${layer.html ?? ""}${!safeMode && layer.sandbox === false && layer.js ? `<script>${layer.js}<\/script>` : ""}`;
    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "0",
      background: "transparent",
    });
    el.appendChild(iframe);
    return el;
  }

  return el;
}

function playVisualAudio(audio, layer, durationMs, timers) {
  const targetVolume = clamp(Number(layer.volume ?? 1), 0, 1);
  const startOffsetMs = Math.max(0, Number(layer.startOffsetMs ?? 0));
  const fadeInMs = Math.max(0, Number(layer.fadeInMs ?? 0));
  const fadeOutMs = Math.max(0, Number(layer.fadeOutMs ?? 0));
  audio.currentTime = startOffsetMs / 1000;
  if (fadeInMs > 0) {
    audio.volume = 0;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / fadeInMs);
      audio.volume = targetVolume * progress;
      if (progress >= 1) clearInterval(timer);
    }, 33);
    timers.push(timer);
  } else {
    audio.volume = targetVolume;
  }
  if (fadeOutMs > 0 && durationMs > fadeOutMs) {
    timers.push(setTimeout(() => {
      const startedAt = Date.now();
      const startVolume = audio.volume;
      const timer = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / fadeOutMs);
        audio.volume = Math.max(0, startVolume * (1 - progress));
        if (progress >= 1) clearInterval(timer);
      }, 33);
      timers.push(timer);
    }, durationMs - fadeOutMs));
  }
  audio.play().catch(() => activeAudios.delete(audio));
}

function cssLayerFilter(layer) {
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

function renderAlertTemplate(template, alert) {
  return template
    .replaceAll("{user}", alert.event.user?.displayName ?? "Someone")
    .replaceAll("{login}", alert.event.user?.login ?? "viewer")
    .replaceAll("{event}", alert.event.type)
    .replaceAll("{amount}", String(alert.event.amount ?? ""))
    .replaceAll("{message}", alert.event.message ?? "")
    .replace(/\{var:([^}]+)\}/g, (_, key) => payloadTemplatePath(alert.event.payload.variables, key.trim()))
    .replace(/\{payload\.([^}]+)\}/g, (_, path) => payloadTemplatePath(alert.event.payload, path));
}

function payloadTemplatePath(payload, path) {
  let value = payload;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object") return "";
    value = value[key];
  }
  return value == null ? "" : String(value);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function cssAnimation(animation) {
  if (!animation?.preset || animation.preset === "none") return "";
  return `${animation.preset} ${Number(animation.durationMs ?? 700)}ms ${cssEasing(animation.easing)} ${Number(animation.delayMs ?? 0)}ms ${animation.loop ? "infinite" : "both"}`;
}

function cssKeyframeAnimation(layer, alert) {
  const duration = Number(alert.durationMs ?? 5000);
  return `btv-kf-${cssSafeId(layer.id)} ${duration}ms linear 0ms both`;
}

function visualKeyframeCss(project) {
  const duration = Math.max(1, Number(project.durationMs ?? 5000));
  return (project.layers ?? [])
    .filter((layer) => layer.keyframes?.length)
    .map((layer) => {
      const frames = [...(layer.keyframes ?? [])].sort((a, b) => Number(a.atMs ?? 0) - Number(b.atMs ?? 0));
      const stops = frames.map((frame) => {
        const pct = Math.max(0, Math.min(100, (Number(frame.atMs ?? 0) / duration) * 100));
        const props = frame.properties ?? {};
        const x = numericProp(props.x, layer.x ?? 0);
        const y = numericProp(props.y, layer.y ?? 0);
        const opacity = numericProp(props.opacity, layer.opacity ?? 1);
        const scale = numericProp(props.scale, layer.scale ?? 1);
        const rotation = numericProp(props.rotation, layer.rotation ?? 0);
        return `${pct}% { left: ${x}px; top: ${y}px; opacity: ${opacity}; transform: rotate(${rotation}deg) scale(${scale}); }`;
      });
      return `@keyframes btv-kf-${cssSafeId(layer.id)} { ${stops.join(" ")} }`;
    })
    .join("\n");
}

function numericProp(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cssSafeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function cssEasing(easing) {
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
@keyframes rgb-split { 0%, 100% { filter: drop-shadow(0 0 0 transparent); transform: translateX(0); } 35% { filter: drop-shadow(calc(-6px * var(--btv-intensity, 1)) 0 0 rgba(255,55,90,.8)) drop-shadow(calc(6px * var(--btv-intensity, 1)) 0 0 rgba(62,230,255,.8)); transform: translateX(calc(2px * var(--btv-intensity, 1))); } 65% { filter: drop-shadow(calc(5px * var(--btv-intensity, 1)) 0 0 rgba(255,55,90,.8)) drop-shadow(calc(-5px * var(--btv-intensity, 1)) 0 0 rgba(62,230,255,.8)); transform: translateX(calc(-2px * var(--btv-intensity, 1))); } }
@keyframes vhs-jitter { 0%, 100% { transform: translate(0,0); filter: contrast(1); } 20% { transform: translate(calc(-5px * var(--btv-intensity, 1)), calc(2px * var(--btv-intensity, 1))); filter: contrast(1.25) saturate(1.25); } 40% { transform: translate(calc(4px * var(--btv-intensity, 1)), calc(-2px * var(--btv-intensity, 1))); } 60% { transform: translate(calc(-2px * var(--btv-intensity, 1)), calc(3px * var(--btv-intensity, 1))); } }
@keyframes bass-shake { 0%, 100% { transform: scale(1) translateX(0); } 18% { transform: scale(calc(1 + (0.08 * var(--btv-intensity, 1)))) translateX(calc(-8px * var(--btv-intensity, 1))); } 36% { transform: scale(1) translateX(calc(8px * var(--btv-intensity, 1))); } }
@keyframes fade-out { to { opacity: 0; } }
@keyframes pop-out { to { opacity: 0; transform: scale(0.35); } }
@keyframes slide-out { to { opacity: 0; transform: translateX(calc(160px * var(--btv-intensity, 1))); } }
@keyframes glitch-out { to { opacity: 0; filter: hue-rotate(180deg) blur(6px); transform: translateX(calc(40px * var(--btv-intensity, 1))); } }
@keyframes explode-out { to { opacity: 0; filter: blur(calc(10px * var(--btv-intensity, 1))); transform: scale(calc(1 + (1.4 * var(--btv-intensity, 1)))) rotate(calc(18deg * var(--btv-intensity, 1))); } }
`;
