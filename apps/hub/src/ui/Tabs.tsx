import type { ButtonHTMLAttributes, ReactNode } from "react";

type ControlSize = "sm" | "md";

export interface ChoiceItem {
  id: string;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface ChoiceGroupProps {
  items: readonly ChoiceItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  size?: ControlSize;
  className?: string;
}

function choiceButtonProps(
  item: ChoiceItem,
  activeId: string,
  onChange: (id: string) => void,
): ButtonHTMLAttributes<HTMLButtonElement> {
  return {
    type: "button",
    disabled: item.disabled,
    "aria-selected": item.id === activeId,
    onClick: () => onChange(item.id),
  };
}

export function Tabs({ items, activeId, onChange, ariaLabel, size = "md", className = "" }: ChoiceGroupProps) {
  return (
    <div
      className={["ui-tabs", `ui-tabs--${size}`, className].filter(Boolean).join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button key={item.id} className="ui-tabs__tab" role="tab" {...choiceButtonProps(item, activeId, onChange)}>
          <span>{item.label}</span>
          {typeof item.count === "number" ? <small>{item.count}</small> : null}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({
  items,
  activeId,
  onChange,
  ariaLabel,
  size = "md",
  className = "",
}: ChoiceGroupProps) {
  return (
    <div
      className={["ui-segmented-control", `ui-segmented-control--${size}`, className].filter(Boolean).join(" ")}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.id}
          className="ui-segmented-control__button"
          type="button"
          disabled={item.disabled}
          aria-pressed={item.id === activeId}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {typeof item.count === "number" ? <small>{item.count}</small> : null}
        </button>
      ))}
    </div>
  );
}
