import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { AlertLayer, AlertProject } from "@btv/shared";
import { AlertPreviewErrorBoundary, PreviewLayer, type ResizeHandle, type TestPayload } from "./AlertPreview";

export type PreviewBackground = "checkerboard" | "dark" | "transparent";
export type PreviewZoom = "fit" | 0.25 | 0.5 | 1;

type AlertCanvasWorkspaceProps = {
  project: AlertProject;
  visibleLayers: AlertLayer[];
  selectedLayerId: string;
  playheadMs: number;
  playing: boolean;
  showSafeZones: boolean;
  previewBackground: PreviewBackground;
  previewZoom: PreviewZoom;
  testPayload: TestPayload;
  overlayOrigin: string;
  canvasRef: RefObject<HTMLDivElement | null>;
  onPlayingChange: (playing: boolean) => void;
  onRestart: () => void;
  onSafeZonesChange: (shown: boolean) => void;
  onBackgroundChange: (background: PreviewBackground) => void;
  onZoomChange: (zoom: PreviewZoom) => void;
  onSelectLayer: (layerId: string) => void;
  onPlayheadChange: (playheadMs: number) => void;
  onTimelineZoomChange: (zoom: number) => void;
  onCanvasPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPointerEnd: () => void;
  onLayerPointerDown: (layer: AlertLayer, event: ReactPointerEvent<HTMLDivElement>) => void;
  onLayerResizePointerDown: (layer: AlertLayer, handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onLayerRotatePointerDown: (layer: AlertLayer, event: ReactPointerEvent<HTMLSpanElement>) => void;
};

function pct(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

export function AlertCanvasWorkspace({
  project,
  visibleLayers,
  selectedLayerId,
  playheadMs,
  playing,
  showSafeZones,
  previewBackground,
  previewZoom,
  testPayload,
  overlayOrigin,
  canvasRef,
  onPlayingChange,
  onRestart,
  onSafeZonesChange,
  onBackgroundChange,
  onZoomChange,
  onSelectLayer,
  onPlayheadChange,
  onTimelineZoomChange,
  onCanvasPointerMove,
  onCanvasPointerEnd,
  onLayerPointerDown,
  onLayerResizePointerDown,
  onLayerRotatePointerDown,
}: AlertCanvasWorkspaceProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.34);
  const previewScale = previewZoom === "fit" ? fitScale : previewZoom;

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const updateFitScale = () => {
      const rect = shell.getBoundingClientRect();
      const padding = 24;
      const widthScale = Math.max(0.05, (rect.width - padding) / project.canvas.width);
      const heightScale = Math.max(0.05, (rect.height - padding) / project.canvas.height);
      setFitScale(Math.min(1, widthScale, heightScale));
    };

    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [project.canvas.width, project.canvas.height]);

  return (
    <section className="card alert-preview-card">
      <div className="alert-editor-panel-title">
        <h2>Live Preview</h2>
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onPlayingChange(!playing)}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onRestart}>Restart</button>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
        <div>
          <label>Preview background</label>
          <select value={previewBackground} onChange={(event) => onBackgroundChange(event.target.value as PreviewBackground)}>
            <option value="checkerboard">Checkerboard</option>
            <option value="dark">Dark</option>
            <option value="transparent">Transparent</option>
          </select>
        </div>
        <label style={{ alignSelf: "center", marginTop: 16 }}>
          <input type="checkbox" checked={showSafeZones} onChange={(event) => onSafeZonesChange(event.target.checked)} /> Safe zones
        </label>
      </div>
      <div className="alert-preview-tools">
        <span>{project.canvas.width}x{project.canvas.height}</span>
        <div className="segmented">
          <button type="button" className={previewZoom === "fit" ? "active" : ""} onClick={() => onZoomChange("fit")} title="Fit the full alert canvas into the preview area.">Fit</button>
          <button type="button" className={previewZoom === 0.25 ? "active" : ""} onClick={() => onZoomChange(0.25)} title="Preview at 25% scale.">25%</button>
          <button type="button" className={previewZoom === 0.5 ? "active" : ""} onClick={() => onZoomChange(0.5)} title="Preview at 50% scale.">50%</button>
          <button type="button" className={previewZoom === 1 ? "active" : ""} onClick={() => onZoomChange(1)} title="Preview at full canvas scale.">100%</button>
        </div>
      </div>
      <div className="alert-preview-shell" ref={shellRef}>
        <div
          ref={canvasRef}
          className={`alert-preview-canvas ${previewBackground === "checkerboard" ? "checkerboard" : ""} ${previewBackground === "dark" ? "dark" : ""}`}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onSelectLayer("");
          }}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerEnd}
          onPointerCancel={onCanvasPointerEnd}
          style={{
            width: project.canvas.width,
            height: project.canvas.height,
            background: project.canvas.background === "solid" ? project.canvas.backgroundColor : undefined,
            transform: `scale(${previewScale})`,
          }}
        >
          <AlertPreviewErrorBoundary>
            {showSafeZones && <div className="alert-safe-zone" />}
            {visibleLayers.map((layer) => (
              <PreviewLayer
                key={layer.id}
                layer={layer}
                eventType={project.eventType}
                testPayload={testPayload}
                selected={selectedLayerId === layer.id}
                playheadMs={playheadMs}
                overlayOrigin={overlayOrigin}
                onPointerDown={(event) => onLayerPointerDown(layer, event)}
                onResizePointerDown={(handle, event) => onLayerResizePointerDown(layer, handle, event)}
                onRotatePointerDown={(event) => onLayerRotatePointerDown(layer, event)}
              />
            ))}
          </AlertPreviewErrorBoundary>
        </div>
      </div>
      <div className="alert-timeline">
        <div className="alert-timeline-header">
          <span>{Math.round(playheadMs)}ms</span>
          <input
            title="Scrub the alert timeline preview."
            type="range"
            min={0}
            max={project.durationMs}
            value={playheadMs}
            onChange={(event) => {
              onPlayingChange(false);
              onPlayheadChange(Number(event.target.value));
            }}
          />
          <span>{project.durationMs}ms</span>
          <label className="timeline-zoom-control">
            Zoom
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.25}
              value={project.timeline?.zoom ?? 1}
              onChange={(event) => onTimelineZoomChange(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="alert-timeline-tracks" style={{ minWidth: `${Math.round((project.timeline?.zoom ?? 1) * 100)}%` }}>
          {project.layers.map((layer) => {
            const left = pct(layer.startMs, project.durationMs);
            const width = pct(layer.endMs - layer.startMs, project.durationMs);
            const layerDuration = Math.max(1, layer.endMs - layer.startMs);
            return (
              <button
                key={layer.id}
                type="button"
                className={`alert-timeline-track${selectedLayerId === layer.id ? " active" : ""}${layer.type === "audio" ? " audio" : ""}`}
                onClick={() => onSelectLayer(layer.id)}
                title="Layer timing. Edit Start and End in Properties."
              >
                <span>{layer.name}</span>
                <i style={{ left, width }} />
                {layer.type === "audio" && (
                  <b
                    className="alert-audio-bar"
                    style={{
                      left,
                      width,
                      "--offset": pct(layer.startOffsetMs ?? 0, layerDuration),
                      "--fade-in": pct(layer.fadeInMs ?? 0, layerDuration),
                      "--fade-out": pct(layer.fadeOutMs ?? 0, layerDuration),
                    } as CSSProperties}
                  />
                )}
              </button>
            );
          })}
          <b className="alert-playhead" style={{ left: `${(playheadMs / project.durationMs) * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
