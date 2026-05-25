import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type ObsBrowserSourceCanvas,
  type ObsBrowserSourceLayout,
  type ObsBrowserSourceShape,
  type ObsBrowserSourceStatus,
  type ObsSceneInfo,
  type OverlayInfo,
  type OverlayPackSummary,
  type PreflightInfo,
} from "../api";
import { useToast } from "../hooks/useToast";
import { PageHeader } from "../ui";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MIN_SOURCE_SIZE = 32;

type DragState =
  | { mode: "move"; id: string; pointerId: number; startX: number; startY: number; original: ObsBrowserSourceLayout }
  | { mode: "resize"; id: string; pointerId: number; startX: number; startY: number; original: ObsBrowserSourceLayout };

const RESOLUTION_PRESETS = [
  { label: "1920 x 1080", width: 1920, height: 1080 },
  { label: "2560 x 1440", width: 2560, height: 1440 },
  { label: "3840 x 2160", width: 3840, height: 2160 },
  { label: "3440 x 1440 ultrawide", width: 3440, height: 1440 },
  { label: "2560 x 1080 ultrawide", width: 2560, height: 1080 },
  { label: "1280 x 720", width: 1280, height: 720 },
];

function makeQuickPresets(canvas: ObsBrowserSourceCanvas) {
  const sideWidth = Math.round(canvas.width * 0.25);
  const sideHeight = Math.round(canvas.height * 0.25);
  const marginX = Math.round(canvas.width * 0.02);
  const marginY = Math.round(canvas.height * 0.04);
  return [
    { label: "Fullscreen", x: 0, y: 0, width: canvas.width, height: canvas.height },
    { label: "Lower third", x: Math.round(canvas.width * 0.125), y: Math.round(canvas.height * 0.7), width: Math.round(canvas.width * 0.75), height: Math.round(canvas.height * 0.2) },
    { label: "Top left", x: marginX, y: marginY, width: sideWidth, height: sideHeight },
    { label: "Top right", x: canvas.width - sideWidth - marginX, y: marginY, width: sideWidth, height: sideHeight },
    { label: "Bottom left", x: marginX, y: canvas.height - sideHeight - marginY, width: sideWidth, height: sideHeight },
    { label: "Bottom right", x: canvas.width - sideWidth - marginX, y: canvas.height - sideHeight - marginY, width: sideWidth, height: sideHeight },
  ];
}

