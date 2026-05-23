import {
  getRecentStreamSessions,
  getSessionEvents,
  getSessionSceneSpans,
  getStreamSessionSummary,
  startStreamSession,
  stopCurrentStreamSession,
} from "../db.js";
import type { RouteModule } from "./types.js";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export const registerSessionsRoutes: RouteModule = (app) => {
  app.get("/api/sessions/current", async () => getStreamSessionSummary());
  app.get("/api/sessions", async () => ({ sessions: getRecentStreamSessions() }));
  app.get("/api/sessions/:id", async (req) => {
    const { id } = req.params as { id: string };
    return {
      summary: getStreamSessionSummary(id),
      events: getSessionEvents(id),
      sceneSpans: getSessionSceneSpans(id),
    };
  });

  app.get("/api/sessions/:id/export.csv", async (req, reply) => {
    const { id } = req.params as { id: string };
    const summary = getStreamSessionSummary(id);
    const events = getSessionEvents(id);
    const sceneSpans = getSessionSceneSpans(id);
    const lines = [
      ["section", "field", "value", "extra", "started_at", "ended_at"].map(csvCell).join(","),
      ["session", "title", summary.session?.title ?? "", "", summary.session?.started_at ?? "", summary.session?.ended_at ?? ""].map(csvCell).join(","),
      ["session", "duration_ms", summary.durationMs, "", "", ""].map(csvCell).join(","),
      ["totals", "events", summary.totals.events, "", "", ""].map(csvCell).join(","),
      ["totals", "follows", summary.totals.follows, "", "", ""].map(csvCell).join(","),
      ["totals", "subs", summary.totals.subs, "", "", ""].map(csvCell).join(","),
      ["totals", "bits", summary.totals.cheers, "", "", ""].map(csvCell).join(","),
      ["totals", "raids", summary.totals.raids, "", "", ""].map(csvCell).join(","),
      ["totals", "channel_points", summary.totals.channelPoints, "", "", ""].map(csvCell).join(","),
      ["totals", "chat_messages", summary.totals.chatMessages, "", "", ""].map(csvCell).join(","),
      ...summary.eventsByType.map((row) => ["event_type", row.eventType, row.count, row.amount, "", ""].map(csvCell).join(",")),
      ...events.map((event) => ["event", event.event_type, event.user_display_name ?? event.user_login ?? "", event.amount ?? "", event.created_at, ""].map(csvCell).join(",")),
      ...sceneSpans.map((span) => ["scene", span.scene_name, "", "", span.started_at, span.ended_at ?? ""].map(csvCell).join(",")),
    ];
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="btv-session-${id}.csv"`)
      .send(lines.join("\n"));
  });

  app.post("/api/sessions/start", async (req) => {
    const body = req.body as { title?: string };
    const session = startStreamSession(body.title);
    return {
      ok: true,
      code: "SESSION_STARTED",
      title: "Session Started",
      message: session.title,
      color: "#00f593",
      icon: "play",
      session: getStreamSessionSummary(session.id),
    };
  });

  app.post("/api/sessions/stop", async () => {
    const session = stopCurrentStreamSession();
    return {
      ok: Boolean(session),
      code: session ? "SESSION_STOPPED" : "NO_ACTIVE_SESSION",
      title: session ? "Session Stopped" : "No Active Session",
      message: session ? session.title : "Start a session first",
      color: session ? "#00f593" : "#eb0400",
      icon: session ? "stop" : "alert-triangle",
      session: session ? getStreamSessionSummary(session.id) : getStreamSessionSummary(),
    };
  });
};
