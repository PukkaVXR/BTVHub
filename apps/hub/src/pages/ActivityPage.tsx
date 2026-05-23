import { useEffect, useState } from "react";
import type { StreamEvent } from "@btv/shared";
import { api, type StreamSession, type StreamSessionDetail, type SystemLogEntry } from "../api";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function ActivityPage() {
  const [items, setItems] = useState<Array<{ id: string; event: StreamEvent; at: string }>>([]);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [selected, setSelected] = useState<StreamSessionDetail | null>(null);

  const load = () => {
    void Promise.all([api.activity(), api.sessions(), api.logs()]).then(([activity, sessionList, logList]) => {
      setItems(activity);
      setSessions(sessionList.sessions);
      setLogs(logList);
      const selectedId = selected?.summary.session?.id;
      if (selectedId) {
        void api.sessionDetail(selectedId).then(setSelected);
      }
    });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const selectSession = async (id: string) => {
    setSelected(await api.sessionDetail(id));
  };

  return (
    <>
      <h1>Activity</h1>
      <p className="subtitle">Recent stream events, session history, and local analytics exports.</p>

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
        {logs.length === 0 && <p style={{ color: "var(--muted)", padding: 12 }}>No system logs yet.</p>}
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
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void selectSession(session.id)}>
                    View
                  </button>{" "}
                  <a className="btn btn-primary btn-sm" href={`/api/sessions/${encodeURIComponent(session.id)}/export.csv`}>
                    CSV
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <p style={{ color: "var(--muted)", padding: 12 }}>No sessions yet.</p>}
      </div>

      {selected && selected.summary.session && (
        <div className="card">
          <h2>{selected.summary.session.title}</h2>
          <div className="grid" style={{ marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Duration</p>
              <strong>{formatDuration(selected.summary.durationMs)}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Events</p>
              <strong>{selected.summary.totals.events}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Follows</p>
              <strong>{selected.summary.totals.follows}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Subs</p>
              <strong>{selected.summary.totals.subs}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Bits</p>
              <strong>{selected.summary.totals.cheers}</strong>
            </div>
            <div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Chat</p>
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

      <div className="card">
        <h2>Recent Activity</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Type</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.at).toLocaleString()}</td>
                <td>{r.event.source}</td>
                <td>{r.event.type}</td>
                <td>{r.event.user?.displayName ?? "-"}</td>
                <td>{r.event.message ?? (r.event.amount != null ? String(r.event.amount) : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p style={{ color: "var(--muted)", padding: 12 }}>No events yet.</p>}
      </div>
    </>
  );
}