export default function OverlaysPage() {
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [packs, setPacks] = useState<OverlayPackSummary[]>([]);
  const [canvas, setCanvas] = useState<ObsBrowserSourceCanvas>({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const [layouts, setLayouts] = useState<ObsBrowserSourceLayout[]>([]);
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [obsScenes, setObsScenes] = useState<ObsSceneInfo[]>([]);
  const [selectedScene, setSelectedScene] = useState("");
  const [selectedLayoutId, setSelectedLayoutId] = useState("alerts");
  const [installing, setInstalling] = useState(false);
  const [savingPack, setSavingPack] = useState(false);
  const [applyingPackId, setApplyingPackId] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);
  const [applyingLayout, setApplyingLayout] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [wsOk, setWsOk] = useState<boolean | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  const overlayById = useMemo(() => new Map(overlays.map((overlay) => [overlay.id, overlay])), [overlays]);
  const selectedLayout = layouts.find((layout) => layout.id === selectedLayoutId) ?? layouts[0];
  const quickPresets = useMemo(() => makeQuickPresets(canvas), [canvas]);
  const selectedResolution = RESOLUTION_PRESETS.find((preset) => preset.width === canvas.width && preset.height === canvas.height)?.label ?? "custom";

  const load = () => {
    void api.overlays().then((r) => setOverlays(r.overlays));
    void api.overlayPacks().then((r) => setPacks(r.packs));
    void api.browserSourceLayouts().then((r) => {
      setCanvas(r.canvas);
      setLayouts(r.layouts);
    });
    void api.preflight().then(setPreflight).catch(() => setPreflight(null));
    void api.health().then((h) => setWsOk(h.ok));
    void api
      .obsScenes()
      .then((res) => {
        setObsScenes(res.scenes);
        setSelectedScene((current) => current || res.currentScene || res.scenes[0]?.sceneName || "");
      })
      .catch(() => {
        setObsScenes([]);
        setSelectedScene("");
      });
  };

  useEffect(() => {
    load();
  }, []);

  const copy = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast("URL copied to clipboard");
  };

  const updateLayout = (id: string, patch: Partial<ObsBrowserSourceLayout>) => {
    setLayouts((current) =>
      current.map((layout) => layout.id === id ? clampLayout({ ...layout, ...patch }, canvas) : layout),
    );
  };

  const updateCanvas = (nextCanvas: ObsBrowserSourceCanvas, scaleLayout = true) => {
    const normalized = normalizeCanvas(nextCanvas);
    setLayouts((current) => scaleLayout ? scaleLayouts(current, canvas, normalized) : current.map((layout) => clampLayout(layout, normalized)));
    setCanvas(normalized);
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selectedLayout || selectedLayout.locked) return;
    updateLayout(selectedLayout.id, { x: selectedLayout.x + dx, y: selectedLayout.y + dy });
  };

  const copyManualSetup = async () => {
    const lines = overlays.flatMap((overlay) => {
      const layout = layouts.find((item) => item.id === overlay.id);
      return [
        `${overlay.name}`,
        `URL: ${overlay.url}`,
        `Position: ${layout?.x ?? 0}, ${layout?.y ?? 0}`,
        `Canvas: ${canvas.width} x ${canvas.height}`,
        `Size: ${layout?.width ?? canvas.width} x ${layout?.height ?? canvas.height}`,
        `Shape: ${layout?.shape ?? "rectangle"}`,
        "Background: transparent",
        "",
      ];
    });
    await navigator.clipboard.writeText(lines.join("\n"));
    toast("OBS setup checklist copied");
  };

  const createPack = async () => {
    const name = window.prompt("Name this overlay pack", `Overlay pack ${new Date().toLocaleDateString()}`);
    if (!name?.trim()) return;
    setSavingPack(true);
    try {
      const res = await api.createOverlayPack({
        name: name.trim(),
        description: `Snapshot created from the Overlays page on ${new Date().toLocaleString()}`,
      });
      setPacks((current) => [res.pack, ...current.filter((pack) => pack.id !== res.pack.id)]);
      toast(`Overlay pack saved: ${res.pack.name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save overlay pack");
    } finally {
      setSavingPack(false);
    }
  };

  const applyPack = async (pack: OverlayPackSummary) => {
    if (!window.confirm(`Apply "${pack.name}"? This will update widgets, alerts, themes, and browser source layouts.`)) return;
    setApplyingPackId(pack.id);
    try {
      await api.applyOverlayPack(pack.id);
      toast(`Applied overlay pack: ${pack.name}`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not apply overlay pack");
    } finally {
      setApplyingPackId("");
    }
  };

  const deletePack = async (pack: OverlayPackSummary) => {
    if (!window.confirm(`Delete overlay pack "${pack.name}"?`)) return;
    try {
      await api.deleteOverlayPack(pack.id);
      setPacks((current) => current.filter((item) => item.id !== pack.id));
      toast(`Deleted overlay pack: ${pack.name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete overlay pack");
    }
  };

  const installBrowserSources = async () => {
    setInstalling(true);
    try {
      const res = await api.ensureObsBrowserSources(selectedScene || undefined);
      const changed = res.sources.filter((source) => source.action && source.action !== "unchanged").length;
      toast(`OBS browser sources checked in ${res.sceneName}; ${changed} updated`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not install OBS browser sources");
    } finally {
      setInstalling(false);
    }
  };

  const saveLayouts = async () => {
    setSavingLayout(true);
    try {
      const res = await api.saveBrowserSourceLayouts(layouts, canvas);
      setCanvas(res.canvas);
      setLayouts(res.layouts);
      toast("Browser source layout saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save browser source layout");
    } finally {
      setSavingLayout(false);
    }
  };

  const applyLayouts = async () => {
    setApplyingLayout(true);
    try {
      const res = await api.applyBrowserSourceLayouts(selectedScene || undefined, layouts, canvas);
      setCanvas(res.canvas);
      setLayouts(res.layouts);
      const applied = res.sources.filter((source) => source.layoutApplied).length;
      toast(`Applied ${applied}/${res.sources.length} browser source layouts to ${res.sceneName}`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not apply browser source layouts");
    } finally {
      setApplyingLayout(false);
    }
  };

  const resetLayouts = async () => {
    try {
      const res = await api.saveBrowserSourceLayouts([], canvas);
      setCanvas(res.canvas);
      setLayouts(res.layouts);
      setSelectedLayoutId(res.layouts[0]?.id ?? "alerts");
      toast("Browser source layout reset");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not reset browser source layout");
    }
  };

  const overlayStatus = (id: string): ObsBrowserSourceStatus | undefined =>
    preflight?.expectedOverlays.find((overlay) => overlay.id === id)?.obsSource;

  const pointFromEvent = (event: PointerEvent<HTMLElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const beginMove = (event: PointerEvent<HTMLButtonElement>, layout: ObsBrowserSourceLayout) => {
    if (layout.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setSelectedLayoutId(layout.id);
    setDragState({ mode: "move", id: layout.id, pointerId: event.pointerId, startX: point.x, startY: point.y, original: layout });
  };

  const beginResize = (event: PointerEvent<HTMLSpanElement>, layout: ObsBrowserSourceLayout) => {
    if (layout.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setSelectedLayoutId(layout.id);
    setDragState({ mode: "resize", id: layout.id, pointerId: event.pointerId, startX: point.x, startY: point.y, original: layout });
  };

  const drag = (event: PointerEvent<HTMLElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const point = pointFromEvent(event);
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;
    if (dragState.mode === "move") {
      updateLayout(dragState.id, {
        x: snap(dragState.original.x + dx, snapToGrid),
        y: snap(dragState.original.y + dy, snapToGrid),
      });
      return;
    }
    updateLayout(dragState.id, {
      width: snap(dragState.original.width + dx, snapToGrid),
      height: snap(dragState.original.height + dy, snapToGrid),
    });
  };

  const endDrag = () => setDragState(null);

  const applyPreset = (preset: ReturnType<typeof makeQuickPresets>[number]) => {
    if (!selectedLayout) return;
    updateLayout(selectedLayout.id, preset);
  };

  return (
    <>
      <PageHeader
        title="Overlays"
        description={
          <>
            Add these URLs as Browser Sources in OBS and use the layout editor to place, size, and shape them.
            {wsOk != null && (
              <span style={{ marginLeft: 8 }}>
                Server: {wsOk ? (
                  <span className="badge badge-ok">online</span>
                ) : (
                  <span className="badge badge-off">offline</span>
                )}
              </span>
            )}
          </>
        }
      />
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        Live chat requires <code>http://127.0.0.1:4782/o/chat.html</code> and Twitch reconnect with{" "}
        <code>user:read:chat</code>.
      </p>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>OBS Install Helper</h2>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Create or repair BTV browser sources in OBS, then apply your saved layout to the selected scene.
            </p>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void installBrowserSources()} disabled={installing || !obsScenes.length}>
              {installing ? "Installing..." : "Install / repair in OBS"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyManualSetup()}>
              Copy manual setup
            </button>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "minmax(220px, 360px) minmax(0, 1fr)", marginTop: 12 }}>
          <div>
            <label>Target OBS scene</label>
            <select value={selectedScene} onChange={(e) => setSelectedScene(e.target.value)} disabled={!obsScenes.length}>
              {obsScenes.length ? obsScenes.map((scene) => (
                <option key={scene.sceneName} value={scene.sceneName}>{scene.sceneName}</option>
              )) : (
                <option value="">OBS WebSocket offline</option>
              )}
            </select>
          </div>
          <div>
            <label>Browser source control</label>
            <div className="url-box">Use the workspace below for source position, dimensions, shape, opacity, visibility, and lock state.</div>
          </div>
        </div>
      </div>

      <div className="card overlay-pack-card">
        <div className="overlay-pack-header">
          <div>
            <h2>Overlay Packs</h2>
            <p>
              Snapshot the current alerts, widgets, legacy themes, and browser source layout as a reusable pack.
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void createPack()} disabled={savingPack}>
            {savingPack ? "Saving..." : "Save current as pack"}
          </button>
        </div>
        {packs.length ? (
          <div className="overlay-pack-grid">
            {packs.map((pack) => (
              <div key={pack.id} className="overlay-pack-item">
                <div>
                  <strong>{pack.name}</strong>
                  <span>{pack.description || `Updated ${formatDateTime(pack.updatedAt)}`}</span>
                </div>
                <p>
                  {pack.counts.alertProjects} alert projects, {pack.counts.alertRules} rules,{" "}
                  {pack.counts.widgets} widgets, {pack.counts.browserSourceLayouts} source layouts
                  {pack.counts.overlayTheme ? ", theme included" : ""}
                </p>
                <div className="actions" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void applyPack(pack)}
                    disabled={applyingPackId === pack.id}
                  >
                    {applyingPackId === pack.id ? "Applying..." : "Apply pack"}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void deletePack(pack)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtitle" style={{ marginBottom: 0 }}>
            No overlay packs saved yet. Save one once you have a layout and alert/widget setup worth reusing.
          </p>
        )}
      </div>

      <div className="card overlay-layout-editor">
        <div className="overlay-layout-header">
          <div>
            <h2>Browser Source Layout Editor</h2>
            <p>Drag sources around the mock OBS canvas. Resize from the corner, then save or apply directly to OBS.</p>
          </div>
          <div className="actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void applyLayouts()} disabled={applyingLayout || !obsScenes.length}>
              {applyingLayout ? "Applying..." : "Apply to OBS"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void saveLayouts()} disabled={savingLayout}>
              {savingLayout ? "Saving..." : "Save layout"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void resetLayouts()}>
              Reset defaults
            </button>
            <label className="overlay-layout-snap-toggle">
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
              Snap 10px
            </label>
          </div>
        </div>

        <div className="overlay-resolution-bar">
          <div>
            <label>Canvas / monitor resolution</label>
            <select
              value={selectedResolution}
              onChange={(e) => {
                const preset = RESOLUTION_PRESETS.find((item) => item.label === e.target.value);
                if (preset) updateCanvas({ width: preset.width, height: preset.height });
              }}
            >
              {RESOLUTION_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>{preset.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label>Width</label>
            <input type="number" min={320} max={7680} value={canvas.width} onChange={(e) => updateCanvas({ ...canvas, width: Number(e.target.value) })} />
          </div>
          <div>
            <label>Height</label>
            <input type="number" min={180} max={4320} value={canvas.height} onChange={(e) => updateCanvas({ ...canvas, height: Number(e.target.value) })} />
          </div>
          <div className="url-box">Canvas coordinates: 0,0 to {canvas.width},{canvas.height}. Apply to OBS uses this exact coordinate space.</div>
        </div>

        <div className="overlay-layout-grid">
          <div className="overlay-layout-stage-shell">
            <div
              ref={stageRef}
              className="overlay-layout-stage"
              style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
              onPointerMove={drag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div className="overlay-layout-safe-zone" />
              {layouts.map((layout) => {
                const overlay = overlayById.get(layout.id);
                const active = layout.id === selectedLayoutId;
                return (
                  <button
                    type="button"
                    key={layout.id}
                    className={`overlay-layout-source${active ? " active" : ""}${layout.locked ? " locked" : ""}`}
                    style={{
                      left: `${(layout.x / canvas.width) * 100}%`,
                      top: `${(layout.y / canvas.height) * 100}%`,
                      width: `${(layout.width / canvas.width) * 100}%`,
                      height: `${(layout.height / canvas.height) * 100}%`,
                      borderRadius: layout.shape === "circle" ? "9999px" : layout.shape === "rounded" ? `${Math.max(0, layout.borderRadius / 6)}px` : 4,
                      clipPath: cropClipPath(layout),
                      opacity: layout.visible ? Math.max(0.15, layout.opacity) : 0.28,
                      transform: `rotate(${layout.rotation}deg)`,
                    }}
                    onPointerDown={(event) => beginMove(event, layout)}
                    onClick={() => setSelectedLayoutId(layout.id)}
                  >
                    <span>{overlay?.name ?? layout.id}</span>
                    <em>{Math.round(layout.width)} x {Math.round(layout.height)}</em>
                    {!layout.locked && (
                      <span
                        className="overlay-layout-resize"
                        aria-label={`Resize ${overlay?.name ?? layout.id}`}
                        onPointerDown={(event) => beginResize(event, layout)}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overlay-layout-properties">
            {selectedLayout ? (
              <>
                <label>Selected source</label>
                <select value={selectedLayout.id} onChange={(e) => setSelectedLayoutId(e.target.value)}>
                  {layouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>{overlayById.get(layout.id)?.name ?? layout.id}</option>
                  ))}
                </select>

                <div className="overlay-layout-numbers">
                  <div>
                    <label>X</label>
                    <input type="number" value={selectedLayout.x} onChange={(e) => updateLayout(selectedLayout.id, { x: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Y</label>
                    <input type="number" value={selectedLayout.y} onChange={(e) => updateLayout(selectedLayout.id, { y: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Width</label>
                    <input type="number" min={MIN_SOURCE_SIZE} value={selectedLayout.width} onChange={(e) => updateLayout(selectedLayout.id, { width: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Height</label>
                    <input type="number" min={MIN_SOURCE_SIZE} value={selectedLayout.height} onChange={(e) => updateLayout(selectedLayout.id, { height: Number(e.target.value) })} />
                  </div>
                </div>

                <label>Nudge selected</label>
                <div className="overlay-layout-nudge">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => nudgeSelected(0, -10)}>Up</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => nudgeSelected(-10, 0)}>Left</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => nudgeSelected(10, 0)}>Right</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => nudgeSelected(0, 10)}>Down</button>
                </div>

                <label>Rotation</label>
                <div className="overlay-layout-range-row">
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedLayout.rotation}
                    onChange={(e) => updateLayout(selectedLayout.id, { rotation: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    value={selectedLayout.rotation}
                    onChange={(e) => updateLayout(selectedLayout.id, { rotation: Number(e.target.value) })}
                  />
                </div>

                <label>Shape</label>
                <select value={selectedLayout.shape} onChange={(e) => updateLayout(selectedLayout.id, { shape: e.target.value as ObsBrowserSourceShape })}>
                  <option value="rectangle">Rectangle</option>
                  <option value="rounded">Rounded</option>
                  <option value="circle">Circle / pill crop</option>
                </select>

                <label>Corner radius</label>
                <input
                  type="range"
                  min={0}
                  max={540}
                  value={selectedLayout.borderRadius}
                  disabled={selectedLayout.shape !== "rounded"}
                  onChange={(e) => updateLayout(selectedLayout.id, { borderRadius: Number(e.target.value) })}
                />

                <label>Crop</label>
                <div className="overlay-layout-numbers">
                  <div>
                    <label>Top</label>
                    <input type="number" min={0} value={selectedLayout.cropTop} onChange={(e) => updateLayout(selectedLayout.id, { cropTop: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Right</label>
                    <input type="number" min={0} value={selectedLayout.cropRight} onChange={(e) => updateLayout(selectedLayout.id, { cropRight: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Bottom</label>
                    <input type="number" min={0} value={selectedLayout.cropBottom} onChange={(e) => updateLayout(selectedLayout.id, { cropBottom: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label>Left</label>
                    <input type="number" min={0} value={selectedLayout.cropLeft} onChange={(e) => updateLayout(selectedLayout.id, { cropLeft: Number(e.target.value) })} />
                  </div>
                </div>

                <label>Opacity</label>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={selectedLayout.opacity}
                  onChange={(e) => updateLayout(selectedLayout.id, { opacity: Number(e.target.value) })}
                />

                <div className="overlay-layout-toggles">
                  <label><input type="checkbox" checked={selectedLayout.visible} onChange={(e) => updateLayout(selectedLayout.id, { visible: e.target.checked })} /> Visible in OBS</label>
                  <label><input type="checkbox" checked={selectedLayout.locked} onChange={(e) => updateLayout(selectedLayout.id, { locked: e.target.checked })} /> Lock in editor</label>
                </div>

                <label>Quick placement</label>
                <div className="overlay-layout-presets">
                  {quickPresets.map((preset) => (
                    <button key={preset.label} type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(preset)}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: "var(--muted)" }}>No browser source layouts are available yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid">
        {overlays.map((o) => (
          <div key={o.id} className="card">
            <h2>{o.name}</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Channels: {o.channels.join(", ")}
            </p>
            {overlayStatus(o.id) && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                OBS: {overlayStatus(o.id)?.configured
                  ? overlayStatus(o.id)?.correctUrl
                    ? `configured as ${overlayStatus(o.id)?.sourceName}`
                    : `URL mismatch on ${overlayStatus(o.id)?.sourceName}`
                  : "not configured"}
              </p>
            )}
            <div className="url-box">{o.url}</div>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(o.url)}>
                Copy OBS URL
              </button>
              <a href={o.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                Preview
              </a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function clampLayout(layout: ObsBrowserSourceLayout, canvas: ObsBrowserSourceCanvas): ObsBrowserSourceLayout {
  const width = clamp(layout.width, MIN_SOURCE_SIZE, canvas.width);
  const height = clamp(layout.height, MIN_SOURCE_SIZE, canvas.height);
  const cropLeft = clamp(layout.cropLeft, 0, width - 1);
  const cropRight = clamp(layout.cropRight, 0, Math.max(0, width - cropLeft - 1));
  const cropTop = clamp(layout.cropTop, 0, height - 1);
  const cropBottom = clamp(layout.cropBottom, 0, Math.max(0, height - cropTop - 1));
  return {
    ...layout,
    x: clamp(layout.x, 0, canvas.width - width),
    y: clamp(layout.y, 0, canvas.height - height),
    width,
    height,
    rotation: clamp(layout.rotation, -360, 360),
    borderRadius: clamp(layout.borderRadius, 0, 540),
    cropTop,
    cropRight,
    cropBottom,
    cropLeft,
    opacity: Math.max(0.05, Math.min(1, Number(layout.opacity) || 1)),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function snap(value: number, enabled: boolean): number {
  return enabled ? Math.round(value / 10) * 10 : value;
}

function cropClipPath(layout: ObsBrowserSourceLayout): string {
  const top = (layout.cropTop / Math.max(1, layout.height)) * 100;
  const right = (layout.cropRight / Math.max(1, layout.width)) * 100;
  const bottom = (layout.cropBottom / Math.max(1, layout.height)) * 100;
  const left = (layout.cropLeft / Math.max(1, layout.width)) * 100;
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

function normalizeCanvas(canvas: ObsBrowserSourceCanvas): ObsBrowserSourceCanvas {
  return {
    width: clamp(canvas.width, 320, 7680),
    height: clamp(canvas.height, 180, 4320),
  };
}

function scaleLayouts(layouts: ObsBrowserSourceLayout[], from: ObsBrowserSourceCanvas, to: ObsBrowserSourceCanvas): ObsBrowserSourceLayout[] {
  const sx = to.width / Math.max(1, from.width);
  const sy = to.height / Math.max(1, from.height);
  return layouts.map((layout) => clampLayout({
    ...layout,
    x: layout.x * sx,
    y: layout.y * sy,
    width: layout.width * sx,
    height: layout.height * sy,
    cropTop: layout.cropTop * sy,
    cropRight: layout.cropRight * sx,
    cropBottom: layout.cropBottom * sy,
    cropLeft: layout.cropLeft * sx,
  }, to));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
