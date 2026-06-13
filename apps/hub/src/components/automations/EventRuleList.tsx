import type { AutomationActionConfig, AutomationRule } from "../../api";
import { EmptyState, StatusPill } from "../../ui";

type EventRuleListProps = {
  rules: AutomationRule[];
  selectedRuleId?: string;
  onSelect: (rule: AutomationRule) => void;
};

function describeRuleTrigger(rule: AutomationRule): string {
  if (rule.trigger.type === "stream_event") return rule.trigger.eventType;
  if (rule.trigger.type === "btv_event") return rule.trigger.eventType;
  if (rule.trigger.type === "chat_command") return rule.trigger.command;
  return "manual";
}

function describeAction(action: AutomationActionConfig): string {
  switch (action.type) {
    case "macro": return `macro:${action.macroId || "unset"}`;
    case "effect": return `effect:${action.effectId || "unset"}`;
    case "source_group": return `layout:${action.sourceGroupId || "unset"}`;
    case "obs_scene": return `scene:${action.sceneName || "unset"}`;
    case "obs_source_visibility": return `${action.visible ? "show" : "hide"}:${action.sourceName || "unset"}`;
    case "obs_source_motion": return `motion:${action.sourceName || "unset"}`;
    case "obs_filter": return `${action.enabled ? "enable" : "disable"} filter:${action.filterName || "unset"}`;
    case "obs_mute": return `${action.muted ? "mute" : "unmute"}:${action.inputName || "unset"}`;
    case "obs_recording": return `recording:${action.action}`;
    case "obs_streaming": return `streaming:${action.action}`;
    case "obs_text": return `text:${action.inputName || "unset"}`;
    case "clear_alerts": return "clear alerts";
    case "twitch_chat": return "twitch chat";
    case "overlay_event": return `overlay:${action.name}`;
    case "overlay_alert": return `alert:${action.eventType}`;
    case "overlay_animation": return `animation:${action.name}`;
    case "widget_text": return `widget:${action.widgetId}`;
    case "variable_set": return `set:${action.name}`;
    case "variable_increment": return `increment:${action.name}`;
    case "variable_decrement": return `decrement:${action.name}`;
    case "variable_reset": return `reset:${action.name}`;
    case "branch": return "branch";
    case "random_choice": return "random choice";
    case "wait": return `wait ${action.durationMs}ms`;
    default: return "action";
  }
}

export function EventRuleList({ rules, selectedRuleId, onSelect }: EventRuleListProps) {
  return (
    <aside className="automation-rule-list" aria-label="Event automation rules">
      {rules.map((rule) => (
        <button
          key={rule.id}
          type="button"
          className={selectedRuleId === rule.id ? "active" : ""}
          onClick={() => onSelect(rule)}
        >
          <span>{rule.name}</span>
          <small>
            {describeRuleTrigger(rule)}{" \u00b7 "}
            {rule.actions.length ? rule.actions.map(describeAction).join(", ") : "no actions"}
          </small>
          <StatusPill
            tone={rule.enabled ? "info" : "neutral"}
            label={rule.enabled ? rule.lastStatus ?? "waiting" : "paused"}
          />
        </button>
      ))}
      {!rules.length && (
        <EmptyState
          title="No event rules yet"
          description="Create one to react to Twitch events, chat commands, webhooks, or manual triggers."
        />
      )}
    </aside>
  );
}
