import { getMiniGameRuns } from "../db.js";
import type { RouteModule } from "./types.js";

export const registerMiniGamesRoutes: RouteModule = (app) => {
  app.get("/api/mini-games/runs", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));
    return { runs: getMiniGameRuns(limit) };
  });
};
