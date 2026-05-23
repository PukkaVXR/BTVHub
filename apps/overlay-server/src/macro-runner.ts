import type { AlertQueue } from "./alert-queue.js";
import { getMacro, startStreamSession, stopCurrentStreamSession, type MacroStep } from "./db.js";
import type { EffectRunner } from "./effect-runner.js";
import {
  pauseObsRecording,
  resumeObsRecording,
  runObsSourceMotion,
  saveObsReplayBuffer,
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
} from "./obs-client.js";
import { sendTwitchChatMessage } from "./twitch-service.js";
import { runLocalCommand } from "./command-runner.js";

export interface MacroStepResult {
  index: number;
  type: MacroStep["type"];
  ok: boolean;
  message: string;
}

export interface MacroRunResult {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  color: string;
  icon: string;
  retryable: boolean;
  steps: MacroStepResult[];
}

const MAX_WAIT_MS = 60 * 60_000;
function clampWaitMs(ms: number): number {
  return Math.max(0, Math.min(ms, MAX_WAIT_MS));
}

function wait(ms: number): Promise<number> {
  const durationMs = clampWaitMs(ms);
  return new Promise((resolve) => setTimeout(() => resolve(durationMs), durationMs));
}

export class MacroRunner {
  constructor(
    private readonly alertQueue: AlertQueue,
    private readonly effectRunner: EffectRunner,
  ) {}

  async run(macroId: string): Promise<MacroRunResult> {
    const macro = getMacro(macroId);
    if (!macro) return this.failure("MACRO_NOT_FOUND", "Macro Missing", "No macro exists with that id", []);
    if (!macro.enabled) return this.failure("MACRO_DISABLED", "Macro Disabled", macro.name, []);

    const results: MacroStepResult[] = [];
    for (let index = 0; index < macro.steps.length; index += 1) {
      const step = macro.steps[index]!;
      const result = await this.runStep(step, index);
      results.push(result);
      if (!result.ok) {
        return this.failure("MACRO_STEP_FAILED", "Macro Stopped", result.message, results);
      }
    }

    return {
      ok: true,
      code: "MACRO_RUN",
      title: "Macro Complete",
      message: macro.name,
      color: "#00f593",
      icon: "check",
      retryable: false,
      steps: results,
    };
  }

  private async runStep(step: MacroStep, index: number): Promise<MacroStepResult> {
    try {
      switch (step.type) {
        case "wait":
          return {
            index,
            type: step.type,
            ok: true,
            message: `Waited ${await wait(Number(step.durationMs ?? 0))}ms`,
          };
        case "obs_scene": {
          const ok = await setObsScene(step.sceneName);
          return { index, type: step.type, ok, message: ok ? `Scene: ${step.sceneName}` : `Scene failed: ${step.sceneName}` };
        }
        case "obs_source_visibility": {
          const ok = await setObsSourceVisible(step.sceneName, step.sourceName, step.visible);
          return {
            index,
            type: step.type,
            ok,
            message: ok
              ? `${step.sourceName}: ${step.visible ? "visible" : "hidden"}`
              : `Source failed: ${step.sourceName}`,
          };
        }
        case "obs_source_motion": {
          const ok = await runObsSourceMotion(step);
          return {
            index,
            type: step.type,
            ok,
            message: ok
              ? `${step.sourceName}: ${step.mode ?? "set"} motion complete`
              : `Motion failed: ${step.sourceName}`,
          };
        }
        case "obs_text": {
          const ok = await setObsText(step.inputName, step.text);
          return { index, type: step.type, ok, message: ok ? `Text: ${step.inputName}` : `Text failed: ${step.inputName}` };
        }
        case "obs_stream_start": {
          const ok = await startObsStream();
          return { index, type: step.type, ok, message: ok ? "Stream started" : "Stream start failed" };
        }
        case "obs_stream_stop": {
          const ok = await stopObsStream();
          return { index, type: step.type, ok, message: ok ? "Stream stopped" : "Stream stop failed" };
        }
        case "obs_record_start": {
          const ok = await startObsRecording();
          return { index, type: step.type, ok, message: ok ? "Recording started" : "Recording start failed" };
        }
        case "obs_record_stop": {
          const ok = await stopObsRecording();
          return { index, type: step.type, ok, message: ok ? "Recording stopped" : "Recording stop failed" };
        }
        case "obs_record_pause": {
          const ok = await pauseObsRecording();
          return { index, type: step.type, ok, message: ok ? "Recording paused" : "Recording pause failed" };
        }
        case "obs_record_resume": {
          const ok = await resumeObsRecording();
          return { index, type: step.type, ok, message: ok ? "Recording resumed" : "Recording resume failed" };
        }
        case "obs_replay_buffer_start": {
          const ok = await startObsReplayBuffer();
          return { index, type: step.type, ok, message: ok ? "Replay buffer started" : "Replay buffer start failed" };
        }
        case "obs_replay_buffer_stop": {
          const ok = await stopObsReplayBuffer();
          return { index, type: step.type, ok, message: ok ? "Replay buffer stopped" : "Replay buffer stop failed" };
        }
        case "obs_replay_buffer_save": {
          const ok = await saveObsReplayBuffer();
          return { index, type: step.type, ok, message: ok ? "Replay saved" : "Replay save failed" };
        }
        case "obs_filter": {
          const ok = await setObsSourceFilterEnabled(step.sourceName, step.filterName, step.enabled);
          return {
            index,
            type: step.type,
            ok,
            message: ok
              ? `${step.filterName}: ${step.enabled ? "enabled" : "disabled"}`
              : `Filter failed: ${step.filterName}`,
          };
        }
        case "twitch_chat": {
          const ok = await sendTwitchChatMessage(step.message);
          return { index, type: step.type, ok, message: ok ? "Twitch chat sent" : "Twitch chat blocked" };
        }
        case "run_command": {
          const output = await runLocalCommand(step);
          if (step.successChatMessage) {
            await sendTwitchChatMessage(step.successChatMessage);
          }
          return { index, type: step.type, ok: true, message: output };
        }
        case "effect": {
          const ok = await this.effectRunner.fireManual(step.effectId);
          return { index, type: step.type, ok, message: ok ? `Effect: ${step.effectId}` : `Effect failed: ${step.effectId}` };
        }
        case "clear_alerts": {
          const cleared = this.alertQueue.clear();
          return { index, type: step.type, ok: true, message: `Cleared ${cleared} queued alert(s)` };
        }
        case "session_start": {
          const session = startStreamSession(step.title);
          return { index, type: step.type, ok: true, message: `Session: ${session.title}` };
        }
        case "session_stop": {
          const session = stopCurrentStreamSession();
          return { index, type: step.type, ok: Boolean(session), message: session ? `Stopped: ${session.title}` : "No active session" };
        }
        default:
          return { index, type: "wait", ok: false, message: "Unsupported macro step" };
      }
    } catch (err) {
      return {
        index,
        type: step.type,
        ok: false,
        message: err instanceof Error ? err.message : "Step failed",
      };
    }
  }

  private failure(
    code: string,
    title: string,
    message: string,
    steps: MacroStepResult[],
  ): MacroRunResult {
    return {
      ok: false,
      code,
      title,
      message,
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: code === "MACRO_STEP_FAILED",
      steps,
    };
  }
}
