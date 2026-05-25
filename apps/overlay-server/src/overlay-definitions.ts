import { getOverlayOrigin } from "./server-urls.js";

export interface ExpectedOverlayDefinition {
  id: string;
  label: string;
  name: string;
  route: string;
  channels: string[];
}

export const EXPECTED_OVERLAYS: ExpectedOverlayDefinition[] = [
  { id: "alerts", label: "Alerts", name: "Alerts", route: "/o/alerts.html", channels: ["alerts", "effects"] },
  { id: "chat", label: "Chat", name: "Chat", route: "/o/chat.html", channels: ["chat"] },
  { id: "goals", label: "Goal Bar", name: "Goal Bar", route: "/o/goals.html", channels: ["goal"] },
  { id: "ticker", label: "Event Ticker", name: "Event Ticker", route: "/o/ticker.html", channels: ["ticker"] },
  { id: "event-list", label: "Event List", name: "Event List", route: "/o/event-list.html", channels: ["eventList"] },
  { id: "now-playing", label: "Now Playing", name: "Now Playing", route: "/o/now-playing.html", channels: ["nowPlaying"] },
];

export const DEBUG_OVERLAY: ExpectedOverlayDefinition = {
  id: "demo",
  label: "Demo / Debug",
  name: "Demo / Debug",
  route: "/o/demo.html",
  channels: ["*"],
};

export function overlayUrl(route: string): string {
  return `${getOverlayOrigin()}${route}`;
}
