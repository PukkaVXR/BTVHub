import type { PreflightInfo } from "../../api";
import { Button, Card } from "../../ui";
import { timeAgo } from "./liveUtils";

interface RecentActivityPanelProps {
  preflight: PreflightInfo | null;
  onReplayAlert: (id: string) => void;
}

export function RecentActivityPanel({ preflight, onReplayAlert }: RecentActivityPanelProps) {
  return (
    <Card hideableId="recent-activity" hideableTitle="Recent Activity">
      <h2>Recent Activity</h2>
      {preflight?.activity.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Type</th>
              <th>User</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {preflight.activity.slice(0, 5).map((row) => (
              <tr key={row.id}>
                <td>{timeAgo(row.at)}</td>
                <td>{row.event.source}</td>
                <td>{row.event.type}</td>
                <td>{row.event.user?.displayName ?? "-"}</td>
                <td>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onReplayAlert(row.id)}>
                    Replay alert
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="live-muted-copy">No events yet.</p>
      )}
    </Card>
  );
}
