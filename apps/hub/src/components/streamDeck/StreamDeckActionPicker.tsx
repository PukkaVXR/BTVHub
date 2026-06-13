import type { CSSProperties } from "react";
import type { StreamDeckActionGroup, StreamDeckActionPreset, StreamDeckBuilderAction } from "./streamDeckBuilderTypes";

type Props = {
  action: StreamDeckBuilderAction;
  actionDetail?: string;
  groups: StreamDeckActionGroup[];
  presets: StreamDeckActionPreset[];
  onSelectAction: (action: StreamDeckBuilderAction) => void;
  onSelectPreset: (preset: StreamDeckActionPreset) => void;
};

export function StreamDeckActionPicker({ action, actionDetail, groups, presets, onSelectAction, onSelectPreset }: Props) {
  return (
    <section className="stream-deck-builder-panel stream-deck-builder-panel--actions">
      <div className="stream-deck-builder-panel__header">
        <span>1</span>
        <div>
          <strong>Choose the action</strong>
          <small>{actionDetail}</small>
        </div>
      </div>

      <div className="stream-deck-preset-grid">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={`stream-deck-preset ${preset.action === action ? "stream-deck-preset--active" : ""}`}
            onClick={() => onSelectPreset(preset)}
          >
            <span style={{ "--button-color": preset.color } as CSSProperties}>{preset.iconLabel}</span>
            <strong>{preset.title}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <div className="stream-deck-action-group" key={group.title}>
          <h4>{group.title}</h4>
          <div className="stream-deck-action-choice-grid">
            {group.actions.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`stream-deck-action-choice ${action === item.value ? "stream-deck-action-choice--active" : ""}`}
                onClick={() => onSelectAction(item.value)}
              >
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
