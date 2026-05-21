import type { BusMessage } from "@btv/shared";
import type { WebSocket } from "@fastify/websocket";

export interface OverlayClientSnapshot {
  id: string;
  channels: string[];
}

export class OverlayBus {
  private clients = new Map<
    WebSocket,
    { id: string; channels: Set<string> }
  >();

  addClient(ws: WebSocket, channels: string[]): string {
    const id = crypto.randomUUID();
    const channelSet = new Set(channels.length ? channels : ["*"]);
    this.clients.set(ws, { id, channels: channelSet });

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    this.send(ws, { kind: "connected", clientId: id });
    return id;
  }

  broadcast(msg: BusMessage, channel = "*"): void {
    const payload = JSON.stringify(msg);
    for (const [ws, meta] of this.clients) {
      if (meta.channels.has("*") || meta.channels.has(channel)) {
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

  getSnapshot(): {
    clientCount: number;
    clients: OverlayClientSnapshot[];
    channels: Record<string, number>;
  } {
    const clients = Array.from(this.clients.values()).map((meta) => ({
      id: meta.id,
      channels: Array.from(meta.channels).sort(),
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
