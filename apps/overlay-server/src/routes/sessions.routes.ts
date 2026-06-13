import {
  getRecentStreamSessions,
  getSessionEvents,
  getSessionSceneSpans,
  getStreamSessionSummary,
  startStreamSession,
  stopCurrentStreamSession,
} from "../db.js";
import type { RouteModule } from "./types.js";
import { parseBody, SessionStartBodySchema } from "../schemas/request.schema.js";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    follow: "Follows",
    sub: "Subs",
    resub: "Resubs",
    gift_sub: "Gift subs",
    cheer: "Bits",
    raid: "Raids",
    channel_points: "Channel points",
    chat: "Chat messages",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function buildRecap(id: string) {
  const summary = getStreamSessionSummary(id);
  const events = getSessionEvents(id);
  const sceneSpans = getSessionSceneSpans(id);
  const session = summary.session;
  const topEvents = summary.eventsByType.slice(0, 6);
  const topScenes = [...summary.sceneSpans].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
  const topSupporters = events
    .filter((event) => event.user_display_name || event.user_login)
    .reduce((acc, event) => {
      const key = event.user_display_name ?? event.user_login ?? "Unknown";
      const current = acc.get(key) ?? { name: key, events: 0, amount: 0 };
      current.events += 1;
      current.amount += Number(event.amount ?? 0);
      acc.set(key, current);
      return acc;
    }, new Map<string, { name: string; events: number; amount: number }>());
  const supporters = [...topSupporters.values()]
    .sort((a, b) => b.amount - a.amount || b.events - a.events || a.name.localeCompare(b.name))
    .slice(0, 5);
  const highlights = [
    `${summary.totals.events} tracked event${summary.totals.events === 1 ? "" : "s"}`,
    `${summary.totals.follows} follow${summary.totals.follows === 1 ? "" : "s"}`,
    `${summary.totals.subs} sub event${summary.totals.subs === 1 ? "" : "s"}`,
    `${summary.totals.cheers} bit${summary.totals.cheers === 1 ? "" : "s"}`,
    `${summary.totals.raids} raid${summary.totals.raids === 1 ? "" : "s"}`,
    `${summary.totals.chatMessages} chat message${summary.totals.chatMessages === 1 ? "" : "s"}`,
  ];
  const lines = [
    `# ${session?.title ?? "Stream recap"}`,
    "",
    `**Duration:** ${formatDuration(summary.durationMs)}`,
    session ? `**Started:** ${session.started_at}` : "",
    session?.ended_at ? `**Ended:** ${session.ended_at}` : "**Status:** Active session",
    "",
    "## Highlights",
    ...highlights.map((item) => `- ${item}`),
    "",
    "## Event Breakdown",
    ...(topEvents.length ? topEvents.map((event) => `- ${eventLabel(event.eventType)}: ${event.count}${event.amount ? ` (${event.amount})` : ""}`) : ["- No tracked events yet."]),
    "",
    "## Top Scenes",
    ...(topScenes.length ? topScenes.map((scene) => `- ${scene.sceneName}: ${formatDuration(scene.durationMs)}`) : ["- No scene spans tracked yet."]),
    "",
    "## Community Shoutouts",
    ...(supporters.length ? supporters.map((user) => `- ${user.name}: ${user.events} event${user.events === 1 ? "" : "s"}${user.amount ? `, ${user.amount} total amount` : ""}`) : ["- No named community events tracked yet."]),
  ].filter(Boolean);

  return {
    summary,
    events,
    sceneSpans,
    generatedAt: new Date().toISOString(),
    highlights,
    topEvents,
    topScenes,
    supporters,
    markdown: lines.join("\n"),
  };
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

  app.get("/api/sessions/:id/recap", async (req) => {
    const { id } = req.params as { id: string };
    return buildRecap(id);
  });

  app.get("/api/sessions/:id/recap.md", async (req, reply) => {
    const { id } = req.params as { id: string };
    const recap = buildRecap(id);
    return reply
      .header("Content-Type", "text/markdown; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="btv-session-${id}-recap.md"`)
      .send(recap.markdown);
  });

  app.post("/api/sessions/start", async (req, reply) => {
    const body = parseBody(reply, SessionStartBodySchema, req.body);
    if (!body) return;
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
