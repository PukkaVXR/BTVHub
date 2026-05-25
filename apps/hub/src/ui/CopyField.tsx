import { useState } from "react";
import { Button } from "./Button";

export function CopyField({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="ui-copy-field">
      {label ? <label>{label}</label> : null}
      <div>
        <input value={value} readOnly />
        <Button type="button" size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
