import type { StreamSessionSummary } from "../../api";
import { Button, ButtonLink, Card, CardHeader } from "../../ui";
import { formatDuration, timeAgo } from "./liveUtils";

interface SessionPanelProps {
  session: StreamSessionSummary | undefined;
  title: string;
  onTitleChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
}

export function SessionPanel({ session, title, onTitleChange, onStart, onStop }: SessionPanelProps) {
  return (
    <Card hideableId="stream-session" hideableTitle="Stream Session">
      <CardHeader
        title="Stream Session"
        description={
          session?.session
            ? `${session.session.title} started ${timeAgo(session.session.started_at)}`
            : "No active analytics session"
        }
        action={
          session?.session ? (
            <Button type="button" variant="danger" size="sm" onClick={onStop}>
              Stop session
            </Button>
          ) : (
            <div className="live-session-start">
              <input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Optional session title"
              />
              <Button type="button" variant="primary" size="sm" onClick={onStart}>
                Start
              </Button>
            </div>
          )
        }
      />
      <div className="live-stat-grid">
        <LiveStat label="Duration" value={formatDuration(session?.durationMs ?? 0)} />
        <LiveStat label="Events" value={session?.totals.events ?? 0} />
        <LiveStat label="Follows" value={session?.totals.follows ?? 0} />
        <LiveStat label="Subs" value={session?.totals.subs ?? 0} />
        <LiveStat label="Bits" value={session?.totals.cheers ?? 0} />
        <LiveStat label="Chat" value={session?.totals.chatMessages ?? 0} />
      </div>
      {session?.sceneSpans.length ? (
        <div className="live-session-scenes">
          <p>Recent OBS scenes</p>
          <div>
            {session.sceneSpans.slice(0, 5).map((span) => (
              <span key={`${span.sceneName}-${span.startedAt}`} className="badge badge-ok">
                {span.sceneName}: {formatDuration(span.durationMs)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="live-panel-footer">
        <ButtonLink variant="secondary" size="sm" to="/activity">
          Open Activity
        </ButtonLink>
      </div>
    </Card>
  );
}

function LiveStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
