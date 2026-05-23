import type { Theme } from "@btv/shared";
import { deleteTheme, getTheme, getThemes, upsertTheme } from "../db.js";
import type { RouteModule } from "./types.js";

export const registerThemesRoutes: RouteModule = (app) => {
  app.get("/api/themes", async () => getThemes());
  app.get("/api/themes/:id", async (req) => {
    const { id } = req.params as { id: string };
    return getTheme(id) ?? { error: "Not found" };
  });
  app.put("/api/themes/:id", async (req) => {
    const { id } = req.params as { id: string };
    upsertTheme({ ...(req.body as Theme), id });
    return { ok: true };
  });
  app.delete("/api/themes/:id", async (req) => {
    const { id } = req.params as { id: string };
    if (id === "default") return { error: "Cannot delete default theme" };
    deleteTheme(id);
    return { ok: true };
  });
};
