import type { MacroStep } from "../../api";

export function timeAgo(value?: string) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function macroStepLabel(step: MacroStep): string {
  switch (step.type) {
    case "wait":
      return `Wait ${step.durationMs}ms`;
    case "obs_scene":
      return `Scene ${step.sceneName}`;
    case "obs_source_visibility":
      return `${step.visible ? "Show" : "Hide"} ${step.sourceName}`;
    case "obs_source_motion":
      return `Move ${step.sourceName} (${step.mode ?? "set"})`;
    case "obs_text":
      return `Text ${step.inputName}`;
    case "obs_stream_start":
      return "Start stream";
    case "obs_stream_stop":
      return "Stop stream";
    case "obs_record_start":
      return "Start recording";
    case "obs_record_stop":
      return "Stop recording";
    case "obs_record_pause":
      return "Pause recording";
    case "obs_record_resume":
      return "Resume recording";
    case "obs_replay_buffer_start":
      return "Start replay buffer";
    case "obs_replay_buffer_stop":
      return "Stop replay buffer";
    case "obs_replay_buffer_save":
      return "Save replay";
    case "obs_filter":
      return `${step.enabled ? "Enable" : "Disable"} filter ${step.filterName}`;
    case "twitch_chat":
      return "Send Twitch chat";
    case "run_command":
      return `Run ${step.command}`;
    case "effect":
      return `Effect ${step.effectId}`;
    case "clear_alerts":
      return "Clear alerts";
    case "session_start":
      return "Start session";
    case "session_stop":
      return "Stop session";
    default:
      return "Unknown step";
  }
}
