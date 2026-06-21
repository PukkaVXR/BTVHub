import { useState, type CSSProperties } from "react";
import { StreamDeckRequestBuilder } from "../components/streamDeck";
import { useAppHealth } from "../context/AppHealthContext";
import { getLocalApiToken } from "../api";
import { downloadApiNinjaButton, downloadStreamDeckAction, withStreamDeckAuthHeaders } from "../lib/apiNinja";
import { resolveOverlayOrigin } from "../lib/serverUrls";
import { Button, ButtonAnchor, ButtonLink, Card, CardHeader, CopyField, EmptyState, PageHeader } from "../ui";

const STREAM_DECK_BASE_URL = resolveOverlayOrigin();

const STREAM_DECK_ACTIONS = [
  { label: "Run macro", method: "POST", path: "/api/actions/macro/:macroId" },
  { label: "Apply source group", method: "POST", path: "/api/actions/source-group/:groupId" },
  { label: "Switch OBS scene", method: "POST", path: "/api/actions/obs/scene" },
  { label: "Toggle OBS source", method: "POST", path: "/api/actions/obs/source-visibility" },
  { label: "Move OBS source", method: "POST", path: "/api/actions/obs/source-motion" },
  { label: "Update OBS text", method: "POST", path: "/api/actions/obs/text" },
  { label: "Emergency action", method: "POST", path: "/api/emergency/:action" },
  { label: "Status check", method: "GET", path: "/api/stream-deck/status" },
  { label: "Macro status list", method: "GET", path: "/api/stream-deck/macros" },
  { label: "Activity layout status", method: "GET", path: "/api/stream-deck/source-groups" },
  { label: "OBS status", method: "GET", path: "/api/stream-deck/obs" },
];

const SETUP_STEPS = [
  "Install BarRaider API Ninja or another Stream Deck HTTP request plugin.",
  "Use port 4782 for action URLs, not the Hub UI port 4781.",
  "Use POST with Content-Type application/json and body {} for action buttons.",
  "Use GET for status keys if your plugin supports polling.",
  "Export buttons from the Hub Stream Deck page so the local X-BTV-Token header is included automatically.",
] as const;

const RESPONSE_FIELDS = [
  { field: "ok", detail: "Boolean success state for key feedback." },
  { field: "title", detail: "Short label suitable for button titles or notifications." },
  { field: "message", detail: "Longer detail for logs, plugin messages, or debugging." },
  { field: "color", detail: "Suggested button color, usually green, blue, or red." },
  { field: "icon", detail: "Suggested icon keyword for plugins or future native support." },
] as const;

const READY_ACTION_BUTTONS = [
  { id: "stop-all", title: "Stop all", group: "Safety", method: "POST", path: "/api/emergency/all", body: "{}", icon: "octagon-alert", color: "#ff3b5f" },
  { id: "stop-sounds", title: "Stop sounds", group: "Safety", method: "POST", path: "/api/emergency/stop-sounds", body: "{}", icon: "volume-x", color: "#ff9f1c" },
  { id: "hide-overlays", title: "Hide overlays", group: "Safety", method: "POST", path: "/api/emergency/hide-overlays", body: "{}", icon: "eye-off", color: "#ff9f1c" },
  { id: "reset-overlays", title: "Reset overlays", group: "Safety", method: "POST", path: "/api/emergency/reset-overlays", body: "{}", icon: "refresh-cw", color: "#5b8cff" },
  { id: "reconnect-obs", title: "Reconnect OBS", group: "Safety", method: "POST", path: "/api/emergency/reconnect-obs", body: "{}", icon: "radio", color: "#6ee7b7" },
  { id: "pause-alerts", title: "Pause alerts", group: "Alerts", method: "POST", path: "/api/alerts/pause", body: "{}", icon: "pause", color: "#ffcf5a" },
  { id: "resume-alerts", title: "Resume alerts", group: "Alerts", method: "POST", path: "/api/alerts/resume", body: "{}", icon: "play", color: "#00f593" },
  { id: "skip-alert", title: "Skip alert", group: "Alerts", method: "POST", path: "/api/alerts/skip", body: "{}", icon: "skip-forward", color: "#5b8cff" },
  { id: "replay-alert", title: "Replay alert", group: "Alerts", method: "POST", path: "/api/alerts/replay-last", body: "{}", icon: "rotate-ccw", color: "#a78bfa" },
  { id: "clear-alerts", title: "Clear alerts", group: "Alerts", method: "POST", path: "/api/alerts/clear", body: "{}", icon: "trash-2", color: "#ff5a67" },
  { id: "test-follow", title: "Test follow", group: "Testing", method: "POST", path: "/api/test/alert/follow", body: "{}", icon: "user-plus", color: "#38bdf8" },
  { id: "test-sub", title: "Test sub", group: "Testing", method: "POST", path: "/api/test/alert/sub", body: "{}", icon: "star", color: "#f472b6" },
] as const;

