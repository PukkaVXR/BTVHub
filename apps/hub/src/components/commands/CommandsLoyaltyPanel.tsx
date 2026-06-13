import { useState } from "react";
import type { LoyaltyViewer } from "../../api";
import { Button, Card, CardHeader, EmptyState, FormField, StatusPill } from "../../ui";

type CommandsLoyaltyPanelProps = {
  viewers: LoyaltyViewer[];
  selectedViewer: LoyaltyViewer | null;
  loading: boolean;
  onSelect: (viewer: LoyaltyViewer) => void;
  onAdjust: (viewerId: string, amount: number) => void;
  onSet: (viewerId: string, amount: number) => void;
};

export function CommandsLoyaltyPanel({
  viewers,
  selectedViewer,
  loading,
  onSelect,
  onAdjust,
  onSet,
}: CommandsLoyaltyPanelProps) {
  const [adjustment, setAdjustment] = useState(100);

  return (
    <div className="commands-section">
      <Card hideableId="loyalty-points" hideableTitle="Loyalty Points">
        <CardHeader title="Loyalty points" description="Viewers earn 5 points from chat activity once per minute. Viewers can check balances with !points." />
        {loading ? (
          <p className="subtitle">Loading loyalty balances...</p>
        ) : viewers.length ? (
          <div className="commands-list">
            {viewers.map((viewer, index) => (
              <button
                type="button"
                key={viewer.id}
                className={`commands-list__item${selectedViewer?.id === viewer.id ? " commands-list__item--active" : ""}`}
                onClick={() => onSelect(viewer)}
              >
                <span>
                  <strong>#{index + 1} {viewer.displayName}</strong>
                  <em>{viewer.login ? `@${viewer.login}` : "Viewer"}</em>
                  <small>{viewer.chatMessages} chat messages</small>
                </span>
                <div className="commands-list__status">
                  <StatusPill tone="success" label={`${viewer.points} pts`} />
                  <StatusPill tone="info" label={`${viewer.lifetimePoints} life`} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No loyalty data yet" description="Viewer balances will appear after Twitch chat messages arrive." />
        )}
      </Card>

      <Card hideableId="viewer-balance" hideableTitle="Viewer Balance">
        <CardHeader
          title={selectedViewer ? "Viewer balance" : "Select a viewer"}
          description="Adjust balances for giveaways, corrections, or manual rewards."
        />
        {selectedViewer ? (
          <div className="commands-editor">
            <div className="commands-loyalty-hero">
              <strong>{selectedViewer.displayName}</strong>
              <span>{selectedViewer.points} points</span>
              <small>{selectedViewer.lifetimePoints} lifetime points</small>
            </div>

            <div className="commands-stats">
              <StatusPill tone="info" label="Messages" detail={String(selectedViewer.chatMessages)} />
              <StatusPill tone="neutral" label="Last earned" detail={selectedViewer.lastEarnedAt ? new Date(selectedViewer.lastEarnedAt).toLocaleString() : "Never"} />
            </div>

            <FormField label="Point amount" hint="Use this amount to add, remove, or set the viewer balance.">
              <input
                type="number"
                min={0}
                step={1}
                value={adjustment}
                onChange={(event) => setAdjustment(Math.max(0, Math.floor(Number(event.target.value || 0))))}
              />
            </FormField>

            <div className="commands-editor__actions">
              <Button type="button" variant="secondary" size="sm" onClick={() => onAdjust(selectedViewer.id, adjustment)}>
                Add points
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onAdjust(selectedViewer.id, -adjustment)}>
                Remove points
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => onSet(selectedViewer.id, adjustment)}>
                Set balance
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState title="No viewer selected" description="Pick a viewer from the leaderboard to manage their points." />
        )}
      </Card>
    </div>
  );
}
