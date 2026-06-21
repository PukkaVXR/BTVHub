import { useLocation, useNavigate } from "react-router-dom";
import { Tabs } from "../../ui";

const tabs = [
  { id: "projects", to: "/alerts", label: "Projects" },
  { id: "routing", to: "/alerts/routing", label: "Routing" },
];

export function AlertsSectionTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = location.pathname.startsWith("/alerts/routing") ? "routing" : "projects";

  return (
    <Tabs
      className="workflow-section-tabs"
      ariaLabel="Alerts section"
      items={tabs}
      activeId={activeId}
      onChange={(id) => {
        const tab = tabs.find((item) => item.id === id);
        if (tab) navigate(tab.to);
      }}
    />
  );
}
