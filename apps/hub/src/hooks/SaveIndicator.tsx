import { useId } from "react";
import { useRegisterSaveStatus } from "../context/SaveStatusContext";
import type { SaveStatus } from "./useAutoSave";

export function SaveIndicator({ status, label = "Changes" }: { status: SaveStatus; label?: string }) {
  const id = useId();
  useRegisterSaveStatus(id, label, status);

  if (status === "idle") return null;
  const text = status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save failed";
  return (
    <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 8 }}>{text}</span>
  );
}
