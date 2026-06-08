import type { PreflightInfo } from "../../api";
import { Button, Card, CardHeader } from "../../ui";

interface EmergencyControlsPanelProps {
  preflight: PreflightInfo | null;
  onAction: (action: string) => void;
}

export function EmergencyControlsPanel({ preflight, onAction }: EmergencyControlsPanelProps) {
  return (
    <Card className="live-emergency-panel" hideableId="emergency-controls" hideableTitle="Emergency Controls">
      <CardHeader
        title="Emergency Controls"
        description="Fast stream-safety actions for overlays, sounds, automations, channel points, and reconnects."
        action={
          <Button type="button" variant="danger" size="sm" onClick={() => onAction("all")}>
            Stop all BTV effects
          </Button>
        }
      />
      <div className="actions">
        <Button type="button" variant="secondary" size="sm" onClick={() => onAction("stop-sounds")}>
          Stop sounds
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onAction("hide-overlays")}>
          Hide overlays
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onAction("reset-overlays")}>
          Reset overlays
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onAction(preflight?.emergency.automationsDisabled ? "enable-automations" : "disable-automations")}
        >
          {preflight?.emergency.automationsDisabled ? "Enable automations" : "Disable automations"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onAction(preflight?.emergency.channelPointActionsDisabled ? "enable-channel-points" : "disable-channel-points")}
        >
          {preflight?.emergency.channelPointActionsDisabled ? "Enable channel points" : "Disable channel points"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onAction("reconnect-obs")}>
          Reconnect OBS
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onAction("reconnect-twitch")}>
          Reconnect Twitch
        </Button>
      </div>
    </Card>
  );
}
