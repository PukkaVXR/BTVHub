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