const ICON_LABELS: Record<(typeof READY_ACTION_BUTTONS)[number]["icon"], string> = {
  "octagon-alert": "!",
  "volume-x": "Mute",
  "eye-off": "Hide",
  "refresh-cw": "Reset",
  radio: "OBS",
  pause: "Pause",
  play: "Play",
  "skip-forward": "Skip",
  "rotate-ccw": "Replay",
  "trash-2": "Clear",
  "user-plus": "Follow",
  star: "Sub",
};

const BUTTON_STATE_RECIPES = [
  {
    title: "Readiness key",
    endpoint: "/api/stream-deck/status",
    states: "Green when OBS, Twitch, and overlays are ready; red when something needs attention.",
  },
  {
    title: "OBS key",
    endpoint: "/api/stream-deck/obs",
    states: "Shows current scene when OBS is online; red when WebSocket is offline.",
  },
  {
    title: "Activity layout keys",
    endpoint: "/api/stream-deck/source-groups",
    states: "Each layout includes active, color, icon, and url so your key can highlight the active layout.",
  },
  {
    title: "Macro keys",
    endpoint: "/api/stream-deck/macros",
    states: "Enabled macros return green action metadata; disabled macros return muted state metadata.",
  },
] as const;

function formatActionButtonConfig(button: (typeof READY_ACTION_BUTTONS)[number], apiToken?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiToken) headers["X-BTV-Token"] = apiToken;
  return [
    `Name: ${button.title}`,
    `Method: ${button.method}`,
    `URL: ${STREAM_DECK_BASE_URL}${button.path}`,
    `Headers: ${JSON.stringify(headers)}`,
    `Body: ${button.body}`,
    `Suggested color: ${button.color}`,
    `Suggested icon: ${button.icon}`,
  ].join("\n");
}

async function exportActionButton(button: (typeof READY_ACTION_BUTTONS)[number]) {
  const input = withStreamDeckAuthHeaders({
    title: `BTV ${button.title}`,
    method: button.method,
    url: `${STREAM_DECK_BASE_URL}${button.path}`,
    contentType: "application/json",
    body: button.body,
  }, await getLocalApiToken());
  downloadApiNinjaButton(input);
}

async function exportStreamDeckActionButton(button: (typeof READY_ACTION_BUTTONS)[number]) {
  const input = withStreamDeckAuthHeaders({
    title: `BTV ${button.title}`,
    method: button.method,
    url: `${STREAM_DECK_BASE_URL}${button.path}`,
    contentType: "application/json",
    body: button.body,
    color: button.color,
    iconLabel: ICON_LABELS[button.icon],
  }, await getLocalApiToken());
  await downloadStreamDeckAction(input);
}

