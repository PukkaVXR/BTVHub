import type { ChatCommand } from "../../api";
import { Button, Card, CardHeader, EmptyState, FormField, StatusPill } from "../../ui";

type Props = {
  commands: ChatCommand[];
  editingCommand: ChatCommand | null;
  loading: boolean;
  onChange: (command: ChatCommand | null) => void;
  onSave: () => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
};

export function CommandsManagerPanel({ commands, editingCommand, loading, onChange, onSave, onTest, onDelete }: Props) {
  const isSaved = Boolean(editingCommand && commands.some((command) => command.id === editingCommand.id));

  return (
    <div className="commands-layout">
      <Card hideableId="commands-list" hideableTitle="Commands">
        <CardHeader title="Commands" description="Select a command to edit its trigger and response." />
        {loading ? (
          <p className="subtitle">Loading commands...</p>
        ) : commands.length ? (
          <div className="commands-list">
            {commands.map((command) => (
              <button
                type="button"
                key={command.id}
                className={`commands-list__item${editingCommand?.id === command.id ? " commands-list__item--active" : ""}`}
                onClick={() => onChange(command)}
              >
                <span>
                  <strong>{command.command}</strong>
                  {command.aliases.length ? <em>Aliases: {command.aliases.join(", ")}</em> : null}
                  <small>{command.responses.length > 1 ? `${command.responses.length} random responses` : command.response}</small>
                </span>
                <div className="commands-list__status">
                  <StatusPill tone={command.enabled ? "success" : "neutral"} label={command.enabled ? "On" : "Off"} />
                  <StatusPill tone="info" label={permissionLabel(command.permission)} />
                  <StatusPill tone="info" label={`${command.useCount} uses`} />
                  {command.cooldownMs > 0 ? <StatusPill tone="warning" label={`${Math.round(command.cooldownMs / 1000)}s`} /> : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No custom commands yet" description="Create your first command, then test it straight into Twitch chat." />
        )}
      </Card>

      <Card hideableId="command-editor" hideableTitle="Command Editor">
        <CardHeader
          title={editingCommand ? "Command editor" : "Select a command"}
          description="Use variables like {user}, {login}, {command}, {trigger}, {args}, and {count} in responses."
        />
        {editingCommand ? (
          <div className="commands-editor">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={editingCommand.enabled}
                onChange={(event) => onChange({ ...editingCommand, enabled: event.target.checked })}
              />
              Enabled
            </label>

            <FormField label="Command" hint="Use letters, numbers, underscores, and dashes. BTV adds ! if needed.">
              <input value={editingCommand.command} onChange={(event) => onChange({ ...editingCommand, command: event.target.value })} placeholder="!hello" />
            </FormField>

            <FormField label="Aliases" hint="Optional. Separate aliases with commas or new lines.">
              <textarea
                rows={3}
                value={editingCommand.aliases.join("\n")}
                onChange={(event) => onChange({
                  ...editingCommand,
                  aliases: event.target.value.split(/[,\n]/).map((alias) => alias.trim()).filter(Boolean),
                })}
                placeholder={"!hi\n!yo"}
              />
            </FormField>

            <FormField label="Who can use it">
              <select
                value={editingCommand.permission}
                onChange={(event) => onChange({ ...editingCommand, permission: event.target.value as ChatCommand["permission"] })}
              >
                <option value="everyone">Everyone</option>
                <option value="subscriber">Subscribers and higher</option>
                <option value="vip">VIPs, mods, and broadcaster</option>
                <option value="moderator">Moderators and broadcaster</option>
                <option value="broadcaster">Broadcaster only</option>
              </select>
            </FormField>

            <FormField label="Cooldown" hint="Seconds before this command can reply again. Use 0 for no cooldown.">
              <input
                type="number"
                min={0}
                max={86400}
                step={1}
                value={Math.round(editingCommand.cooldownMs / 1000)}
                onChange={(event) => onChange({ ...editingCommand, cooldownMs: Math.max(0, Number(event.target.value || 0) * 1000) })}
              />
            </FormField>

            <FormField label="Responses" hint="One response per line. BTV chooses randomly. Variables: {user}, {login}, {command}, {trigger}, {args}, {count}.">
              <textarea
                rows={6}
                value={(editingCommand.responses.length ? editingCommand.responses : [editingCommand.response]).join("\n")}
                onChange={(event) => {
                  const responses = event.target.value.split("\n").map((response) => response.trim()).filter(Boolean);
                  onChange({ ...editingCommand, response: responses[0] ?? "", responses });
                }}
                placeholder={"Hello {user}!\nWelcome in, {user}!"}
              />
            </FormField>

            <div className="commands-stats">
              <StatusPill tone="info" label="Uses" detail={String(editingCommand.useCount)} />
              <StatusPill tone="neutral" label="Last used" detail={editingCommand.lastUsedAt ? new Date(editingCommand.lastUsedAt).toLocaleString() : "Never"} />
            </div>

            <div className="commands-editor__actions">
              <Button type="button" variant="primary" size="sm" onClick={onSave}>Save command</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onTest(editingCommand.id)} disabled={!isSaved}>Test in chat</Button>
              <Button type="button" variant="danger" size="sm" onClick={() => onDelete(editingCommand.id)} disabled={!isSaved}>Delete</Button>
            </div>
          </div>
        ) : (
          <EmptyState title="No command selected" description="Pick an existing command or create a new one." />
        )}
      </Card>
    </div>
  );
}

function permissionLabel(permission: ChatCommand["permission"]): string {
  switch (permission) {
    case "subscriber": return "Subs+";
    case "vip": return "VIP+";
    case "moderator": return "Mods";
    case "broadcaster": return "Broadcaster";
    default: return "Everyone";
  }
}
