import type { StreamEventType } from "@btv/shared";
import type { AutomationActionConfig, MacroConfig, SourceGroup } from "../../api";

type EventRuleActionsEditorProps = {
  actions: AutomationActionConfig[];
  macros: MacroConfig[];
  effects: Array<{ id: string; name: string }>;
  sourceGroups: SourceGroup[];
  onChange: (actions: AutomationActionConfig[]) => void;
};

function eventActionTemplate(type: AutomationActionConfig["type"]): AutomationActionConfig {
  switch (type) {
    case "macro":
      return { type, macroId: "" };
    case "effect":
      return { type, effectId: "" };
    case "source_group":
      return { type, sourceGroupId: "" };
    case "obs_scene":
      return { type, sceneName: "" };
    case "obs_source_visibility":
      return { type, sceneName: "", sourceName: "", visible: true };
    case "obs_source_motion":
      return { type, sceneName: "", sourceName: "", mode: "set", x: 0, y: 0, scale: 1, restore: false };
    case "obs_filter":
      return { type, sourceName: "", filterName: "", enabled: true };
    case "obs_mute":
      return { type, inputName: "", muted: true };
    case "obs_recording":
      return { type, action: "start" };
    case "obs_streaming":
      return { type, action: "start" };
    case "obs_text":
      return { type, inputName: "", text: "Updated by {user}" };
    case "clear_alerts":
      return { type };
    case "twitch_chat":
      return { type, message: "Thanks {user}!" };
    case "overlay_event":
      return { type, channel: "effects", name: "automation", payload: {} };
    case "overlay_alert":
      return { type, themeId: "default", eventType: "unknown", message: "Automation alert for {user}", userName: "{user}", durationMs: 5000 };
    case "overlay_animation":
      return { type, channel: "effects", name: "automation", payload: {} };
    case "widget_text":
      return { type, widgetId: "ticker", text: "Updated by {user}" };
    case "variable_set":
      return { type, name: "counter", value: 0 };
    case "variable_increment":
      return { type, name: "counter", amount: 1 };
    case "variable_decrement":
      return { type, name: "counter", amount: 1 };
    case "variable_reset":
      return { type, name: "counter" };
    case "branch":
      return { type, conditions: [], thenActions: [], elseActions: [] };
    case "random_choice":
      return { type, choices: [{ weight: 1, actions: [] }] };
    case "wait":
      return { type, durationMs: 1000 };
    default:
      return { type: "wait", durationMs: 1000 };
  }
}

