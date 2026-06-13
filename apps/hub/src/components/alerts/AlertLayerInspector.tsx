import type { AlertKeyframe, AlertLayer, AlertLayerAnimation } from "@btv/shared";

export type AlertKeyframeProperty = "opacity" | "position" | "scale" | "rotation";
export type AlertLayerAlignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

const BLEND_MODES = ["normal", "screen", "multiply", "overlay", "lighten", "darken", "color-dodge", "difference"] as const;
const KEYFRAME_PROPERTIES: AlertKeyframeProperty[] = ["opacity", "position", "scale", "rotation"];
const ANIMATION_PRESETS: AlertLayerAnimation["preset"][] = [
  "none", "fade-in", "pop-in", "slide-in", "bounce-in", "elastic-in", "spin-in", "screen-slam", "glitch-reveal",
  "pulse", "float", "wiggle", "rgb-split", "vhs-jitter", "bass-shake", "glow-pulse", "fade-out", "pop-out",
  "slide-out", "glitch-out", "explode-out",
];
const ANIMATION_LABELS: Record<AlertLayerAnimation["preset"], string> = {
  "none": "None", "fade-in": "Fade in", "pop-in": "Pop in", "slide-in": "Slide in", "bounce-in": "Bounce in",
  "elastic-in": "Elastic in", "spin-in": "Spin in", "screen-slam": "Screen slam", "glitch-reveal": "Glitch reveal",
  "pulse": "Pulse", "float": "Float", "wiggle": "Wiggle", "rgb-split": "RGB split", "vhs-jitter": "VHS jitter",
  "bass-shake": "Bass shake", "glow-pulse": "Glow pulse", "fade-out": "Fade out", "pop-out": "Pop out",
  "slide-out": "Slide out", "glitch-out": "Glitch out", "explode-out": "Explode out",
};

type AlertLayerInspectorProps = {
  layer: AlertLayer;
  projectDurationMs: number;
  onUpdate: (patch: Partial<AlertLayer>) => void;
  onUpdateFilter: (patch: Partial<NonNullable<AlertLayer["filter"]>>) => void;
  onAlign: (alignment: AlertLayerAlignment) => void;
  onApplyAnimation: (preset: AlertLayerAnimation["preset"]) => void;
  onAddKeyframe: (property: AlertKeyframeProperty) => void;
  onUpdateKeyframe: (keyframeId: string, patch: Partial<AlertKeyframe>) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
};

