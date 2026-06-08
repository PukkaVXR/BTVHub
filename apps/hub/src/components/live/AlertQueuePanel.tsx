import type { PreflightInfo } from "../../api";
import { Button, Card, CardHeader } from "../../ui";
import { timeAgo } from "./liveUtils";

interface AlertQueuePanelProps {
  preflight: PreflightInfo | null;
  onSkipCurrent: () => void;
  onTogglePause: () => void;
  onReplayLast: () => void;
  onClearQueued: () => void;
  onAdjustPriority: (id: string, nextPriority: number) => void;
}

export function AlertQueuePanel({
  preflight,
  onSkipCurrent,
  onTogglePause,
  onReplayLast,
  onClearQueued,
  onAdjustPriority,
}: AlertQueuePanelProps) {
  const current = preflight?.alerts.current;

  return (
    <Card hideableId="alert-queue" hideableTitle="Alert Queue">
      <CardHeader
        title="Alert Queue"
        action={
          <div className="actions live-actions-tight">
            <Button type="button" variant="secondary" size="sm" onClick={onSkipCurrent} disabled={!current}>
              Skip current
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onTogglePause}>
              {preflight?.alerts.paused ? "Resume queue" : "Pause queue"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onReplayLast}>
              Replay last
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClearQueued}>
              Clear queued
            </Button>
          </div>
        }
      />
      <div className="live-stat-grid">
        <LiveStat
          label="Now playing"
          value={current ? `${current.eventType} ${current.user ? `from ${current.user}` : ""}` : "Idle"}
        />
        <LiveStat label="Queued" value={`${preflight?.alerts.queued ?? 0}${preflight?.alerts.paused ? " paused" : ""}`} />
        <LiveStat label="Updated" value={preflight ? timeAgo(preflight.generatedAt) : ""} />
      </div>
      {preflight?.alerts.next.length ? (
        <table className="table live-panel-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>User</th>
              <th>Priority</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {preflight.alerts.next.map((item) => (
              <tr key={item.id}>
                <td>{item.eventType}</td>
                <td>{item.user ?? "-"}</td>
                <td>{item.priority}</td>
                <td>
                  <div className="actions live-actions-tight">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onAdjustPriority(item.id, item.priority + 1)}
                      title="Increase this queued alert's priority."
                    >
                      Priority +
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onAdjustPriority(item.id, item.priority - 1)}
                      title="Decrease this queued alert's priority."
                    >
                      Priority -
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
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
