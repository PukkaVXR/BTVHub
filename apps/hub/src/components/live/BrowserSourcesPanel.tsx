import type { PreflightInfo } from "../../api";
import { Button, Card, CardHeader } from "../../ui";
import { timeAgo } from "./liveUtils";

interface BrowserSourcesPanelProps {
  preflight: PreflightInfo | null;
  overlayChannels: Array<[string, number]>;
  repairing: boolean;
  onRepair: () => void;
}

export function BrowserSourcesPanel({ preflight, overlayChannels, repairing, onRepair }: BrowserSourcesPanelProps) {
  const shouldOfferRepair = Boolean(
    preflight?.obs.connected &&
      (preflight.overlays.clientCount === 0 ||
        preflight.expectedOverlays.some(
          (overlay) => overlay.obsSource && (!overlay.obsSource.configured || !overlay.obsSource.correctUrl),
        )),
  );

  return (
    <Card>
      <CardHeader
        title="Connected Browser Sources"
        description={`${preflight?.overlays.clientCount ?? 0} active WebSocket client${(preflight?.overlays.clientCount ?? 0) === 1 ? "" : "s"}`}
      />

      {preflight?.expectedOverlays.length ? (
        <div className="live-badge-row">
          {preflight.expectedOverlays.map((overlay) => (
            <span key={overlay.id} className={overlay.reachable ? "badge badge-ok" : "badge"}>
              {overlay.label}: {overlay.reachable ? "reachable" : overlay.obsSource?.configured ? "configured, not live" : "not in OBS"}
            </span>
          ))}
        </div>
      ) : null}

      {shouldOfferRepair ? (
        <div className="live-repair-block">
          <p>OBS browser sources are missing, mismatched, hidden, or not actively loading.</p>
          <Button type="button" variant="primary" size="sm" onClick={onRepair} disabled={repairing}>
            {repairing ? "Repairing..." : "Repair OBS browser sources"}
          </Button>
        </div>
      ) : null}

      {overlayChannels.length ? (
        <div className="live-badge-row">
          {overlayChannels.map(([channel, count]) => (
            <span key={channel} className="badge badge-ok">
              {channel}: {count}
            </span>
          ))}
        </div>
      ) : (
        <p className="live-muted-copy">Open OBS or preview an overlay page to connect browser sources.</p>
      )}

      {preflight?.overlays.clients.length ? (
        <table className="table live-panel-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Channels</th>
              <th>Status</th>
              <th>Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {preflight.overlays.clients.map((client) => (
              <tr key={client.id}>
                <td>{client.route ?? "-"}</td>
                <td>{client.channels.join(", ")}</td>
                <td>{client.status}</td>
                <td>{timeAgo(client.lastHeartbeatAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {preflight?.expectedOverlays.some((overlay) => overlay.obsSource?.configured) ? (
        <table className="table live-panel-table">
          <thead>
            <tr>
              <th>Overlay</th>
              <th>OBS source</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {preflight.expectedOverlays.map((overlay) => (
              <tr key={`obs-source-${overlay.id}`}>
                <td>{overlay.label}</td>
                <td>{overlay.obsSource?.sourceName ?? "-"}</td>
                <td>{overlay.obsSource?.correctUrl ? "Correct" : overlay.obsSource?.configured ? "Mismatch" : "Missing"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Card>
  );
}
