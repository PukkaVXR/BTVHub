import type { WidgetConfig } from "@btv/shared";
import { getSetting, getWidgets, upsertWidget } from "../db.js";
import { getAccessToken, getTwitchConfig } from "../twitch-service.js";
import type { RouteModule } from "./types.js";

interface TwitchBadgeVersion {
  id?: string;
  title?: string;
  image_url_1x?: string;
  image_url_2x?: string;
  image_url_4x?: string;
}

interface TwitchBadgeSet {
  set_id?: string;
  versions?: TwitchBadgeVersion[];
}

type ChatBadgeMap = Record<string, Record<string, { title: string; imageUrl: string }>>;

export const registerWidgetsRoutes: RouteModule = (app) => {
  app.get("/api/widgets", async () => getWidgets());
  app.get("/api/widgets/chat-config", async () => {
    const w = getWidgets().find((x) => x.type === "chat");
    const cfg = (w?.config ?? {}) as Record<string, unknown>;
    return {
      maxMessages: Number(cfg.maxMessages ?? 20),
      fadeMs: Number(cfg.fadeMs ?? 8000),
      showStats: cfg.showStats !== false,
    };
  });
  app.get("/api/widgets/chat-badges", async () => {
    const badges: ChatBadgeMap = {};
    const config = getTwitchConfig();
    const broadcasterId = getSetting("twitch_user_id");
    if (!config) return { badges, configured: false };

    try {
      const token = await getAccessToken();
      await mergeTwitchBadges(badges, "https://api.twitch.tv/helix/chat/badges/global", token, config.clientId);
      if (broadcasterId) {
        await mergeTwitchBadges(
          badges,
          `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
          token,
          config.clientId,
        );
      }
      return { badges, configured: true };
    } catch {
      return { badges, configured: Boolean(broadcasterId) };
    }
  });
  app.get("/api/widgets/ticker-config", async () => {
    const w = getWidgets().find((x) => x.type === "ticker");
    const cfg = (w?.config ?? {}) as Record<string, unknown>;
    return {
      maxEvents: Number(cfg.maxEvents ?? 15),
      title: typeof cfg.title === "string" ? cfg.title : "Recent Events",
      position: typeof cfg.position === "string" ? cfg.position : "top-left",
      width: Number(cfg.width ?? 360),
      compact: cfg.compact === true,
      showUser: cfg.showUser !== false,
      showAmount: cfg.showAmount === true,
      eventTypes: Array.isArray(cfg.eventTypes) ? cfg.eventTypes.filter((item) => typeof item === "string") : [],
    };
  });
  app.get("/api/widgets/event-list-config", async () => {
    const w = getWidgets().find((x) => x.type === "eventList");
    const cfg = (w?.config ?? {}) as Record<string, unknown>;
    return {
      maxEvents: Number(cfg.maxEvents ?? 8),
      showAmount: cfg.showAmount !== false,
      showMessage: cfg.showMessage !== false,
    };
  });
  app.put("/api/widgets/:id", async (req) => {
    upsertWidget(req.body as WidgetConfig);
    return { ok: true };
  });
};

async function mergeTwitchBadges(badges: ChatBadgeMap, url: string, token: string, clientId: string): Promise<void> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) return;
  const body = (await res.json()) as { data?: TwitchBadgeSet[] };
  for (const set of body.data ?? []) {
    if (!set.set_id) continue;
    badges[set.set_id] ??= {};
    for (const version of set.versions ?? []) {
      if (!version.id) continue;
      const imageUrl = version.image_url_2x ?? version.image_url_1x ?? version.image_url_4x;
      if (!imageUrl) continue;
      badges[set.set_id][version.id] = {
        title: version.title ?? set.set_id,
        imageUrl,
      };
    }
  }
}
