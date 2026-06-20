import type { HTMLAttributes } from "react";

export function ControlGrid({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["ui-control-grid", className].filter(Boolean).join(" ")} {...props} />;
}
