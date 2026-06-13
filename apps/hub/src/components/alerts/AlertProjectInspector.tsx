import type { AlertProject, StreamEventType } from "@btv/shared";

type CanvasPreset = { label: string; width: number; height: number };

type AlertProjectInspectorProps = {
  project: AlertProject;
  eventTypes: StreamEventType[];
  canvasPresets: CanvasPreset[];
  activeCanvasPreset: string;
  onUpdate: (project: AlertProject) => void;
  onApplyCanvasPreset: (preset: string) => void;
};

export function AlertProjectInspector({
  project,
  eventTypes,
  canvasPresets,
  activeCanvasPreset,
  onUpdate,
  onApplyCanvasPreset,
}: AlertProjectInspectorProps) {
  const update = (patch: Partial<AlertProject>) => onUpdate({ ...project, ...patch, updatedAt: new Date().toISOString() });
  const updateCanvas = (patch: Partial<AlertProject["canvas"]>) => update({ canvas: { ...project.canvas, ...patch } });

  return (
    <div className="alert-inspector-empty">
      <p className="subtitle">No layer selected. Select a layer to edit it, or tune the project canvas here.</p>
      <details open className="alert-inspector-section">
        <summary>Project</summary>
        <div className="form-row">
          <label>Name</label>
          <input value={project.name} onChange={(event) => update({ name: event.target.value })} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>Event type</label>
            <select value={project.eventType} onChange={(event) => update({ eventType: event.target.value as StreamEventType })}>
              {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label>Duration (ms)</label>
            <input type="number" min={500} max={60000} value={project.durationMs} onChange={(event) => update({ durationMs: Number(event.target.value) })} />
          </div>
        </div>
      </details>
      <details open className="alert-inspector-section">
        <summary>Canvas</summary>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>Width</label>
            <input type="number" min={320} value={project.canvas.width} onChange={(event) => updateCanvas({ width: Number(event.target.value) })} />
          </div>
          <div>
            <label>Height</label>
            <input type="number" min={180} value={project.canvas.height} onChange={(event) => updateCanvas({ height: Number(event.target.value) })} />
          </div>
        </div>
        <div className="form-row">
          <label>Canvas preset</label>
          <select value={activeCanvasPreset} onChange={(event) => onApplyCanvasPreset(event.target.value)}>
            {canvasPresets.map((preset) => (
              <option key={preset.label} value={`${preset.width}x${preset.height}`}>{preset.label} ({preset.width}x{preset.height})</option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>
      </details>
    </div>
  );
}
