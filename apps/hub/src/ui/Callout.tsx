import type { ReactNode } from "react";

type CalloutTone = "info" | "success" | "warning" | "danger";

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`ui-callout ui-callout--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
