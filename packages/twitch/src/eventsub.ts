import WebSocket from "ws";
import {
  createStreamEvent,
  type StreamEvent,
  type StreamEventType,
} from "@btv/shared";

export type EventSubHandler = (event: StreamEvent) => void;

const EVENTSUB_WS = "wss://eventsub.wss.twitch.tv/ws";

const SUBSCRIPTION_TYPES = [
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.gift",
  "channel.cheer",
  "channel.raid",
  "channel.channel_points_custom_reward_redemption.add",
  "channel.chat.message",
] as const;

export class TwitchEventSubClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly clientId: string,
    private readonly getAccessToken: () => Promise<string>,
    private readonly broadcasterId: string,
    private readonly onEvent: EventSubHandler,
    private readonly onStatus?: (status: string) => void,
  ) {}

  start(): void {
    if (this.disposed) return;
    this.onStatus?.("connecting");
    this.ws = new WebSocket(EVENTSUB_WS);

    this.ws.on("message", (raw) => {
      void this.handleMessage(String(raw));
    });

    this.ws.on("close", () => {
      this.onStatus?.("disconnected");
      this.scheduleReconnect();
    });

    this.ws.on("error", () => {
      this.ws?.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.start(), 5000);
  }

  private async handleMessage(raw: string): Promise<void> {
    const msg = JSON.parse(raw) as {
      metadata: { message_type: string; message_id: string };
      payload: {
        session?: { id: string; status: string };
        subscription?: { type: string; status: string };
        event?: Record<string, unknown>;
      };
    };

    const type = msg.metadata.message_type;

    if (type === "session_welcome") {
      this.sessionId = msg.payload.session?.id ?? null;
      this.onStatus?.("connected");
      await this.subscribeAll();
      return;
    }

    if (type === "session_keepalive") return;

    if (type === "session_reconnect") {
      this.ws?.close();
      return;
    }

    if (type === "notification" && msg.payload.subscription && msg.payload.event) {
      const normalized = normalizeEventSub(
        msg.payload.subscription.type,
        msg.payload.event,
      );
      if (normalized) this.onEvent(normalized);
    }
  }

  private async subscribeAll(): Promise<void> {
    if (!this.sessionId) return;
    const token = await this.getAccessToken();

    for (const subType of SUBSCRIPTION_TYPES) {
      const condition = getCondition(subType, this.broadcasterId);
      if (!condition) continue;

      const body = {
        type: subType,
        version: getVersion(subType),
        condition,
        transport: {
          method: "websocket",
          session_id: this.sessionId,
        },
      };

      const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": this.clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        this.onStatus?.(`sub_error:${subType}:${err.slice(0, 80)}`);
      }
    }
  }

  stop(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

function getVersion(type: string): string {
  if (type === "channel.follow") return "2";
  if (type === "channel.chat.message") return "1";
  return "1";
}

function getCondition(
  type: string,
  broadcasterId: string,
): Record<string, string> | null {
  switch (type) {
    case "channel.follow":
      return { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId };
    case "channel.subscribe":
    case "channel.subscription.gift":
    case "channel.cheer":
    case "channel.channel_points_custom_reward_redemption.add":
      return { broadcaster_user_id: broadcasterId };
    case "channel.raid":
      return { to_broadcaster_user_id: broadcasterId };
    case "channel.chat.message":
      return { broadcaster_user_id: broadcasterId, user_id: broadcasterId };
    default:
      return null;
  }
}

function normalizeEventSub(
  subscriptionType: string,
  event: Record<string, unknown>,
): StreamEvent | null {
  const userFrom = (prefix: string) => {
    const id = String(event[`${prefix}_user_id`] ?? event["user_id"] ?? "");
    const name = String(
      event[`${prefix}_user_name`] ??
        event[`${prefix}_name`] ??
        event["user_name"] ??
        "Anonymous",
    );
    const login = String(event[`${prefix}_user_login`] ?? event["user_login"] ?? name);
    return { id, displayName: name, login };
  };

  let type: StreamEventType = "unknown";
  let user = userFrom("user");
  let amount: number | undefined;
  let message: string | undefined;
  let tier: string | undefined;

  switch (subscriptionType) {
    case "channel.follow":
      type = "follow";
      user = userFrom("user");
      break;
    case "channel.subscribe":
      type = event.is_gift ? "gift_sub" : "sub";
      user = userFrom("user");
      tier = String(event.tier ?? "");
      break;
    case "channel.subscription.gift":
      type = "gift_sub";
      user = userFrom("user");
      amount = Number(event.total ?? 1);
      break;
    case "channel.cheer":
      type = "cheer";
      user = userFrom("user");
      amount = Number(event.bits ?? 0);
      message = String(event.message ?? "");
      break;
    case "channel.raid":
      type = "raid";
      user = userFrom("from_broadcaster");
      amount = Number(event.viewers ?? 0);
      break;
    case "channel.channel_points_custom_reward_redemption.add":
      type = "channel_points";
      user = userFrom("user");
      message = String(
        (event.reward as { title?: string })?.title ?? "Channel Points",
      );
      break;
    case "channel.chat.message": {
      type = "chat";
      const chatter = event.chatter_user_id
        ? {
            id: String(event.chatter_user_id),
            displayName: String(event.chatter_user_name ?? "User"),
            login: String(event.chatter_user_login ?? ""),
          }
        : user;
      user = chatter;
      const chatMessage = event.message as { text?: string } | undefined;
      message = String(chatMessage?.text ?? "");
      break;
    }
    default:
      return null;
  }

  return createStreamEvent({
    source: "twitch",
    type,
    user,
    message,
    amount,
    tier,
    payload: event,
  });
}
