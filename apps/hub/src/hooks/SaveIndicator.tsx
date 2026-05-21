import type { SaveStatus } from "./useAutoSave";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const label =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save failed";
  return (
    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{label}</span>
  );
}
