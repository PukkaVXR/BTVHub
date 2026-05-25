import type { WidgetConfig } from "@btv/shared";
import { getWidgets, upsertWidget } from "../db.js";
import type { RouteModule } from "./types.js";

export const registerWidgetsRoutes: RouteModule = (app) => {
  app.get("/api/widgets", async () => getWidgets());
  app.get("/api/widgets/chat-config", async () => {
    const w = getWidgets().find((x) => x.type === "chat");
    const cfg = (w?.config ?? {}) as Record<string, unknown>;
    return { maxMessages: Number(cfg.maxMessages ?? 20), fadeMs: Number(cfg.fadeMs ?? 8000) };
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
