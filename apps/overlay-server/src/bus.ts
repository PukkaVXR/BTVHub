import type { BusMessage } from "@btv/shared";
import type { WebSocket } from "@fastify/websocket";
import { logSystem } from "./db.js";

export interface OverlayClientSnapshot {
  id: string;
  channels: string[];
  route?: string;
  connectedAt: string;
  lastHeartbeatAt: string;
  status: "connected" | "stale";
}

interface OverlayClientMeta {
  id: string;
  channels: Set<string>;
  route?: string;
  connectedAt: string;
  lastHeartbeatAt: string;
}

const STALE_AFTER_MS = 45_000;

export class OverlayBus {
  private clients = new Map<WebSocket, OverlayClientMeta>();

  addClient(ws: WebSocket, channels: string[], route?: string): string {
    const id = crypto.randomUUID();
    const channelSet = new Set(channels.length ? channels : ["*"]);
    const now = new Date().toISOString();
    this.clients.set(ws, {
      id,
      channels: channelSet,
      route,
      connectedAt: now,
      lastHeartbeatAt: now,
    });
    logSystem("overlay", "info", "Overlay browser source connected", {
      clientId: id,
      route,
      channels: Array.from(channelSet),
    });

    ws.on("message", (raw) => {
      const meta = this.clients.get(ws);
      if (!meta) return;
      try {
        const msg = JSON.parse(String(raw)) as { kind?: string; route?: string };
        if (msg.kind === "overlay:heartbeat") {
          meta.lastHeartbeatAt = new Date().toISOString();
          if (msg.route) meta.route = msg.route;
        }
      } catch {
        // Ignore malformed client messages.
      }
    });

    ws.on("close", () => {
      logSystem("overlay", "warn", "Overlay browser source disconnected", {
        clientId: id,
        route: this.clients.get(ws)?.route,
      });
      this.clients.delete(ws);
    });

    this.send(ws, { kind: "connected", clientId: id });
    return id;
  }

  broadcast(msg: BusMessage, channel = "*"): void {
    const payload = JSON.stringify(msg);
    for (const [ws, meta] of this.clients) {
      if (channel === "*" || meta.channels.has("*") || meta.channels.has(channel)) {
        if (ws.readyState === 1) {
          try {
            ws.send(payload);
          } catch {
            this.clients.delete(ws);
          }
        } else {
          this.clients.delete(ws);
        }
      }
    }
  }

  send(ws: WebSocket, msg: BusMessage): void {
    if (ws.readyState !== 1) {
      this.clients.delete(ws);
      return;
    }
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.clients.delete(ws);
    }
  }

  pingAll(): void {
    this.broadcast({ kind: "ping", at: new Date().toISOString() });
  }

  closeAll(code = 1001, reason = "Server shutting down"): void {
    for (const [ws] of this.clients) {
      try {
        ws.close(code, reason);
      } catch {
        // Ignore sockets that are already closing.
      }
      this.clients.delete(ws);
    }
  }

  getSnapshot(): {
    clientCount: number;
    clients: OverlayClientSnapshot[];
    channels: Record<string, number>;
  } {
    const now = Date.now();
    const clients = Array.from(this.clients.values()).map((meta) => ({
      id: meta.id,
      channels: Array.from(meta.channels).sort(),
      route: meta.route,
      connectedAt: meta.connectedAt,
      lastHeartbeatAt: meta.lastHeartbeatAt,
      status: now - new Date(meta.lastHeartbeatAt).getTime() > STALE_AFTER_MS ? "stale" as const : "connected" as const,
    }));
    const channels: Record<string, number> = {};
    for (const client of clients) {
      for (const channel of client.channels) {
        channels[channel] = (channels[channel] ?? 0) + 1;
      }
    }
    return {
      clientCount: clients.length,
      clients,
      channels,
    };
  }
}
