import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={["ui-card", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardSection({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["ui-card-section", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-card-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-card-header__action">{action}</div> : null}
    </div>
  );
}
