import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useToast } from "../hooks/useToast";

type CommandKind = "navigate" | "action";

interface Command {
  id: string;
  label: string;
  description: string;
  group: string;
  keywords: string;
  kind: CommandKind;
  path?: string;
  run?: () => Promise<void>;
}

const NAV_COMMANDS: Command[] = [
  { id: "nav-dashboard", label: "Dashboard", description: "Live readiness and stream controls", group: "Live", keywords: "home live health readiness", kind: "navigate", path: "/" },
  { id: "nav-activity", label: "Activity", description: "Recent Twitch and overlay events", group: "Live", keywords: "events feed recent", kind: "navigate", path: "/activity" },
  { id: "nav-overlays", label: "Browser sources", description: "OBS URLs, positioning, and overlay packs", group: "Overlays", keywords: "obs browser source layout position", kind: "navigate", path: "/overlays" },
  { id: "nav-widgets", label: "Widgets", description: "Chat, goals, ticker, event list, and now playing", group: "Overlays", keywords: "chat goals ticker event list spotify", kind: "navigate", path: "/widgets" },
  { id: "nav-alerts", label: "Alert projects", description: "Choose a visual alert project", group: "Alerts", keywords: "visual editor cinematic", kind: "navigate", path: "/alerts" },
  { id: "nav-alert-routing", label: "Alert routing", description: "Test alerts and map events to projects", group: "Alerts", keywords: "rules tests sounds", kind: "navigate", path: "/alerts/routing" },
  { id: "nav-interactive", label: "Interactive", description: "Interactive effects and live triggers", group: "Automation", keywords: "effects triggers tentacles", kind: "navigate", path: "/interactive" },
  { id: "nav-automations", label: "Automations", description: "Event rules and scheduled automations", group: "Automation", keywords: "rules timers scheduled", kind: "navigate", path: "/automations" },
  { id: "nav-macros", label: "Macros", description: "Ordered actions for OBS, Twitch, and effects", group: "Automation", keywords: "actions stream deck sequence", kind: "navigate", path: "/macros" },
  { id: "nav-webhooks", label: "Webhooks", description: "External trigger URLs and logs", group: "Automation", keywords: "api external triggers", kind: "navigate", path: "/webhooks" },
  { id: "nav-stream-deck", label: "Stream Deck", description: "Stream Deck endpoints and shortcuts", group: "Automation", keywords: "api ninja buttons", kind: "navigate", path: "/stream-deck" },
  { id: "nav-integrations", label: "Integrations", description: "Twitch, OBS, Spotify, and GIPHY", group: "Settings", keywords: "oauth websocket connect", kind: "navigate", path: "/integrations" },
  { id: "nav-setup", label: "Setup", description: "First-run setup and test buttons", group: "Settings", keywords: "wizard onboarding", kind: "navigate", path: "/setup" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const commands = useMemo<Command[]>(
    () => [
      ...NAV_COMMANDS,
      {
        id: "action-stop-sounds",
        label: "Stop sounds",
        description: "Emergency action: stop currently playing alert audio",
        group: "Emergency",
        keywords: "panic audio mute silence",
        kind: "action",
        run: async () => {
          const res = await api.emergencyAction("stop-sounds");
          toast({ message: res.ok ? res.title : res.message, tone: res.ok ? "success" : "error" });
        },
      },
      {
        id: "action-hide-overlays",
        label: "Hide overlays",
        description: "Emergency action: hide active overlay effects",
        group: "Emergency",
        keywords: "panic clear hide effects",
        kind: "action",
        run: async () => {
          const res = await api.emergencyAction("hide-overlays");
          toast({ message: res.ok ? res.title : res.message, tone: res.ok ? "success" : "error" });
        },
      },
    ],
    [toast],
  );

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands
      .filter((command) =>
        `${command.label} ${command.description} ${command.group} ${command.keywords}`.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aExact = aLabel === needle ? 0 : aLabel.startsWith(needle) ? 1 : aLabel.includes(needle) ? 2 : 3;
        const bExact = bLabel === needle ? 0 : bLabel.startsWith(needle) ? 1 : bLabel.includes(needle) ? 2 : 3;
        return aExact - bExact || a.label.localeCompare(b.label);
      });
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runCommand = async (command: Command) => {
    if (command.kind === "navigate" && command.path) {
      navigate(command.path);
      setOpen(false);
      return;
    }

    await command.run?.();
    setOpen(false);
  };

  const activeCommand = filteredCommands[activeIndex];

  return (
    <>
      <button type="button" className="command-palette-trigger" onClick={() => setOpen(true)}>
        <span>Command</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open ? (
        <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <button type="button" className="command-palette__backdrop" aria-label="Close command palette" onClick={() => setOpen(false)} />
          <div className="command-palette__panel">
            <label className="command-palette__search">
              <span>Search commands</span>
              <input
                ref={inputRef}
                value={query}
                placeholder="Jump to overlays, stop sounds, open integrations..."
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(index + 1, filteredCommands.length - 1));
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  }
                  if (event.key === "Enter" && activeCommand) {
                    event.preventDefault();
                    void runCommand(activeCommand);
                  }
                }}
              />
            </label>

            <div className="command-palette__list" role="listbox" aria-label="Commands">
              {filteredCommands.length ? (
                filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    type="button"
                    className={`command-palette__item${index === activeIndex ? " command-palette__item--active" : ""}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void runCommand(command)}
                  >
                    <span>
                      <strong>{command.label}</strong>
                      <small>{command.description}</small>
                    </span>
                    <em>{command.group}</em>
                  </button>
                ))
              ) : (
                <div className="command-palette__empty">No commands found.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
