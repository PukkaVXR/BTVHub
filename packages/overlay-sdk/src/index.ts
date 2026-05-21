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
    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.backoffMs = 1000;
      this.options.onStateChange?.("connected");
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
    this.ws?.close();
    this.ws = null;
  }
}

export function renderAlert(
  container: HTMLElement,
  alert: Extract<BusMessage, { kind: "alert:play" }>["alert"],
): () => void {
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