export default function StreamDeckPage() {
  const { preflight } = useAppHealth();
  const [showActionEndpoints, setShowActionEndpoints] = useState(false);

  const describeActionButtonState = (id: (typeof READY_ACTION_BUTTONS)[number]["id"]) => {
    switch (id) {
      case "reconnect-obs":
        return {
          label: preflight?.obs.connected ? "OBS online" : "OBS offline",
          tone: preflight?.obs.connected ? "success" : "danger",
        };
      case "pause-alerts":
        return {
          label: preflight?.alerts.paused ? "Already paused" : "Ready",
          tone: preflight?.alerts.paused ? "warning" : "success",
        };
      case "resume-alerts":
        return {
          label: preflight?.alerts.paused ? "Ready" : "Already live",
          tone: preflight?.alerts.paused ? "success" : "info",
        };
      case "skip-alert":
      case "replay-alert":
        return {
          label: preflight?.alerts.current ? "Alert playing" : `${preflight?.alerts.queued ?? 0} queued`,
          tone: preflight?.alerts.current || (preflight?.alerts.queued ?? 0) > 0 ? "success" : "info",
        };
      case "clear-alerts":
        return {
          label: `${preflight?.alerts.queued ?? 0} queued`,
          tone: (preflight?.alerts.queued ?? 0) > 0 ? "warning" : "info",
        };
      case "test-follow":
      case "test-sub":
        return {
          label: preflight?.expectedOverlays.some((overlay) => overlay.id === "alerts" && overlay.reachable) ? "Alerts reachable" : "Check alerts source",
          tone: preflight?.expectedOverlays.some((overlay) => overlay.id === "alerts" && overlay.reachable) ? "success" : "warning",
        };
      default:
        return {
          label: "Always available",
          tone: "info",
        };
    }
  };

  return (
    <>
      <PageHeader
        title="Stream Deck"
        description="Dedicated home for Stream Deck actions, API Ninja requests, and live control shortcuts."
        action={
          <ButtonAnchor variant="secondary" size="sm" href="/tutorials/stream-deck-setup.md" target="_blank" rel="noreferrer">
            Open setup tutorial
          </ButtonAnchor>
        }
      />

      <Card hideableId="http-quick-start" hideableTitle="HTTP API Quick Start">
        <CardHeader
          title="HTTP API quick start"
          description="BTV is ready for Stream Deck before a native plugin exists. Use local HTTP requests today, then keep the same endpoint model for a future plugin."
        />
        <div className="stream-deck-guide-grid">
          {SETUP_STEPS.map((step, index) => (
            <div className="stream-deck-guide-card" key={step}>
              <small>Step {index + 1}</small>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card hideableId="action-endpoints" hideableTitle="Action Endpoints">
        <CardHeader
          title="Action endpoints"
          description={`${STREAM_DECK_ACTIONS.length} raw HTTP endpoints for Stream Deck plugins and API Ninja buttons.`}
          action={
            <div className="stream-deck-endpoints-card-actions">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowActionEndpoints((current) => !current)}>
                {showActionEndpoints ? "Hide endpoints" : "Show endpoints"}
              </Button>
              <ButtonLink variant="secondary" size="sm" to="/">
                Back to dashboard
              </ButtonLink>
            </div>
          }
        />
        {showActionEndpoints ? (
          <div className="stream-deck-endpoints">
            {STREAM_DECK_ACTIONS.map((action) => (
              <div className="stream-deck-endpoint" key={action.path}>
                <div>
                  <span>{action.label}</span>
                  <small>{action.method}</small>
                </div>
                <CopyField label="Endpoint URL" value={`${STREAM_DECK_BASE_URL}${action.path}`} />
              </div>
            ))}
          </div>
        ) : (
          <p className="stream-deck-endpoints-summary">Collapsed. Use the action builder below for guided exports, or expand this reference when you need raw URLs.</p>
        )}
      </Card>

      <StreamDeckRequestBuilder />

      <Card hideableId="ready-made-action-buttons" hideableTitle="Ready-Made Action Buttons">
        <CardHeader
          title="Ready-made action buttons"
          description="Copy complete API Ninja configs for common live actions. These are the dependable buttons you want before stream."
        />
        <div className="stream-deck-action-buttons">
          {READY_ACTION_BUTTONS.map((button) => (
            <div className="stream-deck-action-button-card" key={`${button.group}-${button.title}`}>
              <div className="stream-deck-action-button-preview" style={{ "--button-color": button.color } as CSSProperties}>
                <span aria-hidden="true">{ICON_LABELS[button.icon]}</span>
              </div>
              <div>
                <small>{button.group}</small>
                <strong>{button.title}</strong>
                <span className="stream-deck-button-style-meta">
                  <span className="stream-deck-button-swatch" style={{ backgroundColor: button.color }} aria-hidden="true" />
                  <code>{button.color}</code>
                  <code>{button.icon}</code>
                </span>
                <span className={`stream-deck-state-chip stream-deck-state-chip--${describeActionButtonState(button.id).tone}`}>
                  {describeActionButtonState(button.id).label}
                </span>
                <code>{button.method} {button.path}</code>
              </div>
              <div className="stream-deck-action-button-card__actions">
                <CopyActionButton button={button} />
                <ExportActionButton button={button} />
                <ExportStreamDeckActionButton button={button} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card hideableId="button-feedback-contract" hideableTitle="Button Feedback Contract">
        <CardHeader title="Button feedback contract" description="Action responses are shaped so Stream Deck plugins can update labels, colors, and success states." />
        <div className="stream-deck-response-grid">
          {RESPONSE_FIELDS.map((item) => (
            <div key={item.field}>
              <code>{item.field}</code>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card hideableId="button-state-recipes" hideableTitle="Button State Recipes">
        <CardHeader
          title="Button state recipes"
          description="Use polling endpoints for keys that can change title, color, icon, or active state while you are live."
        />
        <div className="stream-deck-state-recipes">
          {BUTTON_STATE_RECIPES.map((recipe) => (
            <div className="stream-deck-state-recipe" key={recipe.endpoint}>
              <div>
                <strong>{recipe.title}</strong>
                <p>{recipe.states}</p>
              </div>
              <CopyField label="Polling URL" value={`${STREAM_DECK_BASE_URL}${recipe.endpoint}`} />
            </div>
          ))}
        </div>
      </Card>

      <EmptyState
        title="Want more shortcuts?"
        description="Macros and activity layouts become selectable Stream Deck actions as soon as you create them."
        action={<ButtonLink variant="secondary" size="sm" to="/macros">Manage macros</ButtonLink>}
      />
    </>
  );
}

function ExportStreamDeckActionButton({ button }: { button: (typeof READY_ACTION_BUTTONS)[number] }) {
  const [exported, setExported] = useState(false);

  const exportButton = async () => {
    await exportStreamDeckActionButton(button);
    setExported(true);
    window.setTimeout(() => setExported(false), 1600);
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void exportButton()}>
      {exported ? "Exported" : "Export action"}
    </Button>
  );
}

function ExportActionButton({ button }: { button: (typeof READY_ACTION_BUTTONS)[number] }) {
  const [exported, setExported] = useState(false);

  const exportButton = async () => {
    await exportActionButton(button);
    setExported(true);
    window.setTimeout(() => setExported(false), 1600);
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void exportButton()}>
      {exported ? "Exported" : "Export .ninja"}
    </Button>
  );
}

function CopyActionButton({ button }: { button: (typeof READY_ACTION_BUTTONS)[number] }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const token = await getLocalApiToken();
    await navigator.clipboard.writeText(formatActionButtonConfig(button, token));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
      {copied ? "Copied" : "Copy config"}
    </Button>
  );
}
