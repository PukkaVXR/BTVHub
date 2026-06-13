import { getMacro, type MacroStep } from "./db.js";
import type { EffectRunner } from "./effect-runner.js";
import type { ActionExecutor, SharedAction } from "./action-executor.js";

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

export class MacroRunner {
  constructor(
    private readonly actions: ActionExecutor,
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
        case "wait": return this.runShared(step, index, { type: "wait", durationMs: Number(step.durationMs ?? 0) });
        case "obs_scene": return this.runShared(step, index, step);
        case "obs_source_visibility": return this.runShared(step, index, step);
        case "obs_source_motion": return this.runShared(step, index, step);
        case "obs_text": return this.runShared(step, index, step);
        case "obs_stream_start": return this.runShared(step, index, { type: "obs_streaming", action: "start" });
        case "obs_stream_stop": return this.runShared(step, index, { type: "obs_streaming", action: "stop" });
        case "obs_record_start": return this.runShared(step, index, { type: "obs_recording", action: "start" });
        case "obs_record_stop": return this.runShared(step, index, { type: "obs_recording", action: "stop" });
        case "obs_record_pause": return this.runShared(step, index, { type: "obs_recording", action: "pause" });
        case "obs_record_resume": return this.runShared(step, index, { type: "obs_recording", action: "resume" });
        case "obs_replay_buffer_start": return this.runShared(step, index, { type: "obs_replay_buffer", action: "start" });
        case "obs_replay_buffer_stop": return this.runShared(step, index, { type: "obs_replay_buffer", action: "stop" });
        case "obs_replay_buffer_save": return this.runShared(step, index, { type: "obs_replay_buffer", action: "save" });
        case "obs_filter": return this.runShared(step, index, step);
        case "twitch_chat": {
          const result = await this.actions.execute(step);
          return { index, type: step.type, ok: result.ok, message: result.ok ? result.message : "Twitch chat blocked" };
        }
        case "run_command": {
          const result = await this.actions.execute({
            type: "command",
            command: step.command,
            args: step.args,
            cwd: step.cwd,
            timeoutMs: step.timeoutMs,
          });
          if (!result.ok) return { index, type: step.type, ok: false, message: result.message };
          if (step.successChatMessage) {
            await this.actions.execute({ type: "twitch_chat", message: step.successChatMessage });
          }
          return { index, type: step.type, ok: true, message: result.message };
        }
        case "effect": {
          return this.runShared(step, index, step);
        }
        case "clear_alerts": return this.runShared(step, index, step);
        case "session_start": return this.runShared(step, index, step);
        case "session_stop": return this.runShared(step, index, step);
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

  private async runShared(step: MacroStep, index: number, action: SharedAction): Promise<MacroStepResult> {
    const result = await this.actions.execute(action, { fireEffect: (id) => this.effectRunner.fireManual(id) });
    return { index, type: step.type, ok: result.ok, message: result.message };
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
