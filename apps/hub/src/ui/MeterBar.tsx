import type { HTMLAttributes, ReactNode } from "react";

type MeterTone = "neutral" | "success" | "warning" | "danger" | "info";

interface MeterBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: ReactNode;
  detail?: ReactNode;
  tone?: MeterTone;
}

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export function MeterBar({ value, max = 100, label, detail, tone = "info", className = "", ...props }: MeterBarProps) {
  const width = `${percent(value, max)}%`;

  return (
    <div className={["ui-meter-bar", `ui-meter-bar--${tone}`, className].filter(Boolean).join(" ")} {...props}>
      {label || detail ? (
        <div className="ui-meter-bar__header">
          {label ? <span>{label}</span> : null}
          {detail ? <small>{detail}</small> : null}
        </div>
      ) : null}
      <div
        className="ui-meter-bar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <span style={{ width }} />
      </div>
    </div>
  );
}
