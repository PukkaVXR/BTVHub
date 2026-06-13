import type { CSSProperties } from "react";
import { Button } from "../../ui";
import type {
  StreamDeckBackgroundFit,
  StreamDeckDesignValues,
  StreamDeckImageEffect,
  StreamDeckTextPlacement,
} from "./streamDeckBuilderTypes";

type VisualPreset = Pick<
  StreamDeckDesignValues,
  "backgroundFit" | "backgroundOpacity" | "backgroundPositionX" | "backgroundPositionY" | "imageEffect" | "showArtworkOverlay" | "showTitle" | "textPlacement"
> & {
  id: string;
  title: string;
  description: string;
};

const COLOR_SWATCHES = ["#5b8cff", "#ff3b5f", "#ff9f1c", "#ffcf5a", "#00f593", "#38bdf8", "#a78bfa", "#f472b6"];

const VISUAL_PRESETS: VisualPreset[] = [
  {
    id: "image-only",
    title: "Image only",
    description: "No text, no badge, no panel. Best for finished artwork.",
    backgroundFit: "cover",
    backgroundOpacity: 100,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "none",
    showArtworkOverlay: false,
    showTitle: false,
    textPlacement: "bottom",
  },
  {
    id: "glass-command",
    title: "Glass command",
    description: "Classic BTV label with a readable lower panel.",
    backgroundFit: "cover",
    backgroundOpacity: 72,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "glass",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "bottom",
  },
  {
    id: "center-title",
    title: "Centre title",
    description: "Balanced layout for simple one-action keys.",
    backgroundFit: "cover",
    backgroundOpacity: 62,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "vignette",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "center",
  },
  {
    id: "neon-status",
    title: "Neon status",
    description: "Glowing edge, cleaner surface, good for state keys.",
    backgroundFit: "cover",
    backgroundOpacity: 48,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "glow",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "top",
  },
  {
    id: "retro-monitor",
    title: "Retro monitor",
    description: "Scanline treatment for testing and alert controls.",
    backgroundFit: "cover",
    backgroundOpacity: 58,
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    imageEffect: "scanlines",
    showArtworkOverlay: true,
    showTitle: true,
    textPlacement: "bottom",
  },
];

const FOCAL_POINTS = [
  { label: "Top left", x: 0, y: 0 }, { label: "Top", x: 50, y: 0 }, { label: "Top right", x: 100, y: 0 },
  { label: "Left", x: 0, y: 50 }, { label: "Centre", x: 50, y: 50 }, { label: "Right", x: 100, y: 50 },
  { label: "Bottom left", x: 0, y: 100 }, { label: "Bottom", x: 50, y: 100 }, { label: "Bottom right", x: 100, y: 100 },
];

type Props = {
  values: StreamDeckDesignValues;
  onChange: (patch: Partial<StreamDeckDesignValues>) => void;
  onBackgroundUpload: (file: File | null) => void;
  onPresetApplied: (title: string) => void;
};

