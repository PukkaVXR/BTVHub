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
    return { maxEvents: Number(cfg.maxEvents ?? 15) };
  });
  app.put("/api/widgets/:id", async (req) => {
    upsertWidget(req.body as WidgetConfig);
    return { ok: true };
  });
};
