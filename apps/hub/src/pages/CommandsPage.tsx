import { useEffect, useMemo, useState } from "react";
import { api, type ChatCommand, type ChatQuote, type ChatTimer, type LoyaltyViewer, type ViewerQueueEntry } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, Card, CardHeader, EmptyState, FormField, PageHeader, StatusPill } from "../ui";

function newCommand(): ChatCommand {
  const now = new Date().toISOString();
  return {
    id: `command-${Date.now()}`,
    command: "!hello",
    aliases: ["!hi"],
    permission: "everyone",
    enabled: true,
    cooldownMs: 15000,
    response: "Hello {user}!",
    responses: ["Hello {user}!", "Hey {user}, welcome in!", "{user} has entered the chat."],
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function newTimer(): ChatTimer {
  const now = new Date().toISOString();
  return {
    id: `timer-${Date.now()}`,
    name: "Stream reminder",
    enabled: true,
    intervalMs: 10 * 60 * 1000,
    message: "Enjoying the stream? Follow for more chaos.",
    responses: [
      "Enjoying the stream? Follow for more chaos.",
      "Don't forget to hydrate and stretch.",
    ],
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function newQuote(nextNumber: number): ChatQuote {
  const now = new Date().toISOString();
  return {
    id: `quote-${Date.now()}`,
    quoteNumber: nextNumber,
    text: "That belongs in the quote book.",
    author: "",
    addedBy: "",
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export default function CommandsPage() {
  const [commands, setCommands] = useState<ChatCommand[]>([]);
  const [timers, setTimers] = useState<ChatTimer[]>([]);
  const [quotes, setQuotes] = useState<ChatQuote[]>([]);
  const [loyaltyViewers, setLoyaltyViewers] = useState<LoyaltyViewer[]>([]);
  const [viewerQueue, setViewerQueue] = useState<ViewerQueueEntry[]>([]);
  const [editing, setEditing] = useState<ChatCommand | null>(null);
  const [editingTimer, setEditingTimer] = useState<ChatTimer | null>(null);
  const [editingQuote, setEditingQuote] = useState<ChatQuote | null>(null);
  const [selectedViewer, setSelectedViewer] = useState<LoyaltyViewer | null>(null);
  const [loyaltyAdjustment, setLoyaltyAdjustment] = useState(100);
  const [manualQueueName, setManualQueueName] = useState("");
  const [manualQueueNote, setManualQueueNote] = useState("");
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [nextCommands, nextTimers, nextQuotes, nextLoyalty, nextQueue] = await Promise.all([
        api.chatCommands(),
        api.chatTimers(),
        api.chatQuotes(),
        api.loyaltyViewers(),
        api.viewerQueue(),
      ]);
      setCommands(nextCommands);
      setTimers(nextTimers);
      setQuotes(nextQuotes);
      setLoyaltyViewers(nextLoyalty.viewers);
      setViewerQueue(nextQueue.entries);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const enabledCount = useMemo(() => commands.filter((command) => command.enabled).length, [commands]);
  const enabledTimerCount = useMemo(() => timers.filter((timer) => timer.enabled).length, [timers]);
  const nextQuoteNumber = useMemo(() => Math.max(0, ...quotes.map((quote) => quote.quoteNumber)) + 1, [quotes]);
  const totalLoyaltyPoints = useMemo(
    () => loyaltyViewers.reduce((total, viewer) => total + viewer.points, 0),
    [loyaltyViewers],
  );

  const save = async () => {
    if (!editing) return;
    const response = await api.saveChatCommand(editing);
    setEditing(response.command);
    toast("Command saved");
    await load();
  };

  const saveTimer = async () => {
    if (!editingTimer) return;
    const response = await api.saveChatTimer(editingTimer);
    setEditingTimer(response.timer);
    toast("Timer saved");
    await load();
  };

  const saveQuote = async () => {
    if (!editingQuote) return;
    const response = await api.saveChatQuote(editingQuote);
    setEditingQuote(response.quote);
    toast("Quote saved");
    await load();
  };

  return (
    <>
      <PageHeader
        title="Chat Commands"
        description="Create simple Twitch chat commands that reply from BTV when viewers type them."
        action={
          <div className="commands-header-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingQuote(newQuote(nextQuoteNumber))}>
              New quote
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingTimer(newTimer())}>
              New timer
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => setEditing(newCommand())}>
              New command
            </Button>
          </div>
        }
      />

      <div className="commands-summary">
        <StatusPill tone={enabledCount ? "success" : "neutral"} label="Enabled" detail={`${enabledCount}/${commands.length}`} />
        <StatusPill tone="info" label="Trigger" detail="Starts with !" />
        <StatusPill tone="info" label="Uses" detail={String(commands.reduce((total, command) => total + command.useCount, 0))} />
        <StatusPill tone={enabledTimerCount ? "success" : "neutral"} label="Timers" detail={`${enabledTimerCount}/${timers.length}`} />
        <StatusPill tone={quotes.length ? "info" : "neutral"} label="Quotes" detail={String(quotes.length)} />
        <StatusPill tone={loyaltyViewers.length ? "info" : "neutral"} label="Loyalty" detail={`${totalLoyaltyPoints} pts`} />
        <StatusPill tone={viewerQueue.length ? "success" : "neutral"} label="Queue" detail={String(viewerQueue.length)} />
      </div>

      <div className="commands-layout">
        <Card>
          <CardHeader title="Commands" description="Select a command to edit its trigger and response." />
          {loading ? (
            <p className="subtitle">Loading commands...</p>
          ) : commands.length ? (
            <div className="commands-list">
              {commands.map((command) => (
                <button
                  type="button"
                  key={command.id}
                  className={`commands-list__item${editing?.id === command.id ? " commands-list__item--active" : ""}`}
                  onClick={() => setEditing(command)}
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

        <Card>
          <CardHeader
            title={editing ? "Command editor" : "Select a command"}
            description="Use variables like {user}, {login}, {command}, {trigger}, {args}, and {count} in responses."
          />

          {editing ? (
            <div className="commands-editor">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })}
                />
                Enabled
              </label>

              <FormField label="Command" hint="Use letters, numbers, underscores, and dashes. BTV adds ! if needed.">
                <input
                  value={editing.command}
                  onChange={(event) => setEditing({ ...editing, command: event.target.value })}
                  placeholder="!hello"
                />
              </FormField>

              <FormField label="Aliases" hint="Optional. Separate aliases with commas or new lines.">
                <textarea
                  rows={3}
                  value={editing.aliases.join("\n")}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      aliases: event.target.value
                        .split(/[,\n]/)
                        .map((alias) => alias.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder={"!hi\n!yo"}
                />
              </FormField>

              <FormField label="Who can use it">
                <select
                  value={editing.permission}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      permission: event.target.value as ChatCommand["permission"],
                    })
                  }
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
                  value={Math.round(editing.cooldownMs / 1000)}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      cooldownMs: Math.max(0, Number(event.target.value || 0) * 1000),
                    })
                  }
                />
              </FormField>

              <FormField label="Responses" hint="One response per line. BTV chooses randomly. Variables: {user}, {login}, {command}, {trigger}, {args}, {count}.">
                <textarea
                  rows={6}
                  value={(editing.responses.length ? editing.responses : [editing.response]).join("\n")}
                  onChange={(event) => {
                    const responses = event.target.value
                      .split("\n")
                      .map((response) => response.trim())
                      .filter(Boolean);
                    setEditing({ ...editing, response: responses[0] ?? "", responses });
                  }}
                  placeholder={"Hello {user}!\nWelcome in, {user}!"}
                />
              </FormField>

              <div className="commands-stats">
                <StatusPill tone="info" label="Uses" detail={String(editing.useCount)} />
                <StatusPill tone="neutral" label="Last used" detail={editing.lastUsedAt ? new Date(editing.lastUsedAt).toLocaleString() : "Never"} />
              </div>

              <div className="commands-editor__actions">
                <Button type="button" variant="primary" size="sm" onClick={() => void save()}>
                  Save command
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!editing) return;
                    await api.testChatCommand(editing.id);
                    toast("Test response sent to Twitch chat");
                  }}
                  disabled={!commands.some((command) => command.id === editing.id)}
                >
                  Test in chat
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await api.deleteChatCommand(editing.id);
                    setEditing(null);
                    toast("Command deleted");
                    await load();
                  }}
                  disabled={!commands.some((command) => command.id === editing.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState title="No command selected" description="Pick an existing command or create a new one." />
          )}
        </Card>
      </div>

      <div className="commands-section">
        <Card>
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
                  onClick={() => setEditingTimer(timer)}
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

        <Card>
          <CardHeader
            title={editingTimer ? "Timer editor" : "Select a timer"}
            description="One message per line. BTV chooses randomly each time the timer fires."
          />
          {editingTimer ? (
            <div className="commands-editor">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={editingTimer.enabled}
                  onChange={(event) => setEditingTimer({ ...editingTimer, enabled: event.target.checked })}
                />
                Enabled
              </label>

              <FormField label="Name">
                <input
                  value={editingTimer.name}
                  onChange={(event) => setEditingTimer({ ...editingTimer, name: event.target.value })}
                  placeholder="Stream reminder"
                />
              </FormField>

              <FormField label="Interval" hint="Minutes between automatic chat messages. Minimum 1 minute.">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={Math.round(editingTimer.intervalMs / 60000)}
                  onChange={(event) =>
                    setEditingTimer({
                      ...editingTimer,
                      intervalMs: Math.max(1, Number(event.target.value || 1)) * 60000,
                    })
                  }
                />
              </FormField>

              <FormField label="Messages" hint="One message per line. BTV chooses randomly when the timer fires.">
                <textarea
                  rows={6}
                  value={(editingTimer.responses.length ? editingTimer.responses : [editingTimer.message]).join("\n")}
                  onChange={(event) => {
                    const responses = event.target.value
                      .split("\n")
                      .map((response) => response.trim())
                      .filter(Boolean);
                    setEditingTimer({ ...editingTimer, message: responses[0] ?? "", responses });
                  }}
                  placeholder={"Enjoying the stream? Follow for more.\nRemember to hydrate."}
                />
              </FormField>

              <div className="commands-stats">
                <StatusPill tone="info" label="Sent" detail={String(editingTimer.runCount)} />
                <StatusPill tone="neutral" label="Last sent" detail={editingTimer.lastRunAt ? new Date(editingTimer.lastRunAt).toLocaleString() : "Never"} />
              </div>

              <div className="commands-editor__actions">
                <Button type="button" variant="primary" size="sm" onClick={() => void saveTimer()}>
                  Save timer
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!editingTimer) return;
                    await api.testChatTimer(editingTimer.id);
                    toast("Timer message sent to Twitch chat");
                    await load();
                  }}
                  disabled={!timers.some((timer) => timer.id === editingTimer.id)}
                >
                  Test in chat
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await api.deleteChatTimer(editingTimer.id);
                    setEditingTimer(null);
                    toast("Timer deleted");
                    await load();
                  }}
                  disabled={!timers.some((timer) => timer.id === editingTimer.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState title="No timer selected" description="Pick an existing timer or create a new one." />
          )}
        </Card>
      </div>

      <div className="commands-section">
        <Card>
          <CardHeader title="Quotes" description="Build a stream quote book. Viewers can use !quote for a random quote or !quote 12 for a specific one." />
          {loading ? (
            <p className="subtitle">Loading quotes...</p>
          ) : quotes.length ? (
            <div className="commands-list">
              {quotes.map((quote) => (
                <button
                  type="button"
                  key={quote.id}
                  className={`commands-list__item${editingQuote?.id === quote.id ? " commands-list__item--active" : ""}`}
                  onClick={() => setEditingQuote(quote)}
                >
                  <span>
                    <strong>#{quote.quoteNumber}</strong>
                    <em>{quote.author ? `By ${quote.author}` : "No author"}</em>
                    <small>{quote.text}</small>
                  </span>
                  <div className="commands-list__status">
                    <StatusPill tone="info" label={`${quote.useCount} uses`} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No quotes yet" description="Save memorable stream moments here, then let chat pull them with !quote." />
          )}
        </Card>

        <Card>
          <CardHeader
            title={editingQuote ? "Quote editor" : "Select a quote"}
            description="Quote numbers are what viewers use after !quote."
          />
          {editingQuote ? (
            <div className="commands-editor">
              <FormField label="Quote number" hint="Used by chat, for example !quote 7.">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={editingQuote.quoteNumber}
                  onChange={(event) =>
                    setEditingQuote({
                      ...editingQuote,
                      quoteNumber: Math.max(1, Math.floor(Number(event.target.value || 1))),
                    })
                  }
                />
              </FormField>

              <FormField label="Quote text">
                <textarea
                  rows={5}
                  value={editingQuote.text}
                  onChange={(event) => setEditingQuote({ ...editingQuote, text: event.target.value })}
                  placeholder="That belongs in the quote book."
                />
              </FormField>

              <div className="commands-editor__grid">
                <FormField label="Author">
                  <input
                    value={editingQuote.author ?? ""}
                    onChange={(event) => setEditingQuote({ ...editingQuote, author: event.target.value })}
                    placeholder="Streamer or viewer"
                  />
                </FormField>
                <FormField label="Added by">
                  <input
                    value={editingQuote.addedBy ?? ""}
                    onChange={(event) => setEditingQuote({ ...editingQuote, addedBy: event.target.value })}
                    placeholder="Moderator"
                  />
                </FormField>
              </div>

              <div className="commands-stats">
                <StatusPill tone="info" label="Uses" detail={String(editingQuote.useCount)} />
                <StatusPill tone="neutral" label="Last used" detail={editingQuote.lastUsedAt ? new Date(editingQuote.lastUsedAt).toLocaleString() : "Never"} />
              </div>

              <div className="commands-editor__actions">
                <Button type="button" variant="primary" size="sm" onClick={() => void saveQuote()}>
                  Save quote
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!editingQuote) return;
                    const response = await api.useChatQuote(editingQuote.id);
                    setEditingQuote(response.quote);
                    toast("Quote use counted");
                    await load();
                  }}
                  disabled={!quotes.some((quote) => quote.id === editingQuote.id)}
                >
                  Count use
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await api.deleteChatQuote(editingQuote.id);
                    setEditingQuote(null);
                    toast("Quote deleted");
                    await load();
                  }}
                  disabled={!quotes.some((quote) => quote.id === editingQuote.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState title="No quote selected" description="Pick an existing quote or create a new one." />
          )}
        </Card>
      </div>

      <div className="commands-section">
        <Card>
          <CardHeader title="Viewer queue" description="Viewers can type !join, !leave, and !queue. Use this for games, reviews, raids, or community turns." />
          {loading ? (
            <p className="subtitle">Loading queue...</p>
          ) : viewerQueue.length ? (
            <div className="commands-list">
              {viewerQueue.map((entry, index) => (
                <div className="commands-list__item commands-list__item--static" key={entry.id}>
                  <span>
                    <strong>#{index + 1} {entry.displayName}</strong>
                    <em>{entry.login ? `@${entry.login}` : "Manual entry"}</em>
                    <small>{entry.note || `Joined ${new Date(entry.joinedAt).toLocaleTimeString()}`}</small>
                  </span>
                  <div className="commands-list__status">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        await api.removeViewerQueueEntry(entry.id);
                        toast("Queue entry removed");
                        await load();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Queue is empty" description="Viewers can join from chat with !join, or you can add someone manually." />
          )}
        </Card>

        <Card>
          <CardHeader title="Queue controls" description="Pick the next viewer or manually add someone to the queue." />
          <div className="commands-editor">
            <div className="commands-editor__actions">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={async () => {
                  const response = await api.popViewerQueueEntry();
                  toast(`${response.entry.displayName} picked from queue`);
                  await load();
                }}
                disabled={!viewerQueue.length}
              >
                Pick next
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={async () => {
                  await api.clearViewerQueue();
                  toast("Queue cleared");
                  await load();
                }}
                disabled={!viewerQueue.length}
              >
                Clear queue
              </Button>
            </div>

            <FormField label="Manual display name">
              <input
                value={manualQueueName}
                onChange={(event) => setManualQueueName(event.target.value)}
                placeholder="Viewer name"
              />
            </FormField>
            <FormField label="Note" hint="Optional context, such as game mode, request, or turn details.">
              <input
                value={manualQueueNote}
                onChange={(event) => setManualQueueNote(event.target.value)}
                placeholder="Optional queue note"
              />
            </FormField>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                const displayName = manualQueueName.trim();
                if (!displayName) return;
                await api.addViewerQueueEntry({
                  userId: `manual:${displayName.toLowerCase()}`,
                  displayName,
                  note: manualQueueNote.trim() || undefined,
                });
                setManualQueueName("");
                setManualQueueNote("");
                toast("Viewer added to queue");
                await load();
              }}
              disabled={!manualQueueName.trim()}
            >
              Add manually
            </Button>
          </div>
        </Card>
      </div>

      <div className="commands-section">
        <Card>
          <CardHeader title="Loyalty points" description="Viewers earn 5 points from chat activity once per minute. Viewers can check balances with !points." />
          {loading ? (
            <p className="subtitle">Loading loyalty balances...</p>
          ) : loyaltyViewers.length ? (
            <div className="commands-list">
              {loyaltyViewers.map((viewer, index) => (
                <button
                  type="button"
                  key={viewer.id}
                  className={`commands-list__item${selectedViewer?.id === viewer.id ? " commands-list__item--active" : ""}`}
                  onClick={() => setSelectedViewer(viewer)}
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

        <Card>
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
                  value={loyaltyAdjustment}
                  onChange={(event) => setLoyaltyAdjustment(Math.max(0, Math.floor(Number(event.target.value || 0))))}
                />
              </FormField>

              <div className="commands-editor__actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const response = await api.adjustLoyaltyPoints(selectedViewer.id, loyaltyAdjustment);
                    setSelectedViewer(response.viewer);
                    toast("Points added");
                    await load();
                  }}
                >
                  Add points
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const response = await api.adjustLoyaltyPoints(selectedViewer.id, -loyaltyAdjustment);
                    setSelectedViewer(response.viewer);
                    toast("Points removed");
                    await load();
                  }}
                >
                  Remove points
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    const response = await api.setLoyaltyPoints(selectedViewer.id, loyaltyAdjustment);
                    setSelectedViewer(response.viewer);
                    toast("Balance set");
                    await load();
                  }}
                >
                  Set balance
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState title="No viewer selected" description="Pick a viewer from the leaderboard to manage their points." />
          )}
        </Card>
      </div>
    </>
  );
}

function permissionLabel(permission: ChatCommand["permission"]): string {
  switch (permission) {
    case "subscriber":
      return "Subs+";
    case "vip":
      return "VIP+";
    case "moderator":
      return "Mods";
    case "broadcaster":
      return "Broadcaster";
    default:
      return "Everyone";
  }
}

function formatInterval(intervalMs: number): string {
  const minutes = Math.max(1, Math.round(intervalMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
