export type HotkeyDefinition = {
  id: string;
  keys: string[];
  label: string;
  description: string;
  group: "Navigation" | "Live control" | "Emergency" | "Editor";
};

export const GLOBAL_HOTKEYS = [
  {
    id: "command-palette",
    keys: ["Ctrl", "K"],
    label: "Command palette",
    description: "Search pages and common actions.",
    group: "Navigation",
  },
  {
    id: "emergency-menu",
    keys: ["Ctrl", "Shift", "E"],
    label: "Emergency menu",
    description: "Open the global emergency panel.",
    group: "Emergency",
  },
  {
    id: "hotkeys-menu",
    keys: ["Shift", "?"],
    label: "Hotkey help",
    description: "Open this keyboard shortcut reference.",
    group: "Navigation",
  },
  {
    id: "alerts-pause",
    keys: ["Ctrl", "Alt", "P"],
    label: "Pause or resume alerts",
    description: "Toggle the alert queue between paused and live.",
    group: "Live control",
  },
  {
    id: "alerts-skip",
    keys: ["Ctrl", "Alt", "N"],
    label: "Skip current alert",
    description: "Move past the currently playing alert.",
    group: "Live control",
  },
  {
    id: "alerts-replay",
    keys: ["Ctrl", "Alt", "L"],
    label: "Replay last alert",
    description: "Fire the most recent alert again.",
    group: "Live control",
  },
  {
    id: "stop-sounds",
    keys: ["Ctrl", "Alt", "S"],
    label: "Stop sounds",
    description: "Silence currently playing overlay audio.",
    group: "Emergency",
  },
  {
    id: "hide-overlays",
    keys: ["Ctrl", "Alt", "H"],
    label: "Hide overlays",
    description: "Temporarily hide active overlay effects.",
    group: "Emergency",
  },
  {
    id: "reset-overlays",
    keys: ["Ctrl", "Alt", "R"],
    label: "Reset overlays",
    description: "Clear temporary overlay state.",
    group: "Emergency",
  },
] satisfies HotkeyDefinition[];

export function formatHotkey(keys: readonly string[]): string {
  return keys.join(" ");
}

export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

export function matchesHotkey(event: KeyboardEvent, keys: readonly string[]): boolean {
  const keySet = new Set(keys.map((key) => key.toLowerCase()));
  const expectedKey = keys[keys.length - 1]?.toLowerCase();
  if (!expectedKey) return false;
  return (
    event.key.toLowerCase() === expectedKey &&
    event.ctrlKey === keySet.has("ctrl") &&
    event.altKey === keySet.has("alt") &&
    event.shiftKey === keySet.has("shift") &&
    event.metaKey === keySet.has("meta")
  );
}
