import type { IntegrationsInfo, PreflightInfo } from "../api";

export interface SetupReadinessStep {
  id: string;
  title: string;
  detail: string;
  complete: boolean;
  actionLabel: string;
  actionTo?: string;
  actionId?: "test-follow";
}

export interface GoLiveChecklistItem {
  id: "alerts" | "browser-sources" | "integrations";
  label: string;
  ready: boolean;
  to: string;
  actionLabel: string;
}

export function reachableOverlayCount(preflight: PreflightInfo | null): number {
  return preflight?.expectedOverlays.filter((overlay) => overlay.reachable).length ?? 0;
}

export function hasReachableOverlay(preflight: PreflightInfo | null): boolean {
  return reachableOverlayCount(preflight) > 0;
}

export function allExpectedOverlaysReachable(preflight: PreflightInfo | null): boolean {
  if (!preflight?.expectedOverlays.length) return false;
  return preflight.expectedOverlays.every((overlay) => overlay.reachable);
}

export function hasManualTestAlert(preflight: PreflightInfo | null): boolean {
  return Boolean(preflight?.activity.some((row) => row.event.source === "manual"));
}

export function integrationsConnected(preflight: PreflightInfo | null, integrations?: IntegrationsInfo | null): boolean {
  if (integrations) return Boolean(integrations.twitch.connected && integrations.obs.connected);
  return Boolean(preflight?.twitch.connected && preflight?.obs.connected);
}

export function goLiveChecklistItems(preflight: PreflightInfo | null): GoLiveChecklistItem[] {
  return [
    {
      id: "alerts",
      label: "Alert routing ready",
      ready: Boolean(preflight && preflight.alertProjects.errors === 0),
      to: "/alerts/routing",
      actionLabel: "Open",
    },
    {
      id: "browser-sources",
      label: "Browser sources reachable",
      ready: allExpectedOverlaysReachable(preflight),
      to: "/overlays",
      actionLabel: "Manage",
    },
    {
      id: "integrations",
      label: "Integrations connected",
      ready: integrationsConnected(preflight),
      to: "/integrations",
      actionLabel: "Open",
    },
  ];
}

export function setupReadinessSteps(
  preflight: PreflightInfo | null,
  integrations: IntegrationsInfo | null,
): SetupReadinessStep[] {
  const overlayCount = reachableOverlayCount(preflight);
  const overlayServerDetail = preflight?.checks.find((check) => check.id === "overlay-server")?.detail;

  return [
    {
      id: "server",
      title: "Start BTV services",
      detail: preflight ? `Overlay server is running at ${overlayServerDetail}` : "Waiting for server health.",
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
      detail: overlayCount ? `${overlayCount} overlay source(s) are connected.` : "Add at least the Alerts browser source to OBS.",
      complete: overlayCount > 0,
      actionLabel: "Copy Overlay URLs",
      actionTo: "/overlays",
    },
    {
      id: "test-alert",
      title: "Send a test alert",
      detail: "Confirm that OBS can see alerts before going live.",
      complete: hasManualTestAlert(preflight),
      actionLabel: "Test Follow Alert",
      actionId: "test-follow",
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
}
