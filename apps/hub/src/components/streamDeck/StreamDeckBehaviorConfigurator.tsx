import type { MacroConfig, ObsSceneInfo, ObsSourceInfo, SourceGroup } from "../../api";
import type {
  StreamDeckBehaviorValues,
  StreamDeckBuilderAction,
  StreamDeckKeyAppearancePatch,
} from "./streamDeckBuilderTypes";

const EMERGENCY_ACTIONS = [
  { value: "all", label: "Stop all", color: "#ff3b5f", iconLabel: "!" },
  { value: "stop-sounds", label: "Stop sounds", color: "#ff9f1c", iconLabel: "Mute" },
  { value: "hide-overlays", label: "Hide overlays", color: "#ff9f1c", iconLabel: "Hide" },
  { value: "reset-overlays", label: "Reset overlays", color: "#5b8cff", iconLabel: "Reset" },
  { value: "disable-automations", label: "Disable automations", color: "#ffcf5a", iconLabel: "Auto" },
  { value: "enable-automations", label: "Enable automations", color: "#00f593", iconLabel: "Auto" },
  { value: "disable-channel-points", label: "Disable channel points", color: "#ffcf5a", iconLabel: "CP" },
  { value: "enable-channel-points", label: "Enable channel points", color: "#00f593", iconLabel: "CP" },
  { value: "reconnect-obs", label: "Reconnect OBS", color: "#6ee7b7", iconLabel: "OBS" },
  { value: "reconnect-twitch", label: "Reconnect Twitch", color: "#a78bfa", iconLabel: "TTV" },
] as const;

const ALERT_ACTIONS = [
  { value: "pause", label: "Pause alerts", color: "#ffcf5a", iconLabel: "Pause" },
  { value: "resume", label: "Resume alerts", color: "#00f593", iconLabel: "Play" },
  { value: "skip", label: "Skip alert", color: "#5b8cff", iconLabel: "Skip" },
  { value: "replay-last", label: "Replay alert", color: "#a78bfa", iconLabel: "Replay" },
  { value: "clear", label: "Clear alerts", color: "#ff5a67", iconLabel: "Clear" },
] as const;

const TEST_EVENTS = [
  { value: "follow", label: "Test follow", color: "#38bdf8", iconLabel: "Follow" },
  { value: "sub", label: "Test sub", color: "#f472b6", iconLabel: "Sub" },
  { value: "resub", label: "Test resub", color: "#f472b6", iconLabel: "Resub" },
  { value: "gift_sub", label: "Test gifted sub", color: "#f472b6", iconLabel: "Gift" },
  { value: "cheer", label: "Test cheer", color: "#a78bfa", iconLabel: "Bits" },
  { value: "raid", label: "Test raid", color: "#ff9f1c", iconLabel: "Raid" },
  { value: "channel_points", label: "Test channel points", color: "#00f593", iconLabel: "CP" },
] as const;

const STATUS_ENDPOINTS = [
  { value: "/stream-deck/status", label: "Overall readiness", color: "#00f593", iconLabel: "OK" },
  { value: "/stream-deck/obs", label: "OBS status", color: "#6ee7b7", iconLabel: "OBS" },
  { value: "/stream-deck/macros", label: "Macro list", color: "#5b8cff", iconLabel: "Macro" },
  { value: "/stream-deck/source-groups", label: "Activity layout list", color: "#a78bfa", iconLabel: "Layout" },
] as const;

type Props = {
  action: StreamDeckBuilderAction;
  values: StreamDeckBehaviorValues;
  macros: MacroConfig[];
  sourceGroups: SourceGroup[];
  obsScenes: ObsSceneInfo[];
  obsSources: ObsSourceInfo[];
  warnings: string[];
  onChange: (patch: Partial<StreamDeckBehaviorValues>) => void;
  onAppearanceChange: (patch: StreamDeckKeyAppearancePatch) => void;
};