export function EventRuleActionsEditor({
  actions,
  macros,
  effects,
  sourceGroups,
  onChange,
}: EventRuleActionsEditorProps) {
  const updateEventAction = (index: number, action: AutomationActionConfig) => {
    const next = [...actions];
    next[index] = action;
    onChange(next);
  };

  const removeEventActionAt = (index: number) => {
    onChange(actions.filter((_, actionIndex) => actionIndex !== index));
  };

  return (
    <>
            <div className="automation-builder-step">
              <strong>3. Actions</strong>
              <span>What BTV should do when the trigger and conditions match.</span>
            </div>
            {actions.map((action, index) => (
              <div className="card" key={`${action.type}-${index}`} style={{ marginBottom: 12 }}>
                <div className="form-row">
                  <label>Action {index + 1}</label>
                  <select
                    value={action.type}
                    onChange={(e) => updateEventAction(index, eventActionTemplate(e.target.value as AutomationActionConfig["type"]))}
                  >
                    <option value="macro">Run macro</option>
                    <option value="effect">Run interaction/effect</option>
                    <option value="source_group">Activate activity layout</option>
                    <option value="obs_scene">Switch OBS scene</option>
                    <option value="obs_source_visibility">Show / hide OBS source</option>
                    <option value="obs_source_motion">Set / move OBS source</option>
                    <option value="obs_filter">Enable / disable OBS filter</option>
                    <option value="obs_mute">Mute / unmute OBS input</option>
                    <option value="obs_recording">Control OBS recording</option>
                    <option value="obs_streaming">Control OBS streaming</option>
                    <option value="obs_text">Set OBS text</option>
                    <option value="clear_alerts">Clear alert queue</option>
                    <option value="twitch_chat">Send Twitch chat</option>
                    <option value="overlay_event">Send overlay event</option>
                    <option value="overlay_alert">Trigger overlay alert</option>
                    <option value="overlay_animation">Trigger overlay animation</option>
                    <option value="widget_text">Update widget text</option>
                    <option value="variable_set">Set variable</option>
                    <option value="variable_increment">Increment variable</option>
                    <option value="variable_decrement">Decrement variable</option>
                    <option value="variable_reset">Reset variable</option>
                    <option value="branch">Branch / if</option>
                    <option value="random_choice">Random choice</option>
                    <option value="wait">Wait</option>
                  </select>
                </div>

                {action.type === "macro" && (
                  <div className="form-row">
                    <label>Macro</label>
                    <select value={action.macroId} onChange={(e) => updateEventAction(index, { type: "macro", macroId: e.target.value })}>
                      <option value="">Select macro</option>
                      {macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}
                    </select>
                  </div>
                )}
                {action.type === "effect" && (
                  <div className="form-row">
                    <label>Interaction/effect</label>
                    <select value={action.effectId} onChange={(e) => updateEventAction(index, { type: "effect", effectId: e.target.value })}>
                      <option value="">Select effect</option>
                      {effects.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
                    </select>
                  </div>
                )}
                {action.type === "source_group" && (
                  <div className="form-row">
                    <label>Activity layout</label>
                    <select value={action.sourceGroupId} onChange={(e) => updateEventAction(index, { type: "source_group", sourceGroupId: e.target.value })}>
                      <option value="">Select layout</option>
                      {sourceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </div>
                )}
                {action.type === "obs_scene" && (
                  <div className="form-row">
                    <label>Scene name</label>
                    <input value={action.sceneName} onChange={(e) => updateEventAction(index, { type: "obs_scene", sceneName: e.target.value })} />
                  </div>
                )}
                {action.type === "obs_source_visibility" && (
                  <div className="grid">
                    <div>
                      <label>Scene name</label>
                      <input value={action.sceneName} onChange={(e) => updateEventAction(index, { ...action, sceneName: e.target.value })} />
                    </div>
                    <div>
                      <label>Source name</label>
                      <input value={action.sourceName} onChange={(e) => updateEventAction(index, { ...action, sourceName: e.target.value })} />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={action.visible}
                        onChange={(e) => updateEventAction(index, { ...action, visible: e.target.checked })}
                      />{" "}
                      Show source
                    </label>
                  </div>
                )}
                {action.type === "obs_source_motion" && (
                  <div className="grid">
                    <div>
                      <label>Scene name</label>
                      <input value={action.sceneName} onChange={(e) => updateEventAction(index, { ...action, sceneName: e.target.value })} />
                    </div>
                    <div>
                      <label>Source name</label>
                      <input value={action.sourceName} onChange={(e) => updateEventAction(index, { ...action, sourceName: e.target.value })} />
                    </div>
                    <div>
                      <label>Mode</label>
                      <select
                        value={action.mode}
                        onChange={(e) => updateEventAction(index, { ...action, mode: e.target.value as typeof action.mode })}
                      >
                        <option value="set">Set transform</option>
                        <option value="dvd">DVD bounce</option>
                        <option value="path">Path motion</option>
                      </select>
                    </div>
                    <div>
                      <label>X</label>
                      <input type="number" value={action.x ?? 0} onChange={(e) => updateEventAction(index, { ...action, x: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label>Y</label>
                      <input type="number" value={action.y ?? 0} onChange={(e) => updateEventAction(index, { ...action, y: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label>Scale</label>
                      <input
                        type="number"
                        step="0.1"
                        value={action.scale ?? 1}
                        onChange={(e) => updateEventAction(index, { ...action, scale: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label>Duration (ms)</label>
                      <input
                        type="number"
                        value={action.durationMs ?? 0}
                        onChange={(e) => updateEventAction(index, { ...action, durationMs: Number(e.target.value) })}
                      />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(action.visible)}
                        onChange={(e) => updateEventAction(index, { ...action, visible: e.target.checked })}
                      />{" "}
                      Show source first
                    </label>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(action.restore)}
                        onChange={(e) => updateEventAction(index, { ...action, restore: e.target.checked })}
                      />{" "}
                      Restore after motion
                    </label>
                  </div>
                )}
                {action.type === "obs_filter" && (
                  <div className="grid">
                    <div>
                      <label>Source name</label>
                      <input value={action.sourceName} onChange={(e) => updateEventAction(index, { ...action, sourceName: e.target.value })} />
                    </div>
                    <div>
                      <label>Filter name</label>
                      <input value={action.filterName} onChange={(e) => updateEventAction(index, { ...action, filterName: e.target.value })} />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={action.enabled}
                        onChange={(e) => updateEventAction(index, { ...action, enabled: e.target.checked })}
                      />{" "}
                      Enable filter
                    </label>
                  </div>
                )}
                {action.type === "obs_mute" && (
                  <div className="grid">
                    <div>
                      <label>Input/source name</label>
                      <input value={action.inputName} onChange={(e) => updateEventAction(index, { ...action, inputName: e.target.value })} />
                    </div>
                    <label style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={action.muted}
                        onChange={(e) => updateEventAction(index, { ...action, muted: e.target.checked })}
                      />{" "}
                      Mute input
                    </label>
                  </div>
                )}
                {action.type === "obs_recording" && (
                  <div className="form-row">
                    <label>Recording action</label>
                    <select
                      value={action.action}
                      onChange={(e) => updateEventAction(index, { type: "obs_recording", action: e.target.value as typeof action.action })}
                    >
                      <option value="start">Start recording</option>
                      <option value="stop">Stop recording</option>
                      <option value="pause">Pause recording</option>
                      <option value="resume">Resume recording</option>
                    </select>
                  </div>
                )}
                {action.type === "obs_streaming" && (
                  <div className="form-row">
                    <label>Streaming action</label>
                    <select
                      value={action.action}
                      onChange={(e) => updateEventAction(index, { type: "obs_streaming", action: e.target.value as typeof action.action })}
                    >
                      <option value="start">Start stream</option>
                      <option value="stop">Stop stream</option>
                    </select>
                  </div>
                )}
                {action.type === "obs_text" && (
                  <div className="grid">
                    <div>
                      <label>Text input name</label>
                      <input value={action.inputName} onChange={(e) => updateEventAction(index, { ...action, inputName: e.target.value })} />
                    </div>
                    <div>
                      <label>Text</label>
                      <input value={action.text} onChange={(e) => updateEventAction(index, { ...action, text: e.target.value })} />
                    </div>
                  </div>
                )}
                {action.type === "clear_alerts" && (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>Clears the active alert queue when this rule runs.</p>
                )}
                {action.type === "twitch_chat" && (
                  <div className="form-row">
                    <label>Message</label>
                    <input value={action.message} onChange={(e) => updateEventAction(index, { type: "twitch_chat", message: e.target.value })} />
                  </div>
                )}
                {action.type === "overlay_event" && (
                  <div className="grid">
                    <div>
                      <label>Channel</label>
                      <input value={action.channel} onChange={(e) => updateEventAction(index, { ...action, channel: e.target.value })} />
                    </div>
                    <div>
                      <label>Name</label>
                      <input value={action.name} onChange={(e) => updateEventAction(index, { ...action, name: e.target.value })} />
                    </div>
                  </div>
                )}
                {action.type === "overlay_alert" && (
                  <div className="grid">
                    <div>
                      <label>Theme ID</label>
                      <input value={action.themeId} onChange={(e) => updateEventAction(index, { ...action, themeId: e.target.value })} />
                    </div>
                    <div>
                      <label>Event type</label>
                      <select
                        value={action.eventType}
                        onChange={(e) => updateEventAction(index, { ...action, eventType: e.target.value as StreamEventType })}
                      >
                        {["unknown", "follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points", "chat"].map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>User name</label>
                      <input value={action.userName} onChange={(e) => updateEventAction(index, { ...action, userName: e.target.value })} />
                    </div>
                    <div>
                      <label>Message</label>
                      <input value={action.message} onChange={(e) => updateEventAction(index, { ...action, message: e.target.value })} />
                    </div>
                    <div>
                      <label>Duration (ms)</label>
                      <input
                        type="number"
                        value={action.durationMs}
                        onChange={(e) => updateEventAction(index, { ...action, durationMs: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
                {action.type === "overlay_animation" && (
                  <div className="grid">
                    <div>
                      <label>Channel</label>
                      <input value={action.channel} onChange={(e) => updateEventAction(index, { ...action, channel: e.target.value })} />
                    </div>
                    <div>
                      <label>Name</label>
                      <input value={action.name} onChange={(e) => updateEventAction(index, { ...action, name: e.target.value })} />
                    </div>
                  </div>
                )}
                {action.type === "widget_text" && (
                  <div className="grid">
                    <div>
                      <label>Widget ID</label>
                      <input value={action.widgetId} onChange={(e) => updateEventAction(index, { ...action, widgetId: e.target.value })} />
                    </div>
                    <div>
                      <label>Text</label>
                      <input value={action.text} onChange={(e) => updateEventAction(index, { ...action, text: e.target.value })} />
                    </div>
                  </div>
                )}
                {(action.type === "variable_set" || action.type === "variable_increment" || action.type === "variable_decrement" || action.type === "variable_reset") && (
                  <div className="grid">
                    <div>
                      <label>Variable</label>
                      <input value={action.name} onChange={(e) => updateEventAction(index, { ...action, name: e.target.value })} />
                    </div>
                    {action.type === "variable_set" && (
                      <div>
                        <label>Value</label>
                        <input value={String(action.value)} onChange={(e) => updateEventAction(index, { ...action, value: e.target.value })} />
                      </div>
                    )}
                    {(action.type === "variable_increment" || action.type === "variable_decrement") && (
                      <div>
                        <label>Amount</label>
                        <input
                          type="number"
                          value={action.amount}
                          onChange={(e) => updateEventAction(index, { ...action, amount: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                )}
                {(action.type === "branch" || action.type === "random_choice") && (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>
                    Advanced action saved with its default JSON shape. Edit the saved rule JSON later when the advanced editor lands.
                  </p>
                )}
                {action.type === "wait" && (
                  <div className="form-row">
                    <label>Duration (ms)</label>
                    <input
                      type="number"
                      value={action.durationMs}
                      onChange={(e) => updateEventAction(index, { type: "wait", durationMs: Number(e.target.value) })}
                    />
                  </div>
                )}
                <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => removeEventActionAt(index)}>
                  Remove action
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              style={{ marginBottom: 16 }}
              onClick={() => onChange([...actions, eventActionTemplate("macro")])}
            >
              Add action
            </button>

    </>
  );
}
