import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "./api";

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

function PageLoading() {
  return (
    <div className="card">
      <h2>Loading</h2>
      <p className="subtitle">Preparing this workspace...</p>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState<{
    twitch?: { connected?: boolean };
    overlayUrl?: string;
  } | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    const t = setInterval(() => api.health().then(setHealth).catch(() => setHealth(null)), 15000);
    return () => clearInterval(t);
  }, []);

  const nav = [
    ["", "Dashboard"],
    ["/setup", "Setup"],
    ["/overlays", "Overlays"],
    ["/alerts", "Alerts"],
    ["/widgets", "Widgets"],
    ["/interactive", "Interactive"],
    ["/macros", "Macros"],
    ["/automations", "Automations"],
    ["/webhooks", "Webhooks"],
    ["/integrations", "Integrations"],
    ["/activity", "Activity"],
  ] as const;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">BTV Hub</div>
        <nav>
          {nav.map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              end={path === ""}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="status-bar">
          <span>
            Twitch:{" "}
            {health?.twitch?.connected ? (
              <span className="badge badge-ok">Connected</span>
            ) : (
              <span className="badge badge-off">Offline</span>
            )}
          </span>
          <span>
            Overlay:{" "}
            <span className="badge badge-ok">{health?.overlayUrl ?? "http://127.0.0.1:4782"}</span>
          </span>
        </div>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/overlays" element={<OverlaysPage />} />
            <Route path="/alerts" element={<AlertEditorPage />} />
            <Route path="/alerts/editor/:id" element={<AlertEditorPage />} />
            <Route path="/alert-editor" element={<Navigate to="/alerts" replace />} />
            <Route path="/alert-rules" element={<AlertsPage />} />
            <Route path="/themes" element={<ThemesPage />} />
            <Route path="/widgets" element={<WidgetsPage />} />
            <Route path="/interactive" element={<InteractivePage />} />
            <Route path="/macros" element={<MacrosPage />} />
            <Route path="/automations" element={<AutomationsPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
