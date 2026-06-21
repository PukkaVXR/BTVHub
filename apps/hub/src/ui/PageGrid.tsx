import type { CSSProperties, HTMLAttributes } from "react";

type GridStyle = CSSProperties & {
  "--ui-grid-min"?: string;
};

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  minColumnWidth?: string;
}

function gridStyle(style: CSSProperties | undefined, minColumnWidth: string | undefined): GridStyle | undefined {
  if (!minColumnWidth) return style;
  return { ...style, "--ui-grid-min": minColumnWidth };
}

export function PageGrid({ className = "", minColumnWidth, style, ...props }: GridProps) {
  return (
    <div
      className={["ui-page-grid", className].filter(Boolean).join(" ")}
      style={gridStyle(style, minColumnWidth)}
      {...props}
    />
  );
}

export function CardGrid({ className = "", minColumnWidth, style, ...props }: GridProps) {
  return (
    <div
      className={["ui-card-grid", className].filter(Boolean).join(" ")}
      style={gridStyle(style, minColumnWidth)}
      {...props}
    />
  );
}
