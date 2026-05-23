import { getGoal, getGoals, updateGoal } from "../db.js";
import type { RouteModule } from "./types.js";

export const registerGoalsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/goals", async () => getGoals());
  app.put("/api/goals/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { current?: number; target?: number; label?: string };
    const g = getGoal(id);
    if (!g) return { error: "Not found" };
    updateGoal(id, body.current ?? g.current_count, body.target ?? g.target_count, body.label);
    const updated = getGoal(id)!;
    ctx.bus.broadcast({
      kind: "goal:update",
      goal: {
        id: updated.id,
        label: body.label ?? updated.label,
        current: updated.current_count,
        target: updated.target_count,
        type: updated.type as "follow" | "sub",
      },
    }, "goal");
    return { ok: true };
  });
};
