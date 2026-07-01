import { useEffect, useState } from "react";
import type { BtvEvent, StreamEvent, StreamEventType } from "@btv/shared";
import { api, type StreamSession, type StreamSessionDetail, type SystemLogEntry } from "../api";
import { useToast } from "../hooks/useToast";
import { usePollingQuery } from "../hooks/usePollingQuery";
import { Button, ButtonAnchor, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

type ActivityItem = { id: string; event: StreamEvent; at: string };

const ACTIVITY_FILTERS: Array<{ id: "all" | StreamEventType | "webhook"; label: string }> = [
  { id: "all", label: "All" },
  { id: "follow", label: "Follow" },
  { id: "sub", label: "Sub" },
  { id: "cheer", label: "Cheer" },
  { id: "raid", label: "Raid" },
  { id: "chat", label: "Chat" },
  { id: "channel_points", label: "Points" },
  { id: "webhook", label: "Webhook" },
];

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function activityTitle(event: StreamEvent): string {
  const user = event.user?.displayName ?? event.user?.login ?? "Unknown user";
  switch (event.type) {
    case "follow":
      return `${user} followed`;
    case "sub":
      return `${user} subscribed`;
    case "resub":
      return `${user} resubscribed`;
    case "gift_sub":
      return `${user} gifted a sub`;
    case "cheer":
      return `${user} cheered`;
    case "raid":
      return `${user} raided`;
    case "channel_points":
      return `${user} redeemed channel points`;
    case "chat":
      return `${user} chatted`;
    default:
      return `${user} triggered ${event.type}`;
  }
}

function activityMessage(event: StreamEvent): string {
  if (event.message) return event.message;
  if (event.amount != null) return `${event.amount.toLocaleString()} ${event.type === "cheer" ? "bits" : "total"}`;
  if (event.tier) return `Tier ${event.tier}`;
  if (event.source === "webhook") return "Triggered by webhook";
  return "No extra details";
}

function eventInitial(event: StreamEvent): string {
  const name = event.user?.displayName ?? event.user?.login ?? event.type;
  return name.slice(0, 1).toUpperCase();
}

function eventTone(event: StreamEvent): "success" | "warning" | "danger" | "info" | "neutral" {
  if (event.source === "webhook") return "warning";
  if (event.type === "sub" || event.type === "resub" || event.type === "gift_sub") return "success";
  if (event.type === "cheer" || event.type === "raid") return "info";
  if (event.type === "unknown") return "danger";
  return "neutral";
}

export default function ActivityPage() {
  const toast = useToast();
  const [selected, setSelected] = useState<StreamSessionDetail | null>(null);
  const [activityFilter, setActivityFilter] = useState<(typeof ACTIVITY_FILTERS)[number]["id"]>("all");
  const { data, refresh } = usePollingQuery({
    query: async () => {
      const [items, sessionList, logs, coreEvents] = await Promise.all([
        api.activity(),
        api.sessions(),
        api.logs(),
        api.coreEvents(),
      ]);
      return { items, sessions: sessionList.sessions, logs, coreEvents };
    },
    initialData: {
      items: [] as ActivityItem[],
      sessions: [] as StreamSession[],
      logs: [] as SystemLogEntry[],
      coreEvents: [] as BtvEvent[],
    },
    intervalMs: 5_000,
  });
  const { items, sessions, logs, coreEvents } = data;

  useEffect(() => {
    const selectedId = selected?.summary.session?.id;
    if (selectedId) void api.sessionDetail(selectedId).then(setSelected);
  }, [data, selected?.summary.session?.id]);

  const selectSession = async (id: string) => {
    setSelected(await api.sessionDetail(id));
  };

  const replayActivityAlert = async (id: string) => {
    const res = await api.replayActivityAlert(id);
    toast(res.message);
    void refresh();
  };

  const testSimilarEvent = async (event: StreamEvent) => {
    const res = await api.testEvent({
      type: event.type,
      user: event.user,
      message: event.message,
      amount: event.amount,
      payload: event.payload,
    });
    toast(`Test ${res.event.type} event sent`);
    void refresh();
  };

  const filteredItems = items.filter((item) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "webhook") return item.event.source === "webhook";
    return item.event.type === activityFilter;
  });

  return (
    <>
      <PageHeader title="Activity" description="Recent stream events, session history, and local analytics exports." />

      <div className="card">
        <h2>System Logs</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Level</th>
              <th>Source</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 30).map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.level}</td>
                <td>{log.source}</td>
                <td>{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p style={{ color: "var(--color-text-secondary)", padding: 12 }}>No system logs yet.</p>}
      </div>

      <div className="card">
        <h2>Core Event Bus</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Type</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {coreEvents.slice(0, 30).map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.timestamp).toLocaleString()}</td>
                <td>{event.source}</td>
                <td>{event.type}</td>
                <td>{event.actor?.displayName ?? event.actor?.login ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {coreEvents.length === 0 && <p style={{ color: "var(--color-text-secondary)", padding: 12 }}>No normalized events yet.</p>}
      </div>

      <div className="card">
        <h2>Sessions</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Started</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.title}</td>
                <td>{new Date(session.started_at).toLocaleString()}</td>
                <td>{session.ended_at ? "Ended" : "Active"}</td>
                <td>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void selectSession(session.id)}>
                    View
                  </Button>{" "}
                  <ButtonAnchor variant="primary" size="sm" href={`/api/sessions/${encodeURIComponent(session.id)}/export.csv`}>
                    CSV
                  </ButtonAnchor>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <p style={{ color: "var(--color-text-secondary)", padding: 12 }}>No sessions yet.</p>}
      </div>

      {selected && selected.summary.session && (
        <div className="card">
          <h2>{selected.summary.session.title}</h2>
          <div className="grid" style={{ marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>Duration</p>
              <strong>{formatDuration(selected.summary.durationMs)}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>Events</p>
              <strong>{selected.summary.totals.events}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>Follows</p>
              <strong>{selected.summary.totals.follows}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>Subs</p>
              <strong>{selected.summary.totals.subs}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>Bits</p>
              <strong>{selected.summary.totals.cheers}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6 }}>Chat</p>
              <strong>{selected.summary.totals.chatMessages}</strong>
            </div>
          </div>

          <h2>Scene spans</h2>
          <table className="table" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Scene</th>
                <th>Started</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {selected.sceneSpans.slice(0, 10).map((span) => (
                <tr key={span.id}>
                  <td>{span.scene_name}</td>
                  <td>{new Date(span.started_at).toLocaleString()}</td>
                  <td>{span.ended_at ? new Date(span.ended_at).toLocaleString() : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Session events</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Type</th>
                <th>User</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {selected.events.slice(0, 25).map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>{event.source}</td>
                  <td>{event.event_type}</td>
                  <td>{event.user_display_name ?? event.user_login ?? "-"}</td>
                  <td>{event.amount ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="activity-feed-card" hideableId="recent-activity-feed" hideableTitle="Recent Activity">
        <CardHeader
          title="Recent Activity"
          description="A live timeline of stream events, chat, webhook triggers, and alerts."
          action={<StatusPill tone="info" label={`${filteredItems.length}/${items.length}`} detail="visible" />}
        />
        <div className="activity-filter-bar" role="tablist" aria-label="Activity filters">
          {ACTIVITY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={activityFilter === filter.id}
              className={activityFilter === filter.id ? "active" : ""}
              onClick={() => setActivityFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="activity-feed-list">
          {filteredItems.map((item) => (
            <article key={item.id} className="activity-feed-row">
              <div className="activity-feed-avatar">
                {item.event.user?.profileImageUrl ? (
                  <img src={item.event.user.profileImageUrl} alt="" />
                ) : (
                  <span>{eventInitial(item.event)}</span>
                )}
              </div>
              <div className="activity-feed-main">
                <div className="activity-feed-title">
                  <strong>{activityTitle(item.event)}</strong>
                  <StatusPill tone={eventTone(item.event)} label={item.event.type} detail={item.event.source} />
                </div>
                <p>{activityMessage(item.event)}</p>
                <small title={new Date(item.at).toLocaleString()}>{timeAgo(item.at)}</small>
              </div>
              <div className="activity-feed-actions">
                <Button type="button" variant="secondary" size="sm" onClick={() => void testSimilarEvent(item.event)}>
                  Test similar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => void replayActivityAlert(item.id)}>
                  Replay alert
                </Button>
                <ButtonLink to="/alerts" variant="ghost" size="sm">
                  Open alert projects
                </ButtonLink>
              </div>
            </article>
          ))}
          {!items.length && <EmptyState title="No activity yet" description="Stream events, manual tests, and webhook triggers will appear here." />}
          {items.length > 0 && !filteredItems.length && (
            <EmptyState title="No matching activity" description="Try a different filter or wait for the next event." />
          )}
        </div>
      </Card>
    </>
  );
}