export function AlertLayerInspector({
  layer,
  projectDurationMs,
  onUpdate,
  onUpdateFilter,
  onAlign,
  onApplyAnimation,
  onAddKeyframe,
  onUpdateKeyframe,
  onDeleteKeyframe,
}: AlertLayerInspectorProps) {
  return (
    <>
      <details open className="alert-inspector-section">
        <summary>Layer</summary>
        <div className="form-row">
          <label title="Name shown in the layer stack and timeline.">Layer name</label>
          <input value={layer.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label><input type="checkbox" checked={layer.visible} onChange={(event) => onUpdate({ visible: event.target.checked })} /> Visible</label>
          <label><input type="checkbox" checked={layer.locked} onChange={(event) => onUpdate({ locked: event.target.checked })} /> Locked</label>
        </div>
      </details>

      <details open className="alert-inspector-section">
        <summary>Transform</summary>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div><label>X</label><input type="number" value={layer.x} onChange={(event) => onUpdate({ x: Number(event.target.value) })} /></div>
          <div><label>Y</label><input type="number" value={layer.y} onChange={(event) => onUpdate({ y: Number(event.target.value) })} /></div>
          <div><label>Width</label><input type="number" value={layer.width} onChange={(event) => onUpdate({ width: Number(event.target.value) })} /></div>
          <div><label>Height</label><input type="number" value={layer.height} onChange={(event) => onUpdate({ height: Number(event.target.value) })} /></div>
          <div><label>Rotation</label><input type="number" value={layer.rotation} onChange={(event) => onUpdate({ rotation: Number(event.target.value) })} /></div>
          <div><label>Scale</label><input type="number" step="0.05" value={layer.scale} onChange={(event) => onUpdate({ scale: Number(event.target.value) })} /></div>
        </div>
        <div className="actions" style={{ marginBottom: 0 }}>
          {(["left", "center", "right", "top", "middle", "bottom"] as AlertLayerAlignment[]).map((alignment) => (
            <button key={alignment} type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onAlign(alignment)}>
              {alignment[0]!.toUpperCase() + alignment.slice(1)}
            </button>
          ))}
        </div>
      </details>

      <details className="alert-inspector-section">
        <summary>Animation</summary>
        <div className="form-row">
          <label>Animation preset</label>
          <select value={layer.animation?.preset ?? "none"} onChange={(event) => onApplyAnimation(event.target.value as AlertLayerAnimation["preset"])}>
            {ANIMATION_PRESETS.map((preset) => <option key={preset} value={preset}>{ANIMATION_LABELS[preset]}</option>)}
          </select>
        </div>
        <div className="animation-preset-gallery">
          {ANIMATION_PRESETS.filter((preset) => preset !== "none").map((preset) => (
            <button key={preset} type="button" className={layer.animation?.preset === preset ? "active" : ""} onClick={() => onApplyAnimation(preset)} title={`Apply ${ANIMATION_LABELS[preset]}`}>
              <span className={`animation-preset-swatch preset-${preset}`} />
              <strong>{ANIMATION_LABELS[preset]}</strong>
            </button>
          ))}
        </div>
        {layer.animation && layer.animation.preset !== "none" && (
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div><label>Anim delay (ms)</label><input type="number" value={layer.animation.delayMs} onChange={(event) => onUpdate({ animation: { ...layer.animation!, delayMs: Number(event.target.value) } } as Partial<AlertLayer>)} /></div>
            <div><label>Anim duration (ms)</label><input type="number" value={layer.animation.durationMs} onChange={(event) => onUpdate({ animation: { ...layer.animation!, durationMs: Number(event.target.value) } } as Partial<AlertLayer>)} /></div>
            <div><label>Intensity</label><input type="number" step="0.1" min={0} max={5} value={layer.animation.intensity} onChange={(event) => onUpdate({ animation: { ...layer.animation!, intensity: Number(event.target.value) } } as Partial<AlertLayer>)} /></div>
            <label style={{ alignSelf: "center", marginTop: 16 }}><input type="checkbox" checked={layer.animation.loop} onChange={(event) => onUpdate({ animation: { ...layer.animation!, loop: event.target.checked } } as Partial<AlertLayer>)} /> Loop</label>
          </div>
        )}
      </details>

      <details className="alert-inspector-section">
        <summary>Appearance</summary>
        <div className="form-row">
          <label>Opacity ({layer.opacity})</label>
          <input type="range" min={0} max={1} step={0.05} value={layer.opacity} onChange={(event) => onUpdate({ opacity: Number(event.target.value) })} />
        </div>
        <div className="form-row">
          <label>Blend mode</label>
          <select value={layer.blendMode} onChange={(event) => onUpdate({ blendMode: event.target.value })}>
            {BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div><label>Glow</label><input type="number" min={0} max={120} value={layer.filter?.glow ?? 0} onChange={(event) => onUpdateFilter({ glow: Number(event.target.value) })} /></div>
          <div><label>Glow color</label><input value={layer.filter?.glowColor ?? "rgba(91, 140, 255, 0.9)"} onChange={(event) => onUpdateFilter({ glowColor: event.target.value })} /></div>
          <div><label>Blur</label><input type="number" min={0} max={80} value={layer.filter?.blur ?? 0} onChange={(event) => onUpdateFilter({ blur: Number(event.target.value) })} /></div>
          <div><label>Hue rotate</label><input type="number" min={-360} max={360} value={layer.filter?.hueRotate ?? 0} onChange={(event) => onUpdateFilter({ hueRotate: Number(event.target.value) })} /></div>
          <div><label>Brightness</label><input type="number" min={0} max={3} step={0.05} value={layer.filter?.brightness ?? 1} onChange={(event) => onUpdateFilter({ brightness: Number(event.target.value) })} /></div>
          <div><label>Contrast</label><input type="number" min={0} max={3} step={0.05} value={layer.filter?.contrast ?? 1} onChange={(event) => onUpdateFilter({ contrast: Number(event.target.value) })} /></div>
          <div><label>Saturation</label><input type="number" min={0} max={3} step={0.05} value={layer.filter?.saturation ?? 1} onChange={(event) => onUpdateFilter({ saturation: Number(event.target.value) })} /></div>
        </div>
      </details>

      <details open className="alert-inspector-section">
        <summary>Timing</summary>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div><label title="When this layer appears during the alert.">Start (ms)</label><input type="number" value={layer.startMs} onChange={(event) => onUpdate({ startMs: Number(event.target.value) })} /></div>
          <div><label title="When this layer disappears during the alert.">End (ms)</label><input type="number" value={layer.endMs} onChange={(event) => onUpdate({ endMs: Number(event.target.value) })} /></div>
        </div>
        <div className="alert-keyframe-panel">
          <h3>Keyframes</h3>
          <div className="actions" style={{ marginBottom: 10 }}>
            {KEYFRAME_PROPERTIES.map((property) => <button key={property} type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onAddKeyframe(property)}>Add {property}</button>)}
          </div>
          {layer.keyframes.length ? (
            <div className="keyframe-list">
              {layer.keyframes.map((frame) => (
                <div key={frame.id} className="keyframe-row">
                  <input type="number" min={0} max={projectDurationMs} value={frame.atMs} title="Keyframe time in milliseconds." onChange={(event) => onUpdateKeyframe(frame.id, { atMs: Number(event.target.value) })} />
                  <select value={frame.easing} onChange={(event) => onUpdateKeyframe(frame.id, { easing: event.target.value as AlertKeyframe["easing"] })}>
                    <option value="linear">linear</option><option value="ease-in">ease-in</option><option value="ease-out">ease-out</option><option value="ease-in-out">ease-in-out</option><option value="bounce">bounce</option><option value="elastic">elastic</option>
                  </select>
                  <span>{Object.keys(frame.properties).join(", ") || "empty"}</span>
                  <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => onDeleteKeyframe(frame.id)}>Delete</button>
                </div>
              ))}
            </div>
          ) : <p className="subtitle">Move the playhead, adjust the layer, then add a keyframe for the property you want to animate.</p>}
        </div>
      </details>
    </>
  );
}
