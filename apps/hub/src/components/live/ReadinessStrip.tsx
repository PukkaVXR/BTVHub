import type { PreflightInfo } from "../../api";
import { Callout, Card, StatusPill } from "../../ui";

interface ReadinessStripProps {
  preflight: PreflightInfo | null;
}

export function ReadinessStrip({ preflight }: ReadinessStripProps) {
  const checks = preflight?.checks ?? [];
  const readyCount = checks.filter((check) => check.ok).length;
  const firstBlockingCheck = checks.find((check) => !check.ok);

  return (
    <Card className="live-readiness-strip" hideableId="readiness-strip" hideableTitle="Readiness Strip">
      <div className="live-readiness-strip__summary">
        <StatusPill
          tone={preflight?.ok ? "success" : firstBlockingCheck ? "danger" : "warning"}
          label={preflight ? `${readyCount}/${checks.length} ready` : "Checking readiness"}
          detail={firstBlockingCheck?.label ?? "Core systems are ready"}
        />
      </div>
      {firstBlockingCheck ? (
        <Callout tone="danger" title={firstBlockingCheck.label}>
          {firstBlockingCheck.detail}
        </Callout>
      ) : null}
      <div className="live-readiness-strip__checks">
        {checks.map((check) => (
          <StatusPill
            key={check.id}
            tone={check.ok ? "success" : "danger"}
            label={check.label}
            detail={check.detail}
          />
        ))}
      </div>
    </Card>
  );
}
