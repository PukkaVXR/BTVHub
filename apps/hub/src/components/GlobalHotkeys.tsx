import { useEffect, useRef } from "react";
import { api } from "../api";
import { useAppHealth } from "../context/AppHealthContext";
import { useToast } from "../hooks/useToast";
import { GLOBAL_HOTKEYS, isEditableHotkeyTarget, matchesHotkey } from "../lib/hotkeys";

const ACTION_HOTKEYS = GLOBAL_HOTKEYS.filter((hotkey) =>
  ["alerts-pause", "alerts-skip", "alerts-replay", "stop-sounds", "hide-overlays", "reset-overlays"].includes(hotkey.id),
);

export function GlobalHotkeys() {
  const { preflight, refresh } = useAppHealth();
  const toast = useToast();
  const preflightRef = useRef(preflight);
  const runningRef = useRef(false);

  useEffect(() => {
    preflightRef.current = preflight;
  }, [preflight]);

  useEffect(() => {
    const runAction = async (id: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        switch (id) {
          case "alerts-pause": {
            const res = preflightRef.current?.alerts.paused ? await api.resumeAlertQueue() : await api.pauseAlertQueue();
            toast({ message: res.queue.paused ? "Alert queue paused" : "Alert queue resumed", tone: "success" });
            break;
          }
          case "alerts-skip": {
            const res = await api.skipCurrentAlert();
            toast({ message: res.ok ? "Skipped current alert" : "No alert is currently playing", tone: res.ok ? "success" : "info" });
            break;
          }
          case "alerts-replay": {
            const res = await api.replayLastAlert();
            toast({ message: res.ok ? "Replayed last alert" : "No previous alert to replay", tone: res.ok ? "success" : "info" });
            break;
          }
          case "stop-sounds":
          case "hide-overlays":
          case "reset-overlays": {
            const res = await api.emergencyAction(id);
            toast({ message: res.ok ? res.title : res.message, tone: res.ok ? "success" : "error" });
            break;
          }
        }
        void refresh();
      } catch (err) {
        toast({ message: err instanceof Error ? err.message : "Hotkey action failed", tone: "error" });
      } finally {
        runningRef.current = false;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableHotkeyTarget(event.target)) return;
      const hotkey = ACTION_HOTKEYS.find((candidate) => matchesHotkey(event, candidate.keys));
      if (!hotkey) return;
      event.preventDefault();
      void runAction(hotkey.id);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [refresh, toast]);

  return null;
}
