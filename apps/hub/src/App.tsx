import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./api";
import Dashboard from "./pages/Dashboard";
import OverlaysPage from "./pages/OverlaysPage";
import AlertsPage from "./pages/AlertsPage";
import WidgetsPage from "./pages/WidgetsPage";
import ThemesPage from "./pages/ThemesPage";
import InteractivePage from "./pages/InteractivePage";
import MacrosPage from "./pages/MacrosPage";
import AutomationsPage from "./pages/AutomationsPage";
import WebhooksPage from "./pages/WebhooksPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ActivityPage from "./pages/ActivityPage";
import SetupPage from "./pages/SetupPage";

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
    ["/themes", "Themes"],
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
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/overlays" element={<OverlaysPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/widgets" element={<WidgetsPage />} />
          <Route path="/interactive" element={<InteractivePage />} />
          <Route path="/macros" element={<MacrosPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
        </Routes>
      </main>
    </div>
  );
}
