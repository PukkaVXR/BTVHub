import type { PreflightInfo } from "../../api";
import { Card, CardHeader, StatusPill } from "../../ui";

interface HealthPanelProps {
  preflight: PreflightInfo | null;
}

export function HealthPanel({ preflight }: HealthPanelProps) {
  const staleOverlayCount = preflight?.overlays.clients.filter((client) => client.status === "stale").length ?? 0;

  return (
    <Card hideableId="health-panel" hideableTitle="Health Panel">
      <CardHeader title="Health Panel" description="Fast read on the systems that tend to cause stream-day friction." />
      <div className="live-health-grid">
        <StatusPill
          tone={preflight?.obs.connected ? "success" : "danger"}
          label="OBS WebSocket"
          detail={preflight ? `${preflight.obs.host}:${preflight.obs.port}` : "Checking"}
        />
        <StatusPill
          tone={(preflight?.overlays.clientCount ?? 0) > 0 ? "success" : "warning"}
          label="Overlay clients"
          detail={`${preflight?.overlays.clientCount ?? 0} connected`}
        />
        <StatusPill
          tone={staleOverlayCount ? "warning" : "success"}
          label="Overlay heartbeats"
          detail={`${staleOverlayCount} stale`}
        />
        <StatusPill
          tone={preflight?.alertProjects.errors ? "danger" : preflight?.alertProjects.warnings ? "warning" : "success"}
          label="Alert projects"
          detail={`${preflight?.alertProjects.errors ?? 0} broken / ${preflight?.alertProjects.warnings ?? 0} warning`}
        />
      </div>
    </Card>
  );
}
