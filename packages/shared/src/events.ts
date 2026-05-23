import { z } from "zod";

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const EventSourceSchema = z.enum([
  "twitch",
  "webhook",
  "manual",
  "spotify",
]);

export const StreamEventTypeSchema = z.enum([
  "follow",
  "sub",
  "resub",
  "gift_sub",
  "cheer",
  "raid",
  "channel_points",
  "chat",
  "goal_milestone",
  "effect",
  "unknown",
]);

export const StreamUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  login: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export const StreamEventSchema = z.object({
  id: z.string(),
  source: EventSourceSchema,
  type: StreamEventTypeSchema,
  user: StreamUserSchema.optional(),
  message: z.string().optional(),
  amount: z.number().optional(),
  tier: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  at: z.string(),
});

export type EventSource = z.infer<typeof EventSourceSchema>;
export type StreamEventType = z.infer<typeof StreamEventTypeSchema>;
export type StreamUser = z.infer<typeof StreamUserSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const BusMessageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("alert:play"),
    alert: z.object({
      id: z.string(),
      event: StreamEventSchema,
      themeId: z.string(),
      html: z.string(),
      css: z.string(),
      js: z.string().optional(),
      soundUrl: z.string().optional(),
      durationMs: z.number().default(5000),
    }),
  }),
  z.object({
    kind: z.literal("chat:message"),
    message: z.object({
      id: z.string(),
      user: StreamUserSchema,
      text: z.string(),
      color: z.string().optional(),
      badges: z.array(z.string()).optional(),
      at: z.string(),
    }),
  }),
  z.object({
    kind: z.literal("goal:update"),
    goal: z.object({
      id: z.string(),
      label: z.string(),
      current: z.number(),
      target: z.number(),
      type: z.enum(["follow", "sub"]),
    }),
  }),
  z.object({
    kind: z.literal("widget:nowPlaying"),
    track: z
      .object({
        title: z.string(),
        artist: z.string(),
        albumArtUrl: z.string().optional(),
        progressMs: z.number(),
        durationMs: z.number(),
        isPlaying: z.boolean(),
      })
      .nullable(),
  }),
  z.object({
    kind: z.literal("ticker:event"),
    event: StreamEventSchema,
  }),
  z.object({
    kind: z.literal("effect:play"),
    effect: z.object({
      id: z.string(),
      type: z.enum(["visual", "soundboard", "obs_scene", "obs_transform", "chat_message", "alert", "media", "run_command"]),
      name: z.string(),
      config: z.record(z.unknown()),
    }),
  }),
  z.object({
    kind: z.literal("ping"),
    at: z.string(),
  }),
  z.object({
    kind: z.literal("overlay:emergency"),
    action: z.enum(["stop_sounds", "hide_overlays", "reset_overlay_state", "all"]),
    at: z.string(),
  }),
  z.object({
    kind: z.literal("connected"),
    clientId: z.string(),
  }),
]);

export type BusMessage = z.infer<typeof BusMessageSchema>;

export const AlertRuleSchema = z.object({
  id: z.string(),
  eventType: StreamEventTypeSchema,
  themeId: z.string(),
  enabled: z.boolean().default(true),
  cooldownMs: z.number().default(0),
  minAmount: z.number().optional(),
  soundAsset: z.string().optional(),
  priority: z.number().default(0),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const ThemeAnchorSchema = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export type ThemeAnchor = z.infer<typeof ThemeAnchorSchema>;

export const ThemeLayoutMetaSchema = z.object({
  anchor: ThemeAnchorSchema.default("top-center"),
  offsetX: z.number().default(0),
  offsetY: z.number().default(80),
  width: z.number().default(420),
});

export type ThemeLayoutMeta = z.infer<typeof ThemeLayoutMetaSchema>;

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  html: z.string(),
  css: z.string(),
  js: z.string().optional(),
  durationMs: z.number().default(5000),
  layout: ThemeLayoutMetaSchema.optional(),
  visual: z.record(z.unknown()).optional(),
});

export type Theme = z.infer<typeof ThemeSchema>;

export const WidgetConfigSchema = z.object({
  id: z.string(),
  type: z.enum(["chat", "goal", "ticker", "nowPlaying"]),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const WebhookHookSchema = z.object({
  id: z.string(),
  name: z.string(),
  secret: z.string().optional(),
  action: z.enum(["alert", "goal_increment", "effect", "macro", "custom_event"]),
  actionConfig: z.record(z.unknown()).default({}),
});

export type WebhookHook = z.infer<typeof WebhookHookSchema>;

export const MediaEffectConfigSchema = z.object({
  mediaAsset: z.string().optional(),
  mediaUrl: z.string().optional(),
  loop: z.boolean().default(false),
  durationMs: z.number().default(0),
  fullscreen: z.boolean().default(true),
  placement: ThemeLayoutMetaSchema.optional(),
  volume: z.number().min(0).max(1).default(1),
  mute: z.boolean().default(false),
});

export type MediaEffectConfig = z.infer<typeof MediaEffectConfigSchema>;

export const EffectSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["visual", "soundboard", "obs_scene", "obs_transform", "chat_message", "alert", "media", "run_command"]),
  triggerType: z.enum(["channel_points", "chat_command", "webhook", "manual"]),
  triggerConfig: z.record(z.unknown()).default({}),
  effectConfig: z.record(z.unknown()).default({}),
  cooldownMs: z.number().default(5000),
  enabled: z.boolean().default(true),
});

export type Effect = z.infer<typeof EffectSchema>;

export const AutomationTriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stream_event"),
    eventType: StreamEventTypeSchema,
  }),
  z.object({
    type: z.literal("chat_command"),
    command: z.string().min(1),
  }),
  z.object({
    type: z.literal("manual"),
  }),
]);

export const AutomationConditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user_role"),
    role: z.enum(["broadcaster", "moderator", "subscriber", "vip"]),
  }),
  z.object({
    type: z.literal("min_amount"),
    amount: z.number().min(0),
  }),
  z.object({
    type: z.literal("message_includes"),
    text: z.string().min(1),
  }),
]);

export const AutomationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("macro"),
    macroId: z.string().min(1),
  }),
  z.object({
    type: z.literal("effect"),
    effectId: z.string().min(1),
  }),
  z.object({
    type: z.literal("source_group"),
    sourceGroupId: z.string().min(1),
  }),
  z.object({
    type: z.literal("twitch_chat"),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal("overlay_event"),
    channel: z.string().min(1).default("effects"),
    name: z.string().min(1),
    payload: z.record(z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("wait"),
    durationMs: z.number().min(0).max(30000),
  }),
]);

export const AutomationRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  trigger: AutomationTriggerSchema,
  conditions: z.array(AutomationConditionSchema).default([]),
  actions: z.array(AutomationActionSchema).default([]),
  cooldownMs: z.number().min(0).default(0),
  lastRunAt: z.string().optional(),
  lastStatus: z.enum(["ok", "failed", "skipped"]).optional(),
  lastMessage: z.string().optional(),
  runCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AutomationTrigger = z.infer<typeof AutomationTriggerSchema>;
export type AutomationCondition = z.infer<typeof AutomationConditionSchema>;
export type AutomationActionConfig = z.infer<typeof AutomationActionSchema>;
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

export function createStreamEvent(
  partial: Omit<StreamEvent, "id" | "at"> & { id?: string; at?: string },
): StreamEvent {
  return StreamEventSchema.parse({
    id: partial.id ?? newId(),
    at: partial.at ?? new Date().toISOString(),
    ...partial,
  });
}
