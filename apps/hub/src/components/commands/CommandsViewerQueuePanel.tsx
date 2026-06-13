import { useState } from "react";
import type { ViewerQueueEntry } from "../../api";
import { Button, Card, CardHeader, EmptyState, FormField } from "../../ui";

type Props = {
  entries: ViewerQueueEntry[];
  loading: boolean;
  onRemove: (entryId: string) => void;
  onPickNext: () => void;
  onClear: () => void;
  onAdd: (displayName: string, note?: string) => void;
};

export function CommandsViewerQueuePanel({ entries, loading, onRemove, onPickNext, onClear, onAdd }: Props) {
  const [manualName, setManualName] = useState("");
  const [manualNote, setManualNote] = useState("");

  const addManualEntry = () => {
    const displayName = manualName.trim();
    if (!displayName) return;
    onAdd(displayName, manualNote.trim() || undefined);
    setManualName("");
    setManualNote("");
  };

  return (
    <div className="commands-section">
      <Card hideableId="viewer-queue" hideableTitle="Viewer Queue">
        <CardHeader title="Viewer queue" description="Viewers can type !join, !leave, and !queue. Use this for games, reviews, raids, or community turns." />
        {loading ? <p className="subtitle">Loading queue...</p> : entries.length ? (
          <div className="commands-list">
            {entries.map((entry, index) => (
              <div className="commands-list__item commands-list__item--static" key={entry.id}>
                <span>
                  <strong>#{index + 1} {entry.displayName}</strong>
                  <em>{entry.login ? `@${entry.login}` : "Manual entry"}</em>
                  <small>{entry.note || `Joined ${new Date(entry.joinedAt).toLocaleTimeString()}`}</small>
                </span>
                <div className="commands-list__status">
                  <Button type="button" variant="danger" size="sm" onClick={() => onRemove(entry.id)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Queue is empty" description="Viewers can join from chat with !join, or you can add someone manually." />}
      </Card>

      <Card hideableId="queue-controls" hideableTitle="Queue Controls">
        <CardHeader title="Queue controls" description="Pick the next viewer or manually add someone to the queue." />
        <div className="commands-editor">
          <div className="commands-editor__actions">
            <Button type="button" variant="primary" size="sm" onClick={onPickNext} disabled={!entries.length}>Pick next</Button>
            <Button type="button" variant="danger" size="sm" onClick={onClear} disabled={!entries.length}>Clear queue</Button>
          </div>
          <FormField label="Manual display name">
            <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Viewer name" />
          </FormField>
          <FormField label="Note" hint="Optional context, such as game mode, request, or turn details.">
            <input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="Optional queue note" />
          </FormField>
          <Button type="button" variant="secondary" size="sm" onClick={addManualEntry} disabled={!manualName.trim()}>Add manually</Button>
        </div>
      </Card>
    </div>
  );
}
