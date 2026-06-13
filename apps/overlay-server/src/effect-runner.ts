import { createStreamEvent, type StreamEvent } from "@btv/shared";
import { getAlertProject, getEffects, getSetting, getTheme } from "./db.js";
import type { OverlayBus } from "./bus.js";
import { resolveAlertProjectVariation } from "./alert-variations.js";
import { withAutomationVariables } from "./alert-template-vars.js";
import type { ActionExecutor } from "./action-executor.js";
import { matchChatCommand } from "./chat-command-utils.js";
import { renderTemplate } from "./template-utils.js";

type EffectType = "visual" | "soundboard" | "obs_scene" | "obs_transform" | "chat_message" | "alert" | "media" | "run_command";

function hasBadge(event: StreamEvent, roles: string[]): boolean {
  const badges = (event.payload.badges as Array<{ set_id: string }> | undefined) ?? [];
  return badges.some((b) => roles.includes(b.set_id));
}

function interpolate(template: string, event: StreamEvent, args: string): string {
  return renderTemplate(template, {
    user: event.user?.displayName ?? "Someone",
    displayName: event.user?.displayName ?? "Someone",
    login: event.user?.login ?? "viewer",
    args,
    command: String(event.payload.command ?? ""),
  });
}

export class EffectRunner {
  private lastFired = new Map<string, number>();
  private globalLast = 0;
  private readonly globalCooldownMs = 2000;

  constructor(
    private readonly bus: OverlayBus,
    private readonly actions: ActionExecutor,
  ) {}

  async tryTriggerFromEvent(event: StreamEvent): Promise<void> {
    if (event.type === "channel_points" && getSetting("channel_point_actions_disabled") === "1") return;
    const effects = getEffects().filter((e) => e.enabled);

    for (const effect of effects) {
      if (effect.triggerType === "channel_points" && event.type === "channel_points") {
        const rewardTitle = String(effect.triggerConfig.rewardTitle ?? "");
        const rewardId = String(effect.triggerConfig.rewardId ?? "");
        const matchMode = String(effect.triggerConfig.matchMode ?? "exact");

        if (rewardId && String(event.payload.rewardId ?? "") !== rewardId) continue;
        if (!rewardTitle && !rewardId) continue;
        if (rewardTitle) {
          const msg = event.message ?? "";
          if (matchMode === "contains") {
            if (!msg.toLowerCase().includes(rewardTitle.toLowerCase())) continue;
          } else if (msg !== rewardTitle) continue;
        }

        await this.fire(effect.id, effect.name, effect.type as EffectType, effect.effectConfig, effect.cooldownMs, event);
      }

      if (effect.triggerType === "chat_command" && event.type === "chat") {
        const command = String(effect.triggerConfig.command ?? "");
        const matchMode = String(effect.triggerConfig.matchMode ?? "startsWith");
        const { matched, args } = matchChatCommand(event.message ?? "", command, matchMode);
        if (!matched) continue;

        if (effect.triggerConfig.broadcasterOnly && !hasBadge(event, ["broadcaster"])) continue;
        if (effect.triggerConfig.modOnly && !hasBadge(event, ["moderator", "broadcaster"])) continue;
        if (effect.triggerConfig.vipOnly && !hasBadge(event, ["vip", "moderator", "broadcaster"])) continue;
        if (effect.triggerConfig.subscriberOnly) {
          const sub = (event.payload as { subscriber?: boolean }).subscriber;
          if (!sub && !hasBadge(event, ["subscriber"])) continue;
        }

        await this.fire(effect.id, effect.name, effect.type as EffectType, effect.effectConfig, effect.cooldownMs, event, args);
      }
    }
  }

  async fireManual(effectId: string): Promise<boolean> {
    const effect = getEffects().find((e) => e.id === effectId);
    if (!effect) return false;
    const testEvent = createStreamEvent({
      source: "manual",
      type: "chat",
      user: { id: "test", displayName: "TestUser", login: "testuser" },
      message: "!test",
      payload: { badges: [{ set_id: "broadcaster" }] },
    });
    return this.fire(
      effect.id,
      effect.name,
      effect.type as EffectType,
      effect.effectConfig,
      effect.cooldownMs,
      testEvent,
      "preview",
    );
  }

