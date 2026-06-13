import type { StreamEventType } from "@btv/shared";
import type { AutomationRule, ChatCommand } from "../../api";

type RuleTrigger = AutomationRule["trigger"];

type EventRuleTriggerEditorProps = {
  trigger: RuleTrigger;
  chatCommands: ChatCommand[];
  onChange: (trigger: RuleTrigger) => void;
};

const streamEventTypes: StreamEventType[] = [
  "follow",
  "sub",
  "resub",
  "gift_sub",
  "cheer",
  "raid",
  "channel_points",
  "chat",
  "goal_milestone",
];

const coreEventTypes = [
  "obs.scene_changed",
  "timer.minute",
  "webhook.alert",
  "webhook.goal_increment",
  "webhook.effect",
  "webhook.macro",
  "webhook.custom_event",
  "dashboard.manual",
  "emergency.all",
];

function chatCommandOptions(commands: ChatCommand[]): Array<{ value: string; label: string }> {
  return commands.flatMap((command) => [
    { value: command.command, label: `${command.command} - ${command.enabled ? "enabled" : "disabled"}` },
    ...command.aliases.map((alias) => ({ value: alias, label: `${alias} - alias for ${command.command}` })),
  ]);
}

export function EventRuleTriggerEditor({ trigger, chatCommands, onChange }: EventRuleTriggerEditorProps) {
  const commandOptions = chatCommandOptions(chatCommands);

  return (
    <>
      <div className="automation-builder-step">
        <strong>1. Trigger</strong>
        <span>Choose what wakes this rule up.</span>
      </div>
      <div className="grid">
        <div>
          <label>Trigger</label>
          <select
            value={trigger.type}
            onChange={(event) => {
              const type = event.target.value;
              onChange(
                type === "chat_command"
                  ? { type, command: commandOptions[0]?.value ?? "!hello" }
                  : type === "manual"
                    ? { type }
                    : type === "btv_event"
                      ? { type, eventType: "obs.scene_changed" }
                      : { type: "stream_event", eventType: "follow" },
              );
            }}
          >
            <option value="stream_event">Stream event</option>
            <option value="btv_event">Core BTV event</option>
            <option value="chat_command">Chat command</option>
            <option value="manual">Manual only</option>
          </select>
        </div>
        {trigger.type === "stream_event" && (
          <div>
            <label>Event type</label>
            <select
              value={trigger.eventType}
              onChange={(event) => onChange({ type: "stream_event", eventType: event.target.value as StreamEventType })}
            >
              {streamEventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}
        {trigger.type === "btv_event" && (
          <div>
            <label>Core event type</label>
            <select value={trigger.eventType} onChange={(event) => onChange({ type: "btv_event", eventType: event.target.value })}>
              {coreEventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}
        {trigger.type === "chat_command" && (
          <div>
            <label>Command</label>
            {commandOptions.length ? (
              <select value={trigger.command} onChange={(event) => onChange({ type: "chat_command", command: event.target.value })}>
                {!commandOptions.some((option) => option.value === trigger.command) && (
                  <option value={trigger.command}>{trigger.command || "Custom command"}</option>
                )}
                {commandOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <input
                value={trigger.command}
                onChange={(event) => onChange({ type: "chat_command", command: event.target.value })}
                placeholder="!hello"
              />
            )}
            <p className="subtitle">Actions can use {"{command}"} and {"{args}"} from the chat message.</p>
          </div>
        )}
      </div>
    </>
  );
}
