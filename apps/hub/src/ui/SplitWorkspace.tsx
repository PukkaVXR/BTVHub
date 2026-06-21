import type { HTMLAttributes, ReactNode } from "react";

interface SplitWorkspaceProps extends HTMLAttributes<HTMLDivElement> {
  sidebar: ReactNode;
  detail: ReactNode;
  sidebarLabel?: string;
  detailLabel?: string;
  sidebarClassName?: string;
  detailClassName?: string;
}

export function SplitWorkspace({
  sidebar,
  detail,
  sidebarLabel,
  detailLabel,
  sidebarClassName = "",
  detailClassName = "",
  className = "",
  ...props
}: SplitWorkspaceProps) {
  return (
    <div className={["ui-split-workspace", className].filter(Boolean).join(" ")} {...props}>
      <aside
        className={["ui-split-workspace__sidebar", sidebarClassName].filter(Boolean).join(" ")}
        aria-label={sidebarLabel}
      >
        {sidebar}
      </aside>
      <main
        className={["ui-split-workspace__detail", detailClassName].filter(Boolean).join(" ")}
        aria-label={detailLabel}
      >
        {detail}
      </main>
    </div>
  );
}
