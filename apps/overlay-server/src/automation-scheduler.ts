import {
  getAutomation,
  getAutomations,
  getSetting,
  upsertAutomation,
  type AutomationConfig,
} from "./db.js";
import type { MacroRunner } from "./macro-runner.js";
import type { EffectRunner } from "./effect-runner.js";
import { runLocalCommand } from "./command-runner.js";
import { sendTwitchChatMessage } from "./twitch-service.js";

export type AutomationExecutor = (automation: AutomationConfig) => Promise<string>;

const MIN_INTERVAL_MS = 5_000;

export class AutomationScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = new Set<string>();

  constructor(
    private readonly macros: MacroRunner,
    private readonly effects: EffectRunner,
    private readonly applySourceGroup: (id: string) => Promise<{ ok: boolean; message: string }>,
  ) {}

  startAll(): void {
    for (const automation of getAutomations()) {
      this.schedule(automation, automation.runOnStart ? 250 : undefined);
    }
  }

  reschedule(id: string): void {
    this.clear(id);
    const automation = getAutomation(id);
    if (automation) this.schedule(automation);
  }

  clear(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  stopAll(): void {
    for (const id of this.timers.keys()) this.clear(id);
  }

  async runNow(id: string): Promise<{ ok: boolean; message: string }> {
    const automation = getAutomation(id);
    if (!automation) return { ok: false, message: "Automation not found" };
    return this.runAutomation(automation);
  }

  private schedule(automation: AutomationConfig, delayOverride?: number): void {
    this.clear(automation.id);
    if (!automation.enabled) return;

    const intervalMs = Math.max(MIN_INTERVAL_MS, Number(automation.intervalMs || MIN_INTERVAL_MS));
    const delay = delayOverride ?? intervalMs;
    const nextRunAt = new Date(Date.now() + delay).toISOString();
    upsertAutomation({ ...automation, intervalMs, nextRunAt });

    const timer = setTimeout(() => {
      void this.runAutomationById(automation.id);
    }, delay);
    this.timers.set(automation.id, timer);
  }

  private async runAutomationById(id: string): Promise<void> {
    const automation = getAutomation(id);
    if (!automation) return;
    await this.runAutomation(automation);
    const latest = getAutomation(id);
    if (latest) this.schedule(latest);
  }

  private async runAutomation(automation: AutomationConfig): Promise<{ ok: boolean; message: string }> {
    if (getSetting("automations_disabled") === "1") {
      return { ok: false, message: "Automations are disabled" };
    }
    if (this.running.has(automation.id)) {
      return { ok: false, message: "Automation already running" };
    }

    this.running.add(automation.id);
    const now = new Date().toISOString();
    upsertAutomation({ ...automation, lastStatus: "running", lastRunAt: now });

    try {
      const message = await this.execute(automation);
      const updated = getAutomation(automation.id) ?? automation;
      upsertAutomation({
        ...updated,
        lastRunAt: now,
        runCount: updated.runCount + 1,
        lastStatus: "ok",
        lastMessage: message,
      });
      return { ok: true, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Automation failed";
      const updated = getAutomation(automation.id) ?? automation;
      upsertAutomation({
        ...updated,
        lastRunAt: now,
        runCount: updated.runCount + 1,
        lastStatus: "failed",
        lastMessage: message,
      });
      return { ok: false, message };
    } finally {
      this.running.delete(automation.id);
    }
  }

  private async execute(automation: AutomationConfig): Promise<string> {
    const config = automation.actionConfig;
    switch (automation.action) {
      case "macro": {
        const id = String(config.macroId ?? "");
        const result = await this.macros.run(id);
        if (!result.ok) throw new Error(result.message);
        return result.message;
      }
      case "effect": {
        const id = String(config.effectId ?? "");
        const ok = await this.effects.fireManual(id);
        if (!ok) throw new Error("Effect missing, blocked, or failed");
        return `Effect ${id} fired`;
      }
      case "source_group": {
        const id = String(config.sourceGroupId ?? "");
        const result = await this.applySourceGroup(id);
        if (!result.ok) throw new Error(result.message);
        return result.message;
      }
      case "command": {
        return runLocalCommand({
          command: String(config.command ?? ""),
          args: Array.isArray(config.args) ? config.args.map(String) : undefined,
          cwd: config.cwd ? String(config.cwd) : undefined,
          timeoutMs: Number(config.timeoutMs ?? 10_000),
        });
      }
      case "twitch_chat": {
        const message = String(config.message ?? "");
        if (!message.trim()) throw new Error("Chat message is required");
        const ok = await sendTwitchChatMessage(message);
        if (!ok) throw new Error("Twitch chat was not sent");
        return "Twitch chat sent";
      }
      default:
        throw new Error("Unsupported automation action");
    }
  }
}
