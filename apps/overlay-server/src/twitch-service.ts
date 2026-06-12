import {
  exchangeCode,
  getBroadcaster,
  refreshAccessToken,
  TwitchEventSubClient,
  validateToken,
  type TwitchOAuthConfig,
  type TwitchTokens,
} from "@btv/twitch";
import type { StreamEvent } from "@btv/shared";
import {
  deleteSetting,
  getEncryptedSetting,
  getSetting,
  setEncryptedSetting,
  setSetting,
} from "./db.js";
import { getTwitchRedirectUri } from "./oauth-urls.js";

let eventSubClient: TwitchEventSubClient | null = null;
let cachedTokens: TwitchTokens | null = null;

export function getTwitchConfig(): TwitchOAuthConfig | null {
  const clientId = getSetting("twitch_client_id");
  const clientSecret = getEncryptedSetting("twitch_client_secret");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: getTwitchRedirectUri(),
  };
}

export function isTwitchConfigured(): boolean {
  return Boolean(getTwitchConfig() && getEncryptedSetting("twitch_tokens"));
}

export async function getAccessToken(): Promise<string> {
  const config = getTwitchConfig();
  if (!config) throw new Error("Twitch not configured");

  const stored = getEncryptedSetting("twitch_tokens");
  if (!stored) throw new Error("Not authenticated");

  if (!cachedTokens) {
    cachedTokens = parseTwitchTokens(stored);
    if (!cachedTokens) {
      deleteSetting("twitch_tokens");
      throw new Error("Not authenticated");
    }
  }

  if (Date.now() < cachedTokens.expiresAt - 60_000) {
    return cachedTokens.accessToken;
  }

  cachedTokens = await refreshAccessToken(config, cachedTokens.refreshToken);
  setEncryptedSetting("twitch_tokens", JSON.stringify(cachedTokens));
  return cachedTokens.accessToken;
}

export async function handleTwitchCallback(code: string): Promise<void> {
  const config = getTwitchConfig();
  if (!config) throw new Error("Twitch not configured");

  cachedTokens = await exchangeCode(config, code);
  setEncryptedSetting("twitch_tokens", JSON.stringify(cachedTokens));

  const validated = await validateToken(cachedTokens.accessToken);
  setSetting("twitch_user_id", validated.userId);
  setSetting("twitch_login", validated.login);

  const user = await getBroadcaster(
    cachedTokens.accessToken,
    config.clientId,
    validated.userId,
  );
  setSetting("twitch_display_name", user.displayName);
}

export function startEventSub(onEvent: (e: StreamEvent) => void, onStatus?: (s: string) => void): void {
  const config = getTwitchConfig();
  const userId = getSetting("twitch_user_id");
  if (!config || !userId) return;

  eventSubClient?.stop();
  eventSubClient = new TwitchEventSubClient(
    config.clientId,
    getAccessToken,
    userId,
    onEvent,
    onStatus,
  );
  eventSubClient.start();
}

export function stopEventSub(): void {
  eventSubClient?.stop();
  eventSubClient = null;
}

export function getTwitchStatus() {
  const eventsubStatus = getSetting("twitch_eventsub_status");
  const scopes = getStoredTwitchScopes();
  const chatReadScope = scopes.includes("user:read:chat");
  const chatWriteScope = scopes.includes("user:write:chat");
  const chatSubscriptionFailed = eventsubStatus?.includes("sub_error:channel.chat") ?? false;
  const connected = Boolean(getEncryptedSetting("twitch_tokens"));
  const chatConnected = connected && eventsubStatus === "connected" && chatReadScope && !chatSubscriptionFailed;
  const chatStatus = !connected
    ? "offline"
    : chatSubscriptionFailed || !chatReadScope
      ? "error"
      : eventsubStatus === "connected"
        ? "connected"
        : "pending";
  return {
    configured: Boolean(getTwitchConfig()),
    connected,
    hasClientSecret: Boolean(getEncryptedSetting("twitch_client_secret")),
    login: getSetting("twitch_login"),
    displayName: getSetting("twitch_display_name"),
    userId: getSetting("twitch_user_id"),
    eventsubStatus,
    scopes,
    chatSubscribed: chatConnected,
    chat: {
      status: chatStatus,
      connected: chatConnected,
      canRead: chatReadScope,
      canWrite: chatWriteScope,
      detail: chatStatus === "connected"
        ? "Listening for Twitch chat messages"
        : chatStatus === "error"
          ? chatSubscriptionFailed
            ? eventsubStatus
            : "Reconnect Twitch to grant user:read:chat"
          : connected
            ? eventsubStatus ?? "Waiting for EventSub chat subscription"
            : "Connect Twitch to enable chat",
    },
  };
}

function getStoredTwitchScopes(): string[] {
  const stored = getEncryptedSetting("twitch_tokens");
  if (!stored) return [];
  const parsed = parseTwitchTokens(stored);
  return Array.isArray(parsed?.scope) ? parsed.scope.filter((scope): scope is string => typeof scope === "string") : [];
}

function parseTwitchTokens(raw: string): TwitchTokens | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TwitchTokens>;
    if (
      typeof parsed.accessToken === "string"
      && typeof parsed.refreshToken === "string"
      && Number.isFinite(parsed.expiresAt)
    ) {
      return {
        ...parsed,
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAt: Number(parsed.expiresAt),
      } as TwitchTokens;
    }
  } catch {
    // Corrupt token storage should disconnect Twitch, not crash status/API routes.
  }
  return null;
}

export async function sendTwitchChatMessage(message: string): Promise<boolean> {
  const config = getTwitchConfig();
  const broadcasterId = getSetting("twitch_user_id");
  if (!config || !broadcasterId) throw new Error("Twitch not configured");
  const token = await getAccessToken();
  const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": config.clientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: broadcasterId,
      message: message.slice(0, 500),
    }),
  });
  if (!res.ok) throw new Error(`Twitch chat failed: ${res.status}`);
  const body = (await res.json()) as { data?: Array<{ is_sent?: boolean }> };
  return Boolean(body.data?.[0]?.is_sent);
}

export function disconnectTwitch(): void {
  stopEventSub();
  cachedTokens = null;
  deleteSetting("twitch_tokens");
  deleteSetting("twitch_user_id");
  deleteSetting("twitch_login");
  deleteSetting("twitch_display_name");
}
