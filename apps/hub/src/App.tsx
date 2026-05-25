import { Navigate, NavLink, Route, Routes, useLocation, useParams } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { EmergencyMenu } from "./components/EmergencyMenu";
import { useAppHealth } from "./context/AppHealthContext";
import { useSaveStatusSummary } from "./context/SaveStatusContext";
import { ErrorBoundary, PageLoading, StatusPill } from "./ui";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const SetupPage = lazy(() => import("./pages/SetupPage"));
const OverlaysPage = lazy(() => import("./pages/OverlaysPage"));
const AlertEditorPage = lazy(() => import("./pages/AlertEditorPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const ThemesPage = lazy(() => import("./pages/ThemesPage"));
const WidgetsPage = lazy(() => import("./pages/WidgetsPage"));
const InteractivePage = lazy(() => import("./pages/InteractivePage"));
const MacrosPage = lazy(() => import("./pages/MacrosPage"));
const AutomationsPage = lazy(() => import("./pages/AutomationsPage"));
const WebhooksPage = lazy(() => import("./pages/WebhooksPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const AlertProjectsPage = lazy(() => import("./pages/AlertProjectsPage"));
const StreamDeckPage = lazy(() => import("./pages/StreamDeckPage"));

const navSections = [
  {
    label: "Live",
    items: [
      { path: "", label: "Dashboard" },
      { path: "/activity", label: "Activity" },
    ],
  },
  {
    label: "Overlays",
    items: [
      { path: "/overlays", label: "Browser sources" },
      { path: "/widgets", label: "Widgets" },
      { path: "/themes", label: "Themes", badge: "Legacy" },
    ],
  },
  {
    label: "Alerts",
    items: [
      { path: "/alerts", label: "Projects", end: true },
      { path: "/alerts/routing", label: "Test & routing" },
    ],
  },
  {
    label: "Automation",
    items: [
      { path: "/interactive", label: "Interactive" },
      { path: "/automations", label: "Automations" },
      { path: "/macros", label: "Macros" },
      { path: "/webhooks", label: "Webhooks" },
      { path: "/stream-deck", label: "Stream Deck" },
    ],
  },
  {
    label: "Settings",
    items: [
      { path: "/integrations", label: "Integrations" },
      { path: "/setup", label: "Setup" },
    ],
  },
] as const;

const NAV_COLLAPSE_STORAGE_KEY = "btv.nav.collapsedSections";

function LegacyAlertEditorRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/alerts/${encodeURIComponent(id ?? "")}`} replace />;
}

export default function App() {
  const { preflight, error, refresh } = useAppHealth();
  const saveSummary = useSaveStatusSummary();
  const location = useLocation();
  const reachableOverlays = preflight?.expectedOverlays.filter((overlay) => overlay.reachable).length ?? 0;
  const expectedOverlays = preflight?.expectedOverlays.length ?? 0;
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(NAV_COLLAPSE_STORAGE_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const activeSections = useMemo(() => {
    const currentPath = location.pathname;
    return new Set(
      navSections
        .filter((section) =>
          section.items.some((item) => {
            if (item.path === "") return currentPath === "/";
            if (item.path === "/alerts") return currentPath === "/alerts" || currentPath.startsWith("/alerts/");
            return currentPath === item.path || currentPath.startsWith(`${item.path}/`);
          }),
        )
        .map((section) => section.label),
    );
  }, [location.pathname]);

  const toggleSection = (label: string) => {
    setCollapsedSections((current) => ({ ...current, [label]: !current[label] }));
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">BTV Hub</div>
        <nav aria-label="Primary">
          {navSections.map((section) => (
            <div className={`nav-section${activeSections.has(section.label) ? " nav-section--active" : ""}`} key={section.label}>
              <button
                type="button"
                className="nav-section-header"
                aria-expanded={!collapsedSections[section.label]}
                onClick={() => toggleSection(section.label)}
              >
                <span>{section.label}</span>
                <span className="nav-section-chevron" aria-hidden="true" />
              </button>
              <div className="nav-section-items" hidden={collapsedSections[section.label]}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "" || ("end" in item && item.end)}
                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                  >
                    <span>{item.label}</span>
                    {"badge" in item ? <small>{item.badge}</small> : null}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="app-topbar">
          <div className="live-status-bar" aria-label="Live readiness status">
            <StatusPill to="/integrations" tone={preflight?.twitch.connected ? "success" : "danger"} label="Twitch" detail={String(preflight?.twitch.displayName ?? preflight?.twitch.login ?? "Offline")} />
            <StatusPill to="/integrations" tone={preflight?.obs.connected ? "success" : "danger"} label="OBS" detail={preflight?.obs.connected ? `${preflight.obs.host}:${preflight.obs.port}` : "Offline"} />
            <StatusPill
              to="/overlays"
              tone={expectedOverlays && reachableOverlays === expectedOverlays ? "success" : reachableOverlays ? "warning" : "danger"}
              label="Browser sources"
              detail={expectedOverlays ? `${reachableOverlays}/${expectedOverlays}` : "Checking"}
            />
            <StatusPill to="/" tone={preflight?.alerts.paused ? "warning" : "info"} label="Alert queue" detail={preflight?.alerts.paused ? "Paused" : `${preflight?.alerts.queued ?? 0} queued`} />
            {error ? <StatusPill to="/" tone="danger" label="Health" detail={error} /> : null}
          </div>
          <div className="app-topbar-actions">
            <GlobalSaveIndicator status={saveSummary.status} label={saveSummary.label} count={saveSummary.count} />
            <CommandPalette />
            <EmergencyMenu
              automationsDisabled={preflight?.emergency.automationsDisabled}
              channelPointActionsDisabled={preflight?.emergency.channelPointActionsDisabled}
              onActionComplete={refresh}
            />
          </div>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/overlays" element={<OverlaysPage />} />
              <Route path="/alerts" element={<AlertProjectsPage />} />
              <Route path="/alerts/routing" element={<AlertsPage />} />
              <Route path="/alerts/:id" element={<AlertEditorPage />} />
              <Route path="/alerts/editor/:id" element={<LegacyAlertEditorRedirect />} />
              <Route path="/alert-editor" element={<Navigate to="/alerts" replace />} />
              <Route path="/alert-rules" element={<Navigate to="/alerts/routing" replace />} />
              <Route path="/themes" element={<ThemesPage />} />
              <Route path="/widgets" element={<WidgetsPage />} />
              <Route path="/interactive" element={<InteractivePage />} />
              <Route path="/macros" element={<MacrosPage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/stream-deck" element={<StreamDeckPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function GlobalSaveIndicator({
  status,
  label,
  count,
}: {
  status: "idle" | "saving" | "saved" | "error" | "dirty";
  label: string;
  count: number;
}) {
  if (status === "idle") return null;
  const text =
    status === "saving"
      ? "Saving"
      : status === "saved"
        ? "Saved"
        : status === "dirty"
          ? "Unsaved"
          : "Save failed";
  const suffix = label ? `: ${label}${count > 2 ? ` +${count - 2}` : ""}` : "";
  return (
    <span className={`global-save-indicator global-save-indicator--${status}`} role="status">
      <span className="global-save-indicator__dot" aria-hidden="true" />
      {text}{suffix}
    </span>
  );
}
