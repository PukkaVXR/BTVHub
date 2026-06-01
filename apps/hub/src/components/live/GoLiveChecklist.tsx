import type { GoLiveChecklistItem } from "../../lib/readiness";
import { Button, ButtonLink, Card, CardHeader, StatusPill } from "../../ui";

interface GoLiveChecklistProps {
  items: GoLiveChecklistItem[];
  repairingBrowserSources: boolean;
  onRepairBrowserSources: () => void;
}

export function GoLiveChecklist({
  items,
  repairingBrowserSources,
  onRepairBrowserSources,
}: GoLiveChecklistProps) {
  return (
    <Card>
      <CardHeader title="Go Live Checklist" description="A compact pre-stream pass before you hit the big button." />
      <div className="live-checklist">
        {items.map((item) => (
          <div className="live-checklist__item" key={item.label}>
            <StatusPill tone={item.ready ? "success" : "warning"} label={item.ready ? "Done" : "Todo"} detail={item.label} />
            <div className="live-checklist__actions">
              {item.id === "browser-sources" ? (
                <Button
                  type="button"
                  variant={item.ready ? "secondary" : "primary"}
                  size="sm"
                  loading={repairingBrowserSources}
                  onClick={onRepairBrowserSources}
                >
                  Repair
                </Button>
              ) : null}
              <ButtonLink variant="secondary" size="sm" to={item.to}>
                {item.actionLabel}
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
