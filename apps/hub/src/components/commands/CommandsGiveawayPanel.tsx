import { useState } from "react";
import type { Giveaway } from "../../api";
import { Button, Card, CardHeader, EmptyState, FormField, StatusPill } from "../../ui";

type Props = {
  activeGiveaway: Giveaway | null;
  giveawayCount: number;
  onOpen: (name: string, keyword: string) => void;
  onPickWinner: (id: string) => void;
  onAnnounceWinner: (id: string) => void;
  onClose: (id: string) => void;
  onClearEntries: (id: string) => void;
  onRemoveEntry: (entryId: string) => void;
  onAddEntry: (giveawayId: string, displayName: string) => void;
};

export function CommandsGiveawayPanel({ activeGiveaway, giveawayCount, onOpen, onPickWinner, onAnnounceWinner, onClose, onClearEntries, onRemoveEntry, onAddEntry }: Props) {
  const [name, setName] = useState("Stream giveaway");
  const [keyword, setKeyword] = useState("!enter");
  const [manualEntry, setManualEntry] = useState("");

  const addManualEntry = () => {
    const displayName = manualEntry.trim();
    if (!activeGiveaway || !displayName) return;
    onAddEntry(activeGiveaway.id, displayName);
    setManualEntry("");
  };

  return (
    <div className="commands-section">
      <Card hideableId="giveaways-raffles" hideableTitle="Giveaways And Raffles">
        <CardHeader title="Giveaways and raffles" description="Open a giveaway, let chat enter with the keyword, then pick and announce a winner." />
        {activeGiveaway ? (
          <div className="commands-editor">
            <div className="commands-loyalty-hero">
              <strong>{activeGiveaway.name}</strong>
              <span>{activeGiveaway.entries.length} entered</span>
              <small>Keyword: {activeGiveaway.keyword}</small>
            </div>
            {activeGiveaway.winner ? (
              <div className="commands-loyalty-hero">
                <strong>Winner</strong>
                <span>{activeGiveaway.winner.displayName}</span>
                <small>{activeGiveaway.winner.login ? `@${activeGiveaway.winner.login}` : "Manual entry"}</small>
              </div>
            ) : null}
            <div className="commands-editor__actions">
              <Button type="button" variant="primary" size="sm" onClick={() => onPickWinner(activeGiveaway.id)} disabled={!activeGiveaway.entries.length}>Pick winner</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onAnnounceWinner(activeGiveaway.id)} disabled={!activeGiveaway.winner}>Announce</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onClose(activeGiveaway.id)}>Close</Button>
              <Button type="button" variant="danger" size="sm" onClick={() => onClearEntries(activeGiveaway.id)} disabled={!activeGiveaway.entries.length}>Clear entries</Button>
            </div>
            <div className="commands-list">
              {activeGiveaway.entries.map((entry, index) => (
                <div className="commands-list__item commands-list__item--static" key={entry.id}>
                  <span>
                    <strong>#{index + 1} {entry.displayName}</strong>
                    <em>{entry.login ? `@${entry.login}` : "Manual entry"}</em>
                    <small>Entered {new Date(entry.enteredAt).toLocaleTimeString()}</small>
                  </span>
                  <div className="commands-list__status">
                    <Button type="button" variant="danger" size="sm" onClick={() => onRemoveEntry(entry.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="No giveaway open" description="Open a raffle when you are ready for chat to enter." />
        )}
      </Card>

      <Card hideableId="giveaway-controls" hideableTitle="Giveaway Controls">
        <CardHeader title="Giveaway controls" description="Only one giveaway is open at a time; opening a new one closes the previous raffle." />
        <div className="commands-editor">
          <FormField label="Giveaway name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Stream giveaway" /></FormField>
          <FormField label="Entry keyword" hint="Chat can also use !raffle and !enter."><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="!enter" /></FormField>
          <Button type="button" variant="primary" size="sm" onClick={() => onOpen(name, keyword)}>Open giveaway</Button>
          <FormField label="Manual entry"><input value={manualEntry} onChange={(event) => setManualEntry(event.target.value)} placeholder="Viewer name" /></FormField>
          <Button type="button" variant="secondary" size="sm" onClick={addManualEntry} disabled={!activeGiveaway || !manualEntry.trim()}>Add entry</Button>
          <div className="commands-stats">
            <StatusPill tone="neutral" label="Past giveaways" detail={String(giveawayCount)} />
            <StatusPill tone={activeGiveaway ? "success" : "neutral"} label="Status" detail={activeGiveaway ? "Open" : "Closed"} />
          </div>
        </div>
      </Card>
    </div>
  );
}
