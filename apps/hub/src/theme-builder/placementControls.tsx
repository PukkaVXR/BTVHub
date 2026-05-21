import type { ThemeAnchor, ThemeLayoutMeta } from "@btv/shared";
import { defaultThemeLayout } from "./layoutCss";

const ANCHORS: { id: ThemeAnchor; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "center", label: "Center" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

interface PlacementControlsProps {
  placement: ThemeLayoutMeta;
  onChange: (placement: ThemeLayoutMeta) => void;
}

export function PlacementControls({ placement, onChange }: PlacementControlsProps) {
  const p = { ...defaultThemeLayout(), ...placement };
  const patch = (part: Partial<ThemeLayoutMeta>) => onChange({ ...p, ...part });

  return (
    <>
      <div className="form-row">
        <label>Screen position</label>
        <select value={p.anchor} onChange={(e) => patch({ anchor: e.target.value as ThemeAnchor })}>
          {ANCHORS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>Width ({p.width}px)</label>
        <input
          type="range"
          min={200}
          max={1200}
          value={p.width}
          onChange={(e) => patch({ width: Number(e.target.value) })}
        />
      </div>
      <div className="form-row">
        <label>Offset X ({p.offsetX}px)</label>
        <input
          type="range"
          min={-200}
          max={200}
          value={p.offsetX}
          onChange={(e) => patch({ offsetX: Number(e.target.value) })}
        />
      </div>
      <div className="form-row">
        <label>Offset Y ({p.offsetY}px)</label>
        <input
          type="range"
          min={0}
          max={400}
          value={p.offsetY}
          onChange={(e) => patch({ offsetY: Number(e.target.value) })}
        />
      </div>
    </>
  );
}
