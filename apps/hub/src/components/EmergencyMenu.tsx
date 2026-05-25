import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { Button } from "../ui";

interface EmergencyMenuProps {
  automationsDisabled?: boolean;
  channelPointActionsDisabled?: boolean;
  onActionComplete?: () => void;
}

const EMERGENCY_ACTIONS = [
  { id: "stop-sounds", label: "Stop sounds", description: "Stops currently playing alert audio." },
  { id: "hide-overlays", label: "Hide overlays", description: "Temporarily hides active overlay effects." },
  { id: "reset-overlays", label: "Reset overlays", description: "Restores overlays to their normal visible state." },
  { id: "reconnect-obs", label: "Reconnect OBS", description: "Attempts to reconnect OBS WebSocket." },
  { id: "reconnect-twitch", label: "Reconnect Twitch", description: "Attempts to refresh Twitch services." },
] as const;

export function EmergencyMenu({
  automationsDisabled = false,
  channelPointActionsDisabled = false,
  onActionComplete,
}: EmergencyMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (detailsRef.current) {
          detailsRef.current.open = !detailsRef.current.open;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const runAction = async (action: string) => {
    if (
      action === "all" &&
      !window.confirm(
        "Stop all BTV effects? This clears alerts, stops sounds, hides overlays, and disables automation/channel point actions.",
      )
    ) {
      return;
    }

    setRunningAction(action);
    try {
      const res = await api.emergencyAction(action);
      toast({ message: res.ok ? res.title : res.message, tone: res.ok ? "success" : "error" });
      onActionComplete?.();
      if (action === "all") detailsRef.current?.removeAttribute("open");
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Emergency action failed", tone: "error" });
    } finally {
      setRunningAction(null);
    }
  };

  const automationAction = automationsDisabled ? "enable-automations" : "disable-automations";
  const channelPointsAction = channelPointActionsDisabled ? "enable-channel-points" : "disable-channel-points";

  return (
    <details ref={detailsRef} className="emergency-menu">
      <summary className="emergency-menu__trigger" aria-label="Open emergency controls">
        <span className="emergency-menu__dot" aria-hidden="true" />
        <span>Emergency</span>
        <kbd>Ctrl Shift E</kbd>
      </summary>
      <div className="emergency-menu__panel">
        <div className="emergency-menu__header">
          <div>
            <strong>Stream safety controls</strong>
            <p>Fast actions stay available from every page.</p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={runningAction === "all"}
            onClick={() => void runAction("all")}
          >
            Stop all
          </Button>
        </div>

        <div className="emergency-menu__grid">
          {EMERGENCY_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className="emergency-menu__action"
              disabled={runningAction !== null}
              onClick={() => void runAction(action.id)}
            >
              <span>{action.label}</span>
              <small>{action.description}</small>
            </button>
          ))}
          <button
            type="button"
            className="emergency-menu__action"
            disabled={runningAction !== null}
            onClick={() => void runAction(automationAction)}
          >
            <span>{automationsDisabled ? "Enable automations" : "Disable automations"}</span>
            <small>{automationsDisabled ? "Allows automation rules to run again." : "Pauses automation rules while live."}</small>
          </button>
          <button
            type="button"
            className="emergency-menu__action"
            disabled={runningAction !== null}
            onClick={() => void runAction(channelPointsAction)}
          >
            <span>{channelPointActionsDisabled ? "Enable channel points" : "Disable channel points"}</span>
            <small>{channelPointActionsDisabled ? "Allows redemptions to trigger actions again." : "Stops redemptions from firing actions."}</small>
          </button>
        </div>
      </div>
    </details>
  );
}
