import type { CSSProperties } from "react";

export function Skeleton({ width = "100%" }: { width?: CSSProperties["width"] }) {
  return <span className="ui-skeleton" style={{ width }} />;
}
