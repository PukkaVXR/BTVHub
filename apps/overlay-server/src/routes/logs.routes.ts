import { getSystemLogs } from "../db.js";
import type { RouteModule } from "./types.js";

export const registerLogsRoutes: RouteModule = (app) => {
  app.get("/api/logs", async (req) => {
    const query = req.query as { limit?: string };
    return getSystemLogs(Math.max(1, Math.min(500, Number(query.limit ?? 100))));
  });
};