export function StreamDeckKeyDesigner({ values, onChange, onBackgroundUpload, onPresetApplied }: Props) {
  const previewStyle = {
    "--button-color": values.keyColor,
    "--key-bg-image": values.backgroundImageDataUrl ? `url(${values.backgroundImageDataUrl})` : "none",
    "--key-bg-opacity": String(values.backgroundOpacity / 100),
    "--key-bg-position": `${values.backgroundPositionX}% ${values.backgroundPositionY}%`,
  } as CSSProperties;

  const applyPreset = (preset: VisualPreset) => {
    onChange({
      backgroundFit: preset.backgroundFit,
      backgroundOpacity: preset.backgroundOpacity,
      backgroundPositionX: preset.backgroundPositionX,
      backgroundPositionY: preset.backgroundPositionY,
      imageEffect: preset.imageEffect,
      showArtworkOverlay: preset.showArtworkOverlay,
      showTitle: preset.showTitle,
      textPlacement: preset.textPlacement,
    });
    onPresetApplied(preset.title);
  };

  return (
    <section className="stream-deck-builder-panel">
      <div className="stream-deck-builder-panel__header"><span>3</span><div><strong>Design the key</strong><small>The preview becomes the generated Stream Deck key image.</small></div></div>
      <div className="stream-deck-visual-builder">
        <div
          className={`stream-deck-key-preview-large stream-deck-key-preview-large--${values.imageEffect} stream-deck-key-preview-large--text-${values.textPlacement} stream-deck-key-preview-large--fit-${values.backgroundFit}${values.showArtworkOverlay ? "" : " stream-deck-key-preview-large--image-only"}`}
          style={previewStyle}
        >
          {values.backgroundImageDataUrl ? <div className="stream-deck-key-preview-large__bg" aria-hidden="true" /> : null}
          {values.showArtworkOverlay && values.badgeText ? <em>{values.badgeText}</em> : null}
          {values.showArtworkOverlay && values.iconLabel.trim() ? <span>{values.iconLabel}</span> : null}
          {values.showArtworkOverlay && values.keyTitle.trim() ? <strong>{values.keyTitle}</strong> : null}
          {values.showArtworkOverlay && values.subtitle ? <small>{values.subtitle}</small> : null}
        </div>

        <div className="stream-deck-visual-presets" aria-label="Key visual presets">
          {VISUAL_PRESETS.map((preset) => {
            const active = preset.backgroundFit === values.backgroundFit && preset.backgroundOpacity === values.backgroundOpacity &&
              preset.backgroundPositionX === values.backgroundPositionX && preset.backgroundPositionY === values.backgroundPositionY &&
              preset.imageEffect === values.imageEffect && preset.showArtworkOverlay === values.showArtworkOverlay &&
              preset.showTitle === values.showTitle && preset.textPlacement === values.textPlacement;
            return <button type="button" key={preset.id} className={`stream-deck-visual-preset${active ? " stream-deck-visual-preset--active" : ""}`} onClick={() => applyPreset(preset)}><strong>{preset.title}</strong><small>{preset.description}</small></button>;
          })}
        </div>

        <div className="stream-deck-design-tabs" role="tablist" aria-label="Key design controls">
          {([{ id: "text", label: "Text" }, { id: "background", label: "Background" }, { id: "style", label: "Style" }] as const).map((tab) => (
            <button type="button" key={tab.id} role="tab" aria-selected={values.designTab === tab.id} className={values.designTab === tab.id ? "stream-deck-design-tabs__item--active" : ""} onClick={() => onChange({ designTab: tab.id })}>{tab.label}</button>
          ))}
        </div>

        {values.designTab === "text" ? <TextControls values={values} onChange={onChange} /> : null}
        {values.designTab === "background" ? <BackgroundControls values={values} onChange={onChange} onUpload={onBackgroundUpload} /> : null}
        {values.designTab === "style" ? <StyleControls values={values} onChange={onChange} /> : null}
      </div>
    </section>
  );
}

function TextControls({ values, onChange }: { values: StreamDeckDesignValues; onChange: Props["onChange"] }) {
  return <div className="stream-deck-form-grid stream-deck-design-panel" role="tabpanel">
    <label>Key title<input value={values.keyTitle} onChange={(event) => onChange({ keyTitle: event.target.value })} /></label>
    <label>Icon label<input value={values.iconLabel} maxLength={8} onChange={(event) => onChange({ iconLabel: event.target.value })} /></label>
    <label>Title colour<input type="color" value={values.titleColor} onChange={(event) => onChange({ titleColor: event.target.value })} /></label>
    <label>Font size<input type="number" min={6} max={30} value={values.fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) })} /></label>
    <label>Text placement<select value={values.textPlacement} onChange={(event) => onChange({ textPlacement: event.target.value as StreamDeckTextPlacement })}><option value="bottom">Bottom panel</option><option value="center">Centre panel</option><option value="top">Top panel</option></select></label>
    <label>Subtitle<input value={values.subtitle} maxLength={32} placeholder="Optional small line" onChange={(event) => onChange({ subtitle: event.target.value })} /></label>
    <label>Badge<input value={values.badgeText} maxLength={8} placeholder="LIVE" onChange={(event) => onChange({ badgeText: event.target.value })} /></label>
    <label className="stream-deck-toggle"><input type="checkbox" checked={values.showTitle} onChange={(event) => onChange({ showTitle: event.target.checked })} />Show Stream Deck title</label>
    <label className="stream-deck-toggle stream-deck-form-grid__wide"><input type="checkbox" checked={values.showArtworkOverlay} onChange={(event) => onChange({ showArtworkOverlay: event.target.checked })} /><span>Overlay text and badge on the key image<small>Turn this off for clean background-image-only keys. The Stream Deck title checkbox controls the separate native key title.</small></span></label>
  </div>;
}

