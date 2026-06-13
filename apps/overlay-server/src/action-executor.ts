import type { AlertQueue } from "./alert-queue.js";
import { startStreamSession, stopCurrentStreamSession } from "./db.js";
import { runLocalCommand } from "./command-runner.js";
import {
  pauseObsRecording,
  resumeObsRecording,
  runObsSourceMotion,
  saveObsReplayBuffer,
  setObsInputMuted,
  setObsScene,
  setObsSourceFilterEnabled,
  setObsSourceVisible,
  setObsText,
  startObsRecording,
  startObsReplayBuffer,
  startObsStream,
  stopObsRecording,
  stopObsReplayBuffer,
  stopObsStream,
  type ObsSourceMotionConfig,
} from "./obs-client.js";
import { sendTwitchChatMessage } from "./twitch-service.js";

const MAX_WAIT_MS = 60 * 60_000;

export type SharedAction =
  | { type: "wait"; durationMs: number }
  | { type: "obs_scene"; sceneName: string }
  | { type: "obs_source_visibility"; sceneName: string; sourceName: string; visible: boolean }
  | ({ type: "obs_source_motion" } & ObsSourceMotionConfig)
  | { type: "obs_text"; inputName: string; text: string }
  | { type: "obs_filter"; sourceName: string; filterName: string; enabled: boolean }
  | { type: "obs_mute"; inputName: string; muted: boolean }
  | { type: "obs_recording"; action: "start" | "stop" | "pause" | "resume" }
  | { type: "obs_streaming"; action: "start" | "stop" }
  | { type: "obs_replay_buffer"; action: "start" | "stop" | "save" }
  | { type: "twitch_chat"; message: string }
  | { type: "command"; command: string; args?: string[]; cwd?: string; timeoutMs?: number }
  | { type: "clear_alerts" }
  | { type: "session_start"; title?: string }
  | { type: "session_stop" }
  | { type: "source_group"; sourceGroupId: string }
  | { type: "effect"; effectId: string }
  | { type: "macro"; macroId: string };

export interface SharedActionHooks {
  runMacro?: (id: string) => Promise<{ ok: boolean; message: string }>;
  fireEffect?: (id: string) => Promise<boolean>;
}

export interface SharedActionResult {
  ok: boolean;
  message: string;
  value?: unknown;
}

export class ActionExecutor {
  constructor(
    private readonly alertQueue: AlertQueue,
    private readonly applySourceGroup: (id: string) => Promise<{ ok: boolean; message: string }>,
  ) {}

  async execute(action: SharedAction, hooks: SharedActionHooks = {}): Promise<SharedActionResult> {
    switch (action.type) {
      case "wait": {
        const durationMs = Math.max(0, Math.min(action.durationMs, MAX_WAIT_MS));
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        return success(`Waited ${durationMs}ms`, durationMs);
      }
      case "obs_scene":
        return fromBoolean(await setObsScene(action.sceneName), `Scene: ${action.sceneName}`, `Scene failed: ${action.sceneName}`);
      case "obs_source_visibility":
        return fromBoolean(
          await setObsSourceVisible(action.sceneName, action.sourceName, action.visible),
          `${action.sourceName}: ${action.visible ? "visible" : "hidden"}`,
          `Source failed: ${action.sourceName}`,
        );
      case "obs_source_motion":
        return fromBoolean(
          await runObsSourceMotion(action),
          `${action.sourceName}: ${String(action.mode ?? "set")} motion complete`,
          `Motion failed: ${action.sourceName}`,
        );
      case "obs_text":
        return fromBoolean(await setObsText(action.inputName, action.text), `Text: ${action.inputName}`, `Text failed: ${action.inputName}`);
      case "obs_filter":
        return fromBoolean(
          await setObsSourceFilterEnabled(action.sourceName, action.filterName, action.enabled),
          `${action.filterName}: ${action.enabled ? "enabled" : "disabled"}`,
          `Filter failed: ${action.filterName}`,
        );
      case "obs_mute":
        return fromBoolean(
          await setObsInputMuted(action.inputName, action.muted),
          `${action.inputName}: ${action.muted ? "muted" : "unmuted"}`,
          `Mute failed: ${action.inputName}`,
        );
      case "obs_recording": {
        const ok = action.action === "start" ? await startObsRecording()
          : action.action === "stop" ? await stopObsRecording()
            : action.action === "pause" ? await pauseObsRecording() : await resumeObsRecording();
        return fromBoolean(ok, `Recording ${pastTense(action.action)}`, `Recording ${action.action} failed`);
      }
      case "obs_streaming": {
        const ok = action.action === "start" ? await startObsStream() : await stopObsStream();
        return fromBoolean(ok, `Stream ${action.action === "start" ? "started" : "stopped"}`, `Stream ${action.action} failed`);
      }
      case "obs_replay_buffer": {
        const ok = action.action === "start" ? await startObsReplayBuffer()
          : action.action === "stop" ? await stopObsReplayBuffer() : await saveObsReplayBuffer();
        const label = action.action === "save" ? "Replay saved" : `Replay buffer ${action.action === "start" ? "started" : "stopped"}`;
        const failureLabel = action.action === "save" ? "Replay save failed" : `Replay buffer ${action.action} failed`;
        return fromBoolean(ok, label, failureLabel);
      }
      case "twitch_chat":
        if (!action.message.trim()) return failure("Chat message is required");
        return fromBoolean(await sendTwitchChatMessage(action.message), "Twitch chat sent", "Twitch chat was not sent");
      case "command":
        return success(await runLocalCommand(action));
      case "clear_alerts": {
        const cleared = this.alertQueue.clear();
        return success(`Cleared ${cleared} queued alert(s)`, cleared);
      }
      case "session_start": {
        const session = startStreamSession(action.title);
        return success(`Session: ${session.title}`, session);
      }
      case "session_stop": {
        const session = stopCurrentStreamSession();
        return session ? success(`Stopped: ${session.title}`, session) : failure("No active session");
      }
      case "source_group":
        return this.applySourceGroup(action.sourceGroupId);
      case "effect": {
        if (!hooks.fireEffect) return failure("Effect executor unavailable");
        return fromBoolean(await hooks.fireEffect(action.effectId), `Effect: ${action.effectId}`, `Effect failed: ${action.effectId}`);
      }
      case "macro": {
        if (!hooks.runMacro) return failure("Macro executor unavailable");
        return hooks.runMacro(action.macroId);
      }
    }
  }
}

function success(message: string, value?: unknown): SharedActionResult {
  return { ok: true, message, value };
}

function failure(message: string): SharedActionResult {
  return { ok: false, message };
}

function fromBoolean(ok: boolean, successMessage: string, failureMessage: string): SharedActionResult {
  return ok ? success(successMessage) : failure(failureMessage);
}

function pastTense(action: "start" | "stop" | "pause" | "resume"): string {
  if (action === "start") return "started";
  if (action === "stop") return "stopped";
  if (action === "pause") return "paused";
  return "resumed";
}