  private async fire(
    id: string,
    name: string,
    type: EffectType,
    config: Record<string, unknown>,
    cooldownMs: number,
    event?: StreamEvent,
    commandArgs = "",
  ): Promise<boolean> {
    const now = Date.now();
    const last = this.lastFired.get(id) ?? 0;
    if (now - last < cooldownMs) return false;
    if (now - this.globalLast < this.globalCooldownMs) return false;

    this.lastFired.set(id, now);
    this.globalLast = now;

    if (type === "chat_message") {
      const template = String(config.message ?? "Hello {user}!");
      const text = event ? interpolate(template, event, commandArgs) : template;
      const displayName = String(config.displayName ?? "Channel");
      const color = config.color ? String(config.color) : undefined;
      this.bus.broadcast(
        {
          kind: "chat:message",
          message: {
            id: crypto.randomUUID(),
            user: {
              id: "btv-effect",
              displayName,
              login: "btv",
            },
            text,
            color,
            at: new Date().toISOString(),
          },
        },
        "chat",
      );
      return true;
    }

    if (type === "alert" && event) {
      const themeId = String(config.themeId ?? "default");
      const rawVisualProject = getAlertProject(themeId) ?? getAlertProject(`alert-${themeId}`) ?? undefined;
      const theme = getTheme(themeId) ?? getTheme("default");
      if (!theme && !rawVisualProject) return false;
      const alertEvent = withAutomationVariables(createStreamEvent({
        source: "manual",
        type: (config.eventType as StreamEvent["type"]) ?? "channel_points",
        user: event.user,
        message: config.message
          ? interpolate(String(config.message), event, commandArgs)
          : event.message,
        amount: event.amount,
        payload: event.payload,
      }));
      const soundAsset = config.soundAsset ? String(config.soundAsset) : undefined;
      const visualProject = rawVisualProject ? resolveAlertProjectVariation(rawVisualProject, alertEvent).project : undefined;
      this.bus.broadcast(
        {
          kind: "alert:play",
          alert: {
            id: crypto.randomUUID(),
            event: alertEvent,
            themeId: visualProject?.id ?? theme!.id,
            html: theme?.html ?? "",
            css: theme?.css ?? "",
            js: theme?.js ?? "",
            soundUrl: soundAsset ? `/assets/${soundAsset.replace(/^\//, "")}` : undefined,
            durationMs: visualProject?.durationMs ?? theme?.durationMs ?? 5000,
            visualProject,
          },
        },
        "alerts",
      );
      return true;
    }

    if (type === "media") {
      const playConfig = { ...config };
      const asset = String(config.mediaAsset ?? "").replace(/^\//, "");
      if (!playConfig.mediaUrl && asset) {
        playConfig.mediaUrl = asset.startsWith("media/")
          ? `/assets/${asset}`
          : `/assets/media/${asset.replace(/^media\//, "")}`;
      }
      this.bus.broadcast(
        {
          kind: "effect:play",
          effect: { id, type, name, config: playConfig },
        },
        "effects",
      );
      return true;
    }

    const playConfig = { ...config };
    if (type === "soundboard") {
      const asset = String(config.soundAsset ?? "").replace(/^\//, "");
      if (asset && !playConfig.soundUrl) {
        playConfig.soundUrl = `/assets/${asset}`;
      }
    }

    this.bus.broadcast(
      {
        kind: "effect:play",
        effect: { id, type, name, config: playConfig },
      },
      "effects",
    );

    if (type === "obs_scene" && config.sceneName) {
      return (await this.actions.execute({ type: "obs_scene", sceneName: String(config.sceneName) })).ok;
    }

    if (type === "obs_transform") {
      return (await this.actions.execute({
        type: "obs_source_motion",
        ...config,
        sceneName: String(config.sceneName ?? ""),
        sourceName: String(config.sourceName ?? ""),
        mode: (config.mode as "set" | "dvd" | "path" | undefined) ?? "dvd",
      })).ok;
    }

    if (type === "run_command") {
      const result = await this.actions.execute({
        type: "command",
        command: String(config.command ?? ""),
        args: Array.isArray(config.args) ? config.args.map(String) : undefined,
        cwd: config.cwd ? String(config.cwd) : undefined,
        timeoutMs: Number(config.timeoutMs ?? 10_000),
      });
      if (!result.ok) return false;
      if (config.successChatMessage) {
        const msg = event
          ? interpolate(String(config.successChatMessage), event, commandArgs)
          : String(config.successChatMessage);
        const chatResult = await this.actions.execute({ type: "twitch_chat", message: msg });
        if (!chatResult.ok) return false;
      }
      return true;
    }

    return true;
  }
}
