import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api, type IntegrationsInfo, type PreflightInfo } from "../api";
import { useToast } from "../hooks/useToast";

interface SetupStep {
  id: string;
  title: string;
  detail: string;
  complete: boolean;
  actionLabel: string;
  actionTo?: string;
  onAction?: () => void;
}

export default function SetupPage() {
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsInfo | null>(null);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.preflight(), api.integrations()]).then(([p, i]) => {
      setPreflight(p);
      setIntegrations(i);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const testFollow = async () => {
    await api.testVisualAlert("follow");
    toast("Test visual follow alert sent");
    load();
  };

  const steps = useMemo<SetupStep[]>(() => {
    const overlayReachable = preflight?.expectedOverlays.some((overlay) => overlay.reachable) ?? false;
    return [
      {
        id: "server",
        title: "Start BTV services",
        detail: preflight ? `Overlay server is running at ${preflight.checks.find((c) => c.id === "overlay-server")?.detail}` : "Waiting for server health.",
        complete: Boolean(preflight),
        actionLabel: "Open Dashboard",
        actionTo: "/",
      },
      {
        id: "twitch",
        title: "Connect Twitch",
        detail: integrations?.twitch.connected
          ? `Connected as ${integrations.twitch.displayName ?? integrations.twitch.login ?? "Twitch"}`
          : "Add Twitch credentials and complete OAuth.",
        complete: Boolean(integrations?.twitch.connected),
        actionLabel: "Configure Twitch",
        actionTo: "/integrations",
      },
      {
        id: "obs",
        title: "Connect OBS WebSocket",
        detail: integrations?.obs.connected ? "OBS WebSocket is connected." : "Save OBS host, port, and password.",
        complete: Boolean(integrations?.obs.connected),
        actionLabel: "Configure OBS",
        actionTo: "/integrations",
      },
      {
        id: "overlays",
        title: "Add OBS browser sources",
        detail: overlayReachable
          ? `${preflight?.expectedOverlays.filter((overlay) => overlay.reachable).length ?? 0} overlay source(s) are connected.`
          : "Add at least the Alerts browser source to OBS.",
        complete: overlayReachable,
        actionLabel: "Copy Overlay URLs",
        actionTo: "/overlays",
      },
      {
        id: "test-alert",
        title: "Send a test alert",
        detail: "Confirm that OBS can see alerts before going live.",
        complete: Boolean(preflight?.activity.some((row) => row.event.source === "manual")),
        actionLabel: "Test Follow Alert",
        onAction: () => void testFollow(),
      },
      {
        id: "doctor",
        title: "Review BTV Doctor",
        detail: preflight?.ok ? "All required checks are currently healthy." : "Review any failed checks before streaming.",
        complete: Boolean(preflight?.ok),
        actionLabel: "Open Dashboard",
        actionTo: "/",
      },
      {
        id: "backup",
        title: "Config backup available",
        detail: "Download a redacted snapshot of settings, widgets, alerts, effects, macros, automations, and layouts.",
        complete: true,
        actionLabel: "Download Backup",
        actionTo: "/api/config/export",
      },
    ];
  }, [integrations, preflight]);

  const completeCount = steps.filter((step) => step.complete).length;

  return (
    <>
      <h1>Setup Wizard</h1>
      <p className="subtitle">A quick readiness path for Twitch, OBS, browser sources, and test alerts.</p>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Setup Progress</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              {completeCount}/{steps.length} checks complete.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid">
        {steps.map((step) => (
          <div key={step.id} className="card" style={{ borderColor: step.complete ? "var(--success)" : "var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div>
                <h2 style={{ margin: 0 }}>{step.title}</h2>
                <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>{step.detail}</p>
              </div>
              <span className={step.complete ? "badge badge-ok" : "badge badge-off"}>
                {step.complete ? "Done" : "Todo"}
              </span>
            </div>
            {step.actionTo?.startsWith("/api/") ? (
              <a className="btn btn-secondary btn-sm" href={step.actionTo}>
                {step.actionLabel}
              </a>
            ) : step.actionTo ? (
              <Link className="btn btn-secondary btn-sm" to={step.actionTo}>
                {step.actionLabel}
              </Link>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={step.onAction}>
                {step.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
