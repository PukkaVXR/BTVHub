import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className].filter(Boolean).join(" ");
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonLinkProps) {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className].filter(Boolean).join(" ");
  return (
    <Link className={classes} {...props}>
      <span>{children}</span>
    </Link>
  );
}

interface ButtonAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonAnchor({
  variant = "secondary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonAnchorProps) {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className].filter(Boolean).join(" ");
  return (
    <a className={classes} {...props}>
      <span>{children}</span>
    </a>
  );
}