export function StreamDeckBehaviorConfigurator({
  action,
  values,
  macros,
  sourceGroups,
  obsScenes,
  obsSources,
  warnings,
  onChange,
  onAppearanceChange,
}: Props) {
  const applyChoice = (value: string, choices: readonly { value: string; label: string; color: string; iconLabel: string }[]) => {
    const selected = choices.find((item) => item.value === value);
    if (selected) onAppearanceChange({ keyTitle: `BTV ${selected.label}`, keyColor: selected.color, iconLabel: selected.iconLabel });
  };

  return (
    <section className="stream-deck-builder-panel">
      <div className="stream-deck-builder-panel__header">
        <span>2</span>
        <div>
          <strong>Configure behaviour</strong>
          <small>Use dropdowns where possible; advanced JSON is still available when needed.</small>
        </div>
      </div>

      <div className="stream-deck-form-grid">
        {action === "macro" ? (
          <label>Macro<select value={values.macroId} onChange={(event) => onChange({ macroId: event.target.value })}>
            <option value="">Select macro</option>
            {macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}
          </select></label>
        ) : null}

        {action === "sourceGroup" ? (
          <label>Activity layout<select value={values.sourceGroupId} onChange={(event) => onChange({ sourceGroupId: event.target.value })}>
            <option value="">Select activity layout</option>
            {sourceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select></label>
        ) : null}

        {action === "emergency" ? (
          <label>Emergency action<select value={values.emergencyAction} onChange={(event) => {
            onChange({ emergencyAction: event.target.value });
            applyChoice(event.target.value, EMERGENCY_ACTIONS);
          }}>{EMERGENCY_ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        ) : null}

        {action === "alertControl" ? (
          <label>Alert action<select value={values.alertAction} onChange={(event) => {
            onChange({ alertAction: event.target.value });
            applyChoice(event.target.value, ALERT_ACTIONS);
          }}>{ALERT_ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        ) : null}

        {action === "testAlert" ? (
          <label>Test event<select value={values.testEventType} onChange={(event) => {
            onChange({ testEventType: event.target.value });
            applyChoice(event.target.value, TEST_EVENTS);
          }}>{TEST_EVENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        ) : null}

        {["obsScene", "sourceVisibility", "sourceMotion"].includes(action) ? (
          <label>OBS scene<select value={values.sceneName} onChange={(event) => onChange({ sceneName: event.target.value })}>
            <option value="">Select scene</option>
            {obsScenes.map((scene) => <option key={scene.sceneName} value={scene.sceneName}>{scene.sceneName}</option>)}
          </select></label>
        ) : null}

        {["sourceVisibility", "sourceMotion"].includes(action) ? (
          <label>OBS source<select value={values.sourceName} onChange={(event) => onChange({ sourceName: event.target.value })}>
            <option value="">Select source</option>
            {obsSources.map((source) => <option key={`${source.sceneItemId}-${source.sourceName}`} value={source.sourceName}>{source.sourceName}</option>)}
          </select></label>
        ) : null}

        {action === "sourceVisibility" ? (
          <label className="stream-deck-toggle"><input type="checkbox" checked={values.sourceVisible} onChange={(event) => onChange({ sourceVisible: event.target.checked })} />Show source</label>
        ) : null}

        {action === "sourceMotion" ? (
          <>
            <label>Motion type<select value={values.motionMode} onChange={(event) => onChange({ motionMode: event.target.value as StreamDeckBehaviorValues["motionMode"] })}>
              <option value="dvd">DVD bounce</option><option value="set">Set position / size</option><option value="path">Simple path pulse</option>
            </select></label>
            <label>Duration (ms)<input type="number" min={100} step={100} value={values.motionDurationMs} onChange={(event) => onChange({ motionDurationMs: Number(event.target.value) })} /></label>
            {values.motionMode === "dvd" ? (
              <>
                <label>Speed X<input type="number" value={values.motionSpeedX} onChange={(event) => onChange({ motionSpeedX: Number(event.target.value) })} /></label>
                <label>Speed Y<input type="number" value={values.motionSpeedY} onChange={(event) => onChange({ motionSpeedY: Number(event.target.value) })} /></label>
              </>
            ) : (
              <>
                <label>X<input type="number" value={values.motionX} onChange={(event) => onChange({ motionX: Number(event.target.value) })} /></label>
                <label>Y<input type="number" value={values.motionY} onChange={(event) => onChange({ motionY: Number(event.target.value) })} /></label>
                <label>Width<input type="number" min={1} value={values.motionWidth} onChange={(event) => onChange({ motionWidth: Number(event.target.value) })} /></label>
                <label>Height<input type="number" min={1} value={values.motionHeight} onChange={(event) => onChange({ motionHeight: Number(event.target.value) })} /></label>
              </>
            )}
            <label className="stream-deck-toggle"><input type="checkbox" checked={values.motionRestore} onChange={(event) => onChange({ motionRestore: event.target.checked })} />Restore when complete</label>
          </>
        ) : null}

        {["text", "inputSettings"].includes(action) ? (
          <label>OBS input name<input value={values.textInputName} onChange={(event) => onChange({ textInputName: event.target.value })} placeholder="Exact OBS input name" /></label>
        ) : null}

        {action === "text" ? <label className="stream-deck-form-grid__wide">Text to set<input value={values.textValue} onChange={(event) => onChange({ textValue: event.target.value })} /></label> : null}
        {action === "inputSettings" ? <label className="stream-deck-form-grid__wide">Input settings JSON<textarea rows={7} value={values.inputSettingsJson} onChange={(event) => onChange({ inputSettingsJson: event.target.value })} /></label> : null}

        {action === "status" ? (
          <label>Status endpoint<select value={values.statusEndpoint} onChange={(event) => {
            onChange({ statusEndpoint: event.target.value });
            applyChoice(event.target.value, STATUS_ENDPOINTS);
          }}>{STATUS_ENDPOINTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        ) : null}
      </div>

      {warnings.length ? <div className="stream-deck-builder-warnings">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
    </section>
  );
}