function BackgroundControls({ values, onChange, onUpload }: { values: StreamDeckDesignValues; onChange: Props["onChange"]; onUpload: Props["onBackgroundUpload"] }) {
  return <div className="stream-deck-design-panel" role="tabpanel">
    <div className="stream-deck-background-tools"><div><strong>Background image</strong><small>Use a logo, screenshot, game art, or texture. It is baked into the exported key image.</small></div><div className="stream-deck-background-tools__actions">
      <label className="ui-button ui-button--secondary ui-button--sm">Upload image<input type="file" accept="image/*" onChange={(event) => onUpload(event.target.files?.[0] ?? null)} /></label>
      {values.backgroundImageDataUrl ? <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ backgroundImageDataUrl: "" })}>Remove image</Button> : null}
    </div></div>
    <div className="stream-deck-form-grid">
      <label>Image fit<select value={values.backgroundFit} onChange={(event) => onChange({ backgroundFit: event.target.value as StreamDeckBackgroundFit })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></label>
      <label>Image opacity ({values.backgroundOpacity}%)<input type="range" min={0} max={100} value={values.backgroundOpacity} onChange={(event) => onChange({ backgroundOpacity: Number(event.target.value) })} /></label>
      <label>Focal X ({values.backgroundPositionX}%)<input type="range" min={0} max={100} value={values.backgroundPositionX} onChange={(event) => onChange({ backgroundPositionX: Number(event.target.value) })} /></label>
      <label>Focal Y ({values.backgroundPositionY}%)<input type="range" min={0} max={100} value={values.backgroundPositionY} onChange={(event) => onChange({ backgroundPositionY: Number(event.target.value) })} /></label>
      <div className="stream-deck-focal-grid stream-deck-form-grid__wide" aria-label="Background focal point presets">{FOCAL_POINTS.map((point) => <button type="button" key={point.label} className={values.backgroundPositionX === point.x && values.backgroundPositionY === point.y ? "stream-deck-focal-grid__item--active" : ""} onClick={() => onChange({ backgroundPositionX: point.x, backgroundPositionY: point.y })}>{point.label}</button>)}</div>
    </div>
  </div>;
}

function StyleControls({ values, onChange }: { values: StreamDeckDesignValues; onChange: Props["onChange"] }) {
  return <div className="stream-deck-design-panel" role="tabpanel"><div className="stream-deck-form-grid">
    <label>Key colour<input type="color" value={values.keyColor} onChange={(event) => onChange({ keyColor: event.target.value })} /></label>
    <label>Effect<select value={values.imageEffect} onChange={(event) => onChange({ imageEffect: event.target.value as StreamDeckImageEffect })}><option value="glass">Glass panel</option><option value="glow">Border glow</option><option value="vignette">Vignette</option><option value="scanlines">Scanlines</option><option value="none">Clean</option></select></label>
  </div><label className="stream-deck-style-label">Quick colours<span className="stream-deck-color-row">{COLOR_SWATCHES.map((color) => <button type="button" key={color} style={{ backgroundColor: color }} aria-label={`Use ${color}`} className={values.keyColor.toLowerCase() === color.toLowerCase() ? "stream-deck-color-row__item--active" : ""} onClick={() => onChange({ keyColor: color })} />)}</span></label></div>;
}
