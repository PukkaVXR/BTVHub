import type { AlertLayer } from "@btv/shared";

type ProjectWarning = { level: "warning" | "error"; message: string };

type AlertLayersPanelProps = {
  layers: AlertLayer[];
  selectedLayerId: string;
  warnings: ProjectWarning[];
  onAddLayer: (type: AlertLayer["type"]) => void;
  onSelectLayer: (layerId: string) => void;
  onMoveLayer: (direction: -1 | 1) => void;
  onDuplicateLayer: () => void;
  onDeleteLayer: () => void;
};

const LAYER_ACTIONS: Array<{ type: AlertLayer["type"]; label: string }> = [
  { type: "text", label: "Text" },
  { type: "shape", label: "Shape" },
  { type: "image", label: "Image" },
  { type: "gif", label: "GIF" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "particle", label: "Particles" },
  { type: "browser", label: "HTML" },
];

export function AlertLayersPanel({
  layers,
  selectedLayerId,
  warnings,
  onAddLayer,
  onSelectLayer,
  onMoveLayer,
  onDuplicateLayer,
  onDeleteLayer,
}: AlertLayersPanelProps) {
  const hasSelection = layers.some((layer) => layer.id === selectedLayerId);

  return (
    <>
      <h2 className="alert-layers-title">Layers</h2>
      {warnings.length > 0 && (
        <section className="alert-health-panel">
          <h3>Project checks</h3>
          {warnings.slice(0, 5).map((warning, index) => (
            <p key={`${warning.message}-${index}`} className={warning.level}>
              {warning.message}
            </p>
          ))}
          {warnings.length > 5 && <p className="warning">{warnings.length - 5} more issue(s) hidden.</p>}
        </section>
      )}
      <div className="actions alert-layer-add-actions">
        {LAYER_ACTIONS.map((action) => (
          <button key={action.type} type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onAddLayer(action.type)}>
            {action.label}
          </button>
        ))}
      </div>
      <div className="layer-list">
        {layers.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className={`layer-row${selectedLayerId === layer.id ? " active" : ""}`}
            onClick={() => onSelectLayer(layer.id)}
            title="Select this layer to edit its timeline, visual, and media properties."
          >
            <span>{layer.visible ? "Shown" : "Hidden"}</span>
            <strong>{layer.name}</strong>
            <em>{layer.type}</em>
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onMoveLayer(-1)} disabled={!hasSelection} title="Move selected layer earlier in the stack.">Up</button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onMoveLayer(1)} disabled={!hasSelection} title="Move selected layer later in the stack.">Down</button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onDuplicateLayer} disabled={!hasSelection} title="Duplicate selected layer. Shortcut: Ctrl+D.">Duplicate</button>
        <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={onDeleteLayer} disabled={!hasSelection} title="Delete selected layer. Shortcut: Delete.">Delete layer</button>
      </div>
    </>
  );
}
