import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/alerts", label: "Projects", end: true },
  { to: "/alerts/routing", label: "Routing" },
  { to: "/themes", label: "Legacy themes", badge: "Legacy" },
];

export function AlertsSectionTabs() {
  return (
    <nav className="section-tabs" aria-label="Alerts section">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `section-tabs__item${isActive ? " section-tabs__item--active" : ""}`}
        >
          <span>{tab.label}</span>
          {tab.badge ? <small>{tab.badge}</small> : null}
        </NavLink>
      ))}
    </nav>
  );
}
