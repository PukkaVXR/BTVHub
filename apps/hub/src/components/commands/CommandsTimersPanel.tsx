import type { ChatTimer } from "../../api";
import { Button, Card, CardHeader, EmptyState, FormField, StatusPill } from "../../ui";

type Props = {
  timers: ChatTimer[];
  editingTimer: ChatTimer | null;
  loading: boolean;
  onChange: (timer: ChatTimer | null) => void;
  onSave: () => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
};

export function CommandsTimersPanel({ timers, editingTimer, loading, onChange, onSave, onTest, onDelete }: Props) {
  const isSaved = Boolean(editingTimer && timers.some((timer) => timer.id === editingTimer.id));

  return (
    <div className="commands-section">
      <Card hideableId="timers-list" hideableTitle="Timers">
        <CardHeader title="Timers" description="Send rotating Twitch chat messages on a schedule without needing a viewer command." />
        {loading ? (
          <p className="subtitle">Loading timers...</p>
        ) : timers.length ? (
          <div className="commands-list">
            {timers.map((timer) => (
              <button
                type="button"
                key={timer.id}
                className={`commands-list__item${editingTimer?.id === timer.id ? " commands-list__item--active" : ""}`}
                onClick={() => onChange(timer)}
              >
                <span>
                  <strong>{timer.name}</strong>
                  <em>Every {formatInterval(timer.intervalMs)}</em>
                  <small>{timer.responses.length > 1 ? `${timer.responses.length} random messages` : timer.message}</small>
                </span>
                <div className="commands-list__status">
                  <StatusPill tone={timer.enabled ? "success" : "neutral"} label={timer.enabled ? "On" : "Off"} />
                  <StatusPill tone="info" label={`${timer.runCount} sent`} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No chat timers yet" description="Create a timer for recurring announcements, reminders, or gentle calls to action." />
        )}
      </Card>

      <Card hideableId="timer-editor" hideableTitle="Timer Editor">
        <CardHeader title={editingTimer ? "Timer editor" : "Select a timer"} description="One message per line. BTV chooses randomly each time the timer fires." />
        {editingTimer ? (
          <div className="commands-editor">
            <label className="toggle-row">
              <input type="checkbox" checked={editingTimer.enabled} onChange={(event) => onChange({ ...editingTimer, enabled: event.target.checked })} />
              Enabled
            </label>

            <FormField label="Name">
              <input value={editingTimer.name} onChange={(event) => onChange({ ...editingTimer, name: event.target.value })} placeholder="Stream reminder" />
            </FormField>

            <FormField label="Interval" hint="Minutes between automatic chat messages. Minimum 1 minute.">
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                value={Math.round(editingTimer.intervalMs / 60000)}
                onChange={(event) => onChange({ ...editingTimer, intervalMs: Math.max(1, Number(event.target.value || 1)) * 60000 })}
              />
            </FormField>

            <FormField label="Messages" hint="One message per line. BTV chooses randomly when the timer fires.">
              <textarea
                rows={6}
                value={(editingTimer.responses.length ? editingTimer.responses : [editingTimer.message]).join("\n")}
                onChange={(event) => {
                  const responses = event.target.value.split("\n").map((response) => response.trim()).filter(Boolean);
                  onChange({ ...editingTimer, message: responses[0] ?? "", responses });
                }}
                placeholder={"Enjoying the stream? Follow for more.\nRemember to hydrate."}
              />
            </FormField>

            <div className="commands-stats">
              <StatusPill tone="info" label="Sent" detail={String(editingTimer.runCount)} />
              <StatusPill tone="neutral" label="Last sent" detail={editingTimer.lastRunAt ? new Date(editingTimer.lastRunAt).toLocaleString() : "Never"} />
            </div>

            <div className="commands-editor__actions">
              <Button type="button" variant="primary" size="sm" onClick={onSave}>Save timer</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onTest(editingTimer.id)} disabled={!isSaved}>Test in chat</Button>
              <Button type="button" variant="danger" size="sm" onClick={() => onDelete(editingTimer.id)} disabled={!isSaved}>Delete</Button>
            </div>
          </div>
        ) : (
          <EmptyState title="No timer selected" description="Pick an existing timer or create a new one." />
        )}
      </Card>
    </div>
  );
}

function formatInterval(intervalMs: number): string {
  const minutes = Math.max(1, Math.round(intervalMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
