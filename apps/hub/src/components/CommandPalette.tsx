import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { GLOBAL_HOTKEYS, matchesHotkey } from "../lib/hotkeys";
import { overlayUrl } from "../lib/serverUrls";

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

function fuzzyScore(command: Command, needle: string): number {
  if (!needle) return 1;
  const haystack = `${command.label} ${command.description} ${command.group} ${command.keywords}`.toLowerCase();
  const label = command.label.toLowerCase();
  if (label === needle) return 1000;
  if (label.startsWith(needle)) return 850;
  if (label.includes(needle)) return 700;
  if (haystack.includes(needle)) return 550;

  let score = 0;
  let cursor = 0;
  for (const char of needle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return 0;
    score += index === cursor ? 12 : 5;
    cursor = index + 1;
  }
  return score;
}

const NAV_COMMANDS: Command[] = [
  { id: "nav-dashboard", label: "Dashboard", description: "Live readiness and stream controls", group: "Live", keywords: "home live health readiness", kind: "navigate", path: "/" },
  { id: "nav-activity", label: "Activity", description: "Recent Twitch and overlay events", group: "Live", keywords: "events feed recent", kind: "navigate", path: "/activity" },
  { id: "nav-overlays", label: "Browser sources", description: "OBS URLs, positioning, and overlay packs", group: "Overlays", keywords: "obs browser source layout position", kind: "navigate", path: "/overlays" },
  { id: "nav-widgets", label: "Widgets", description: "Chat, goals, ticker, event list, and now playing", group: "Overlays", keywords: "chat goals ticker event list spotify", kind: "navigate", path: "/widgets" },
  { id: "nav-alerts", label: "Alert projects", description: "Choose a visual alert project", group: "Alerts", keywords: "visual editor cinematic", kind: "navigate", path: "/alerts" },
  { id: "nav-alert-routing", label: "Alert routing", description: "Test alerts and map events to projects", group: "Alerts", keywords: "rules tests sounds", kind: "navigate", path: "/alerts/routing" },
  { id: "nav-interactive", label: "Interactive", description: "Interactive effects and live triggers", group: "Automation", keywords: "effects triggers tentacles", kind: "navigate", path: "/interactive" },
  { id: "nav-tournament", label: "Tournament", description: "Live tournament scoreboard controls", group: "Automation", keywords: "scoreboard score match teams bracket", kind: "navigate", path: "/tournament" },
  { id: "nav-predictions", label: "Predictions", description: "Live prediction and voting controls", group: "Automation", keywords: "poll vote prediction winner reveal", kind: "navigate", path: "/predictions" },
  { id: "nav-boss-fight", label: "Boss Fight", description: "Live boss health bar and damage controls", group: "Automation", keywords: "raid boss hp damage heal phase shield", kind: "navigate", path: "/boss-fight" },
  { id: "nav-chat-chaos", label: "Chat Chaos", description: "Live chat chaos meter controls", group: "Automation", keywords: "energy hype meter chaos chat meltdown", kind: "navigate", path: "/chat-chaos" },
  { id: "nav-soundboard", label: "Soundboard", description: "Create and test reusable sound buttons", group: "Automation", keywords: "audio sounds effects buttons stream deck mobile", kind: "navigate", path: "/soundboard" },
  { id: "nav-channel-points", label: "Channel Points", description: "Reward-to-effect library", group: "Automation", keywords: "twitch rewards redemptions channel points effects", kind: "navigate", path: "/channel-points" },
  { id: "nav-recaps", label: "Stream Recaps", description: "Generate stream summaries from session analytics", group: "Automation", keywords: "session recap summary analytics markdown export", kind: "navigate", path: "/recaps" },
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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const navigate = useNavigate();
  const toast = useToast();
  const openHotkey = GLOBAL_HOTKEYS.find((hotkey) => hotkey.id === "command-palette")!;

  const commands = useMemo<Command[]>(
    () => [
      ...NAV_COMMANDS,
      {
        id: "action-test-follow-alert",
        label: "Test follow alert",
        description: "Fire a sample follow alert into OBS",
        group: "Alerts",
        keywords: "obs browser source visual alert manual test",
        kind: "action",
        run: async () => {
          await api.testVisualAlert("follow");
          toast({ message: "Test follow alert sent", tone: "success" });
        },
      },
      {
        id: "action-test-sub-alert",
        label: "Test sub alert",
        description: "Fire a sample subscription alert into OBS",
        group: "Alerts",
        keywords: "obs browser source visual alert manual test subscriber",
        kind: "action",
        run: async () => {
          await api.testVisualAlert("sub");
          toast({ message: "Test sub alert sent", tone: "success" });
        },
      },
      {
        id: "action-copy-alerts-url",
        label: "Copy alerts browser source URL",
        description: "Copy the OBS browser source URL for visual alerts",
        group: "Overlays",
        keywords: "copy obs browser source alerts url",
        kind: "action",
        run: async () => {
          await navigator.clipboard.writeText(overlayUrl("/o/alerts.html"));
          toast({ message: "Alerts browser source URL copied", tone: "success" });
        },
      },
      {
        id: "action-clear-alert-queue",
        label: "Clear alert queue",
        description: "Remove queued alerts and clear the current alert",
        group: "Alerts",
        keywords: "panic queue clear current",
        kind: "action",
        run: async () => {
          const res = await api.clearAlertQueue();
          toast({ message: `Cleared ${res.cleared} queued alert${res.cleared === 1 ? "" : "s"}`, tone: "success" });
        },
      },
      {
        id: "action-replay-last-alert",
        label: "Replay last alert",
        description: "Replay the most recent alert",
        group: "Alerts",
        keywords: "repeat last test obs browser source",
        kind: "action",
        run: async () => {
          await api.replayLastAlert();
          toast({ message: "Last alert replay requested", tone: "success" });
        },
      },
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
      {
        id: "action-reset-overlays",
        label: "Reset overlays",
        description: "Clear temporary overlay state and show overlays again",
        group: "Emergency",
        keywords: "panic restore show clear state",
        kind: "action",
        run: async () => {
          const res = await api.emergencyAction("reset-overlays");
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
      .map((command) => ({ command, score: fuzzyScore(command, needle) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
      .map((entry) => entry.command);
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesHotkey(event, openHotkey.keys)) {
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
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    triggerRef.current?.focus();
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

    try {
      await command.run?.();
      setOpen(false);
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : "Command failed", tone: "error" });
    }
  };

  const activeCommand = filteredCommands[activeIndex];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="command-palette-trigger"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
      >
        <span>Command</span>
        <kbd>{openHotkey.keys.join(" ")}</kbd>
      </button>

      {open ? (
        <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <button type="button" className="command-palette__backdrop" aria-label="Close command palette" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="command-palette__panel"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                panelRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              );
              if (!focusable.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
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
