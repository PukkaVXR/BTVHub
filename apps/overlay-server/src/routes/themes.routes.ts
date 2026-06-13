import { ThemeSchema } from "@btv/shared";
import { deleteTheme, getTheme, getThemes, upsertTheme } from "../db.js";
import type { RouteModule } from "./types.js";
import { parseBody } from "../schemas/request.schema.js";

export const registerThemesRoutes: RouteModule = (app) => {
  app.get("/api/themes", async () => getThemes());
  app.get("/api/themes/:id", async (req) => {
    const { id } = req.params as { id: string };
    return getTheme(id) ?? { error: "Not found" };
  });
  app.put("/api/themes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(reply, ThemeSchema, { ...(typeof req.body === "object" ? req.body : {}), id });
    if (!body) return;
    upsertTheme(body);
    return { ok: true };
  });
  app.delete("/api/themes/:id", async (req) => {
    const { id } = req.params as { id: string };
    if (id === "default") return { error: "Cannot delete default theme" };
    deleteTheme(id);
    return { ok: true };
  });
};
