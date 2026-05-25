import { Link } from "react-router-dom";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function StatusPill({
  tone = "neutral",
  label,
  detail,
  to,
}: {
  tone?: StatusTone;
  label: string;
  detail?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="ui-status-pill__dot" aria-hidden="true" />
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </>
  );

  if (to) {
    return (
      <Link className={`ui-status-pill ui-status-pill--${tone} ui-status-pill--link`} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <span className={`ui-status-pill ui-status-pill--${tone}`}>
      {content}
    </span>
  );
}
