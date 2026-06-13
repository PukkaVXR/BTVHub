import type { ChatQuote } from "../../api";
import { Button, Card, CardHeader, EmptyState, FormField, StatusPill } from "../../ui";

type Props = {
  quotes: ChatQuote[];
  editingQuote: ChatQuote | null;
  loading: boolean;
  onChange: (quote: ChatQuote | null) => void;
  onSave: () => void;
  onCountUse: (id: string) => void;
  onDelete: (id: string) => void;
};

export function CommandsQuotesPanel({ quotes, editingQuote, loading, onChange, onSave, onCountUse, onDelete }: Props) {
  const isSaved = Boolean(editingQuote && quotes.some((quote) => quote.id === editingQuote.id));

  return (
    <div className="commands-section">
      <Card hideableId="quotes-list" hideableTitle="Quotes">
        <CardHeader title="Quotes" description="Build a stream quote book. Viewers can use !quote for a random quote or !quote 12 for a specific one." />
        {loading ? <p className="subtitle">Loading quotes...</p> : quotes.length ? (
          <div className="commands-list">
            {quotes.map((quote) => (
              <button
                type="button"
                key={quote.id}
                className={`commands-list__item${editingQuote?.id === quote.id ? " commands-list__item--active" : ""}`}
                onClick={() => onChange(quote)}
              >
                <span>
                  <strong>#{quote.quoteNumber}</strong>
                  <em>{quote.author ? `By ${quote.author}` : "No author"}</em>
                  <small>{quote.text}</small>
                </span>
                <div className="commands-list__status"><StatusPill tone="info" label={`${quote.useCount} uses`} /></div>
              </button>
            ))}
          </div>
        ) : <EmptyState title="No quotes yet" description="Save memorable stream moments here, then let chat pull them with !quote." />}
      </Card>

      <Card hideableId="quote-editor" hideableTitle="Quote Editor">
        <CardHeader title={editingQuote ? "Quote editor" : "Select a quote"} description="Quote numbers are what viewers use after !quote." />
        {editingQuote ? (
          <div className="commands-editor">
            <FormField label="Quote number" hint="Used by chat, for example !quote 7.">
              <input
                type="number"
                min={1}
                step={1}
                value={editingQuote.quoteNumber}
                onChange={(event) => onChange({ ...editingQuote, quoteNumber: Math.max(1, Math.floor(Number(event.target.value || 1))) })}
              />
            </FormField>
            <FormField label="Quote text">
              <textarea rows={5} value={editingQuote.text} onChange={(event) => onChange({ ...editingQuote, text: event.target.value })} placeholder="That belongs in the quote book." />
            </FormField>
            <div className="commands-editor__grid">
              <FormField label="Author"><input value={editingQuote.author ?? ""} onChange={(event) => onChange({ ...editingQuote, author: event.target.value })} placeholder="Streamer or viewer" /></FormField>
              <FormField label="Added by"><input value={editingQuote.addedBy ?? ""} onChange={(event) => onChange({ ...editingQuote, addedBy: event.target.value })} placeholder="Moderator" /></FormField>
            </div>
            <div className="commands-stats">
              <StatusPill tone="info" label="Uses" detail={String(editingQuote.useCount)} />
              <StatusPill tone="neutral" label="Last used" detail={editingQuote.lastUsedAt ? new Date(editingQuote.lastUsedAt).toLocaleString() : "Never"} />
            </div>
            <div className="commands-editor__actions">
              <Button type="button" variant="primary" size="sm" onClick={onSave}>Save quote</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onCountUse(editingQuote.id)} disabled={!isSaved}>Count use</Button>
              <Button type="button" variant="danger" size="sm" onClick={() => onDelete(editingQuote.id)} disabled={!isSaved}>Delete</Button>
            </div>
          </div>
        ) : <EmptyState title="No quote selected" description="Pick an existing quote or create a new one." />}
      </Card>
    </div>
  );
}
