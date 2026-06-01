import type { OverlayInfo } from "../../api";
import { ButtonLink, Card } from "../../ui";

interface ObsSourceUrlsPanelProps {
  overlays: OverlayInfo[];
}

export function ObsSourceUrlsPanel({ overlays }: ObsSourceUrlsPanelProps) {
  return (
    <Card>
      <h2>OBS Source URLs</h2>
      <div className="live-obs-url-grid">
        {overlays.slice(0, 4).map((overlay) => (
          <div key={overlay.id}>
            <strong>{overlay.name}</strong>
            <p>{overlay.id}</p>
            <div className="url-box">{overlay.url}</div>
          </div>
        ))}
      </div>
      <div className="actions">
        <ButtonLink variant="secondary" size="sm" to="/overlays">
          Manage overlays
        </ButtonLink>
        <ButtonLink variant="secondary" size="sm" to="/integrations">
          Integrations
        </ButtonLink>
        <ButtonLink variant="primary" size="sm" to="/alerts">
          Test alerts
        </ButtonLink>
      </div>
    </Card>
  );
}
