import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hideableId?: string;
  hideableTitle?: string;
}

export function Card({ className = "", hideableId, hideableTitle, children, ...props }: CardProps) {
  const location = useLocation();
  const storageKey = hideableId ? `btv.hiddenCard.${location.pathname}.${hideableId}` : "";
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    setHidden(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  const setCardHidden = (next: boolean) => {
    if (!storageKey) return;
    if (next) localStorage.setItem(storageKey, "1");
    else localStorage.removeItem(storageKey);
    setHidden(next);
  };

  if (hideableId && hidden) {
    return (
      <section
        {...props}
        className={["ui-card-hidden-placeholder", className].filter(Boolean).join(" ")}
        aria-label={`${hideableTitle ?? hideableId} hidden`}
      >
        <span>{hideableTitle ?? "Hidden card"}</span>
        <button type="button" onClick={() => setCardHidden(false)}>Show</button>
      </section>
    );
  }

  return (
    <section className={["ui-card", hideableId ? "ui-card--hideable" : "", className].filter(Boolean).join(" ")} {...props}>
      {hideableId ? (
        <button type="button" className="ui-card-hide-button" aria-label={`Hide ${hideableTitle ?? "card"}`} onClick={() => setCardHidden(true)}>
          Hide
        </button>
      ) : null}
      {children}
    </section>
  );
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
