import type { AlertLayer } from "@btv/shared";

type AlertLayerTypeInspectorProps = {
  layer: AlertLayer;
  assetUploading: boolean;
  onUpdate: (patch: Partial<AlertLayer>) => void;
  onUploadAsset: (file: File) => void;
  onTestAudio: () => void;
  onStopAudio: () => void;
};

export function AlertLayerTypeInspector({ layer, assetUploading, onUpdate, onUploadAsset, onTestAudio, onStopAudio }: AlertLayerTypeInspectorProps) {
  if (layer.type === "text") {
    return (
      <details open className="alert-inspector-section">
        <summary>Text</summary>
        <div className="form-row"><label>Text</label><textarea rows={3} value={layer.text} onChange={(event) => onUpdate({ text: event.target.value } as Partial<AlertLayer>)} /></div>
        <div className="grid alert-two-column-grid">
          <div><label>Font size</label><input type="number" value={layer.fontSize} onChange={(event) => onUpdate({ fontSize: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
          <div><label>Weight</label><input type="number" value={layer.fontWeight} onChange={(event) => onUpdate({ fontWeight: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
          <div><label>Color</label><input type="color" value={layer.color} onChange={(event) => onUpdate({ color: event.target.value } as Partial<AlertLayer>)} /></div>
          <div><label>Align</label><select value={layer.align} onChange={(event) => onUpdate({ align: event.target.value } as Partial<AlertLayer>)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
          <div><label>Text shadow</label><input value={layer.shadow ?? ""} onChange={(event) => onUpdate({ shadow: event.target.value } as Partial<AlertLayer>)} placeholder="0 0 18px #5b8cff" /></div>
          <div><label>Stroke width</label><input type="number" min={0} max={24} value={layer.strokeWidth} onChange={(event) => onUpdate({ strokeWidth: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
          <div><label>Stroke color</label><input value={layer.strokeColor ?? "#000000"} onChange={(event) => onUpdate({ strokeColor: event.target.value } as Partial<AlertLayer>)} /></div>
        </div>
      </details>
    );
  }

  if (layer.type === "shape") {
    return (
      <details open className="alert-inspector-section">
        <summary>Shape</summary>
        <div className="grid alert-two-column-grid">
          <div><label>Fill</label><input value={layer.fill} onChange={(event) => onUpdate({ fill: event.target.value } as Partial<AlertLayer>)} /></div>
          <div><label>Radius</label><input type="number" value={layer.radius} onChange={(event) => onUpdate({ radius: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
          <div><label>Shape</label><select value={layer.shape} onChange={(event) => onUpdate({ shape: event.target.value } as Partial<AlertLayer>)}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option></select></div>
        </div>
      </details>
    );
  }

  if (layer.type === "particle") {
    return (
      <details open className="alert-inspector-section">
        <summary>Particle</summary>
        <div className="grid alert-two-column-grid">
          <div><label>Particle type</label><select value={layer.particle} onChange={(event) => onUpdate({ particle: event.target.value } as Partial<AlertLayer>)}><option value="confetti">Confetti</option><option value="spark">Spark</option><option value="burst">Burst</option><option value="embers">Embers</option><option value="snow">Snow</option></select></div>
          <div><label>Count</label><input type="number" min={1} max={1000} value={layer.count} onChange={(event) => onUpdate({ count: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
          <div><label>Color</label><input type="color" value={layer.color} onChange={(event) => onUpdate({ color: event.target.value } as Partial<AlertLayer>)} /></div>
          <div><label>Spread</label><input type="number" min={0} max={360} value={layer.spread} onChange={(event) => onUpdate({ spread: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
          <div><label>Speed</label><input type="number" min={0} max={10} step={0.1} value={layer.speed} onChange={(event) => onUpdate({ speed: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
        </div>
      </details>
    );
  }

  if (layer.type === "browser") {
    return (
      <details open className="alert-inspector-section alert-advanced-panel">
        <summary>Browser</summary>
        <h3>Advanced Code</h3>
        <p className="subtitle">Custom browser layers are sandboxed by default. JavaScript is disabled unless you turn off the sandbox, and Safe mode disables it during playback.</p>
        <div className="form-row"><label>HTML</label><textarea rows={4} value={layer.html} onChange={(event) => onUpdate({ html: event.target.value } as Partial<AlertLayer>)} /></div>
        <div className="form-row"><label>CSS</label><textarea rows={4} value={layer.css} onChange={(event) => onUpdate({ css: event.target.value } as Partial<AlertLayer>)} /></div>
        <div className="form-row"><label>JavaScript hook</label><textarea rows={3} value={layer.js} onChange={(event) => onUpdate({ js: event.target.value } as Partial<AlertLayer>)} /></div>
        <label><input type="checkbox" checked={layer.sandbox} onChange={(event) => onUpdate({ sandbox: event.target.checked } as Partial<AlertLayer>)} /> Sandbox iframe</label>
        <details>
          <summary>Event payload and lifecycle notes</summary>
          <p className="subtitle">Text layers support <code>{"{user}"}</code>, <code>{"{login}"}</code>, <code>{"{event}"}</code>, <code>{"{amount}"}</code>, <code>{"{message}"}</code>, <code>{"{var:hype}"}</code>, and <code>{"{payload.rewardTitle}"}</code>. Browser layer JavaScript runs inside the iframe when sandbox scripts are allowed; keep setup code self-contained.</p>
        </details>
      </details>
    );
  }

  if (layer.type !== "image" && layer.type !== "gif" && layer.type !== "video" && layer.type !== "audio") return null;

  return (
    <>
      <details open className="alert-inspector-section">
        <summary>Media</summary>
        <div className="form-row"><label>Asset URL</label><input value={layer.assetUrl} onChange={(event) => onUpdate({ assetUrl: event.target.value } as Partial<AlertLayer>)} /></div>
        {(layer.type === "audio" || layer.type === "video") && (
          <div className="form-row">
            <label>{layer.type === "audio" ? "Upload audio" : "Upload video"}</label>
            <input
              type="file"
              accept={layer.type === "audio" ? "audio/*,.mp3,.wav,.ogg,.m4a,.webm" : "video/*,.mp4,.webm,.mov"}
              disabled={assetUploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) onUploadAsset(file);
              }}
            />
            {assetUploading && <p className="subtitle">Uploading asset...</p>}
          </div>
        )}
        {layer.type !== "audio" && <div className="form-row"><label>Fit</label><select value={layer.fit} onChange={(event) => onUpdate({ fit: event.target.value } as Partial<AlertLayer>)}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Fill</option></select></div>}
      </details>

      {layer.type === "audio" && (
        <>
          <details open className="alert-inspector-section">
            <summary>Audio</summary>
            <div className="grid alert-two-column-grid">
              <div><label>Volume</label><input type="number" min={0} max={1} step={0.05} value={layer.volume} onChange={(event) => onUpdate({ volume: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
              <div><label>Start offset (ms)</label><input type="number" min={0} value={layer.startOffsetMs ?? 0} onChange={(event) => onUpdate({ startOffsetMs: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
              <div><label>Fade in (ms)</label><input type="number" min={0} value={layer.fadeInMs ?? 0} onChange={(event) => onUpdate({ fadeInMs: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
              <div><label>Fade out (ms)</label><input type="number" min={0} value={layer.fadeOutMs ?? 0} onChange={(event) => onUpdate({ fadeOutMs: Number(event.target.value) } as Partial<AlertLayer>)} /></div>
              <label className="alert-field-check"><input type="checkbox" checked={layer.loop} onChange={(event) => onUpdate({ loop: event.target.checked } as Partial<AlertLayer>)} /> Loop</label>
              <label className="alert-field-check alert-field-check--flush"><input type="checkbox" checked={layer.muted} onChange={(event) => onUpdate({ muted: event.target.checked } as Partial<AlertLayer>)} /> Muted</label>
            </div>
            <div className="actions alert-actions-flat">
              <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onTestAudio} disabled={!layer.assetUrl || layer.muted}>Test sound</button>
              <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onStopAudio}>Stop sound</button>
            </div>
          </details>
          <details className="alert-inspector-section">
            <summary>Reactive</summary>
            <div className="grid alert-two-column-grid">
              <label className="alert-field-check"><input type="checkbox" checked={layer.reactive?.enabled ?? false} onChange={(event) => onUpdate({ reactive: { ...(layer.reactive ?? { mode: "none", sensitivity: 1 }), enabled: event.target.checked } } as Partial<AlertLayer>)} /> Reactive</label>
              <div><label>Mode</label><select value={layer.reactive?.mode ?? "none"} onChange={(event) => onUpdate({ reactive: { ...(layer.reactive ?? { enabled: false, sensitivity: 1 }), mode: event.target.value as "none" | "amplitude" | "bass" } } as Partial<AlertLayer>)}><option value="none">None</option><option value="amplitude">Amplitude</option><option value="bass">Bass</option></select></div>
              <div><label>Sensitivity</label><input type="number" min={0} max={5} step={0.1} value={layer.reactive?.sensitivity ?? 1} onChange={(event) => onUpdate({ reactive: { ...(layer.reactive ?? { enabled: false, mode: "none" }), sensitivity: Number(event.target.value) } } as Partial<AlertLayer>)} /></div>
            </div>
          </details>
        </>
      )}

      {layer.type === "video" && (
        <details open className="alert-inspector-section">
          <summary>Playback</summary>
          <div className="grid alert-two-column-grid">
            <label><input type="checkbox" checked={layer.loop} onChange={(event) => onUpdate({ loop: event.target.checked } as Partial<AlertLayer>)} /> Loop</label>
            <label><input type="checkbox" checked={layer.muted} onChange={(event) => onUpdate({ muted: event.target.checked } as Partial<AlertLayer>)} /> Muted</label>
          </div>
        </details>
      )}
    </>
  );
}
