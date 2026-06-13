import { useEffect, useMemo, useState } from "react";
import {
  api,
  type ChatCommand,
  type ChatQuote,
  type ChatTimer,
  type Giveaway,
  type LoyaltyViewer,
  type MiniGameRun,
  type ViewerQueueEntry,
} from "../api";
import { CommandsMiniGamesPanel } from "../components/commands/CommandsMiniGamesPanel";
import { CommandsLoyaltyPanel } from "../components/commands/CommandsLoyaltyPanel";
import { CommandsGiveawayPanel } from "../components/commands/CommandsGiveawayPanel";
import { CommandsViewerQueuePanel } from "../components/commands/CommandsViewerQueuePanel";
import { CommandsQuotesPanel } from "../components/commands/CommandsQuotesPanel";
import { CommandsTimersPanel } from "../components/commands/CommandsTimersPanel";
import { CommandsManagerPanel } from "../components/commands/CommandsManagerPanel";
import { useToast } from "../hooks/useToast";
import { Button, PageHeader, StatusPill } from "../ui";

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
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [miniGameRuns, setMiniGameRuns] = useState<MiniGameRun[]>([]);
  const [activeGiveaway, setActiveGiveaway] = useState<Giveaway | null>(null);
  const [editing, setEditing] = useState<ChatCommand | null>(null);
  const [editingTimer, setEditingTimer] = useState<ChatTimer | null>(null);
  const [editingQuote, setEditingQuote] = useState<ChatQuote | null>(null);
  const [selectedViewer, setSelectedViewer] = useState<LoyaltyViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [nextCommands, nextTimers, nextQuotes, nextLoyalty, nextQueue, nextGiveaways, nextMiniGames] = await Promise.all([
        api.chatCommands(),
        api.chatTimers(),
        api.chatQuotes(),
        api.loyaltyViewers(),
        api.viewerQueue(),
        api.giveaways(),
        api.miniGameRuns(),
      ]);
      setCommands(nextCommands);
      setTimers(nextTimers);
      setQuotes(nextQuotes);
      setLoyaltyViewers(nextLoyalty.viewers);
      setViewerQueue(nextQueue.entries);
      setGiveaways(nextGiveaways.giveaways);
      setActiveGiveaway(nextGiveaways.active);
      setMiniGameRuns(nextMiniGames.runs);
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

  const testCommand = async (id: string) => {
    await api.testChatCommand(id);
    toast("Test response sent to Twitch chat");
  };

  const deleteCommand = async (id: string) => {
    await api.deleteChatCommand(id);
    setEditing(null);
    toast("Command deleted");
    await load();
  };

  const saveTimer = async () => {
    if (!editingTimer) return;
    const response = await api.saveChatTimer(editingTimer);
    setEditingTimer(response.timer);
    toast("Timer saved");
    await load();
  };

  const testTimer = async (id: string) => {
    await api.testChatTimer(id);
    toast("Timer message sent to Twitch chat");
    await load();
  };

  const deleteTimer = async (id: string) => {
    await api.deleteChatTimer(id);
    setEditingTimer(null);
    toast("Timer deleted");
    await load();
  };

  const saveQuote = async () => {
    if (!editingQuote) return;
    const response = await api.saveChatQuote(editingQuote);
    setEditingQuote(response.quote);
    toast("Quote saved");
    await load();
  };

  const countQuoteUse = async (id: string) => {
    const response = await api.useChatQuote(id);
    setEditingQuote(response.quote);
    toast("Quote use counted");
    await load();
  };

  const deleteQuote = async (id: string) => {
    await api.deleteChatQuote(id);
    setEditingQuote(null);
    toast("Quote deleted");
    await load();
  };

  const adjustLoyalty = async (viewerId: string, amount: number) => {
    const response = await api.adjustLoyaltyPoints(viewerId, amount);
    setSelectedViewer(response.viewer);
    toast(amount >= 0 ? "Points added" : "Points removed");
    await load();
  };

  const setLoyalty = async (viewerId: string, amount: number) => {
    const response = await api.setLoyaltyPoints(viewerId, amount);
    setSelectedViewer(response.viewer);
    toast("Balance set");
    await load();
  };

  const openGiveaway = async (name: string, keyword: string) => {
    const response = await api.openGiveaway({ name, keyword });
    setActiveGiveaway(response.giveaway);
    toast("Giveaway opened");
    await load();
  };

  const pickGiveawayWinner = async (id: string) => {
    const response = await api.pickGiveawayWinner(id);
    setActiveGiveaway(response.giveaway);
    toast(`${response.winner.displayName} won`);
    await load();
  };

  const announceGiveawayWinner = async (id: string) => {
    await api.announceGiveawayWinner(id);
    toast("Winner announced in chat");
  };

  const closeGiveaway = async (id: string) => {
    await api.closeGiveaway(id);
    toast("Giveaway closed");
    await load();
  };

  const clearGiveawayEntries = async (id: string) => {
    await api.clearGiveawayEntries(id);
    toast("Giveaway entries cleared");
    await load();
  };

  const removeGiveawayEntry = async (entryId: string) => {
    await api.removeGiveawayEntry(entryId);
    toast("Entry removed");
    await load();
  };

  const addGiveawayEntry = async (giveawayId: string, displayName: string) => {
    await api.addGiveawayEntry(giveawayId, {
      userId: `manual:${displayName.toLowerCase()}`,
      displayName,
    });
    toast("Entry added");
    await load();
  };

  const removeQueueEntry = async (entryId: string) => {
    await api.removeViewerQueueEntry(entryId);
    toast("Queue entry removed");
    await load();
  };

  const pickNextQueueEntry = async () => {
    const response = await api.popViewerQueueEntry();
    toast(`${response.entry.displayName} picked from queue`);
    await load();
  };

  const clearQueue = async () => {
    await api.clearViewerQueue();
    toast("Queue cleared");
    await load();
  };

  const addQueueEntry = async (displayName: string, note?: string) => {
    await api.addViewerQueueEntry({
      userId: `manual:${displayName.toLowerCase()}`,
      displayName,
      note,
    });
    toast("Viewer added to queue");
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
        <StatusPill tone={activeGiveaway ? "success" : "neutral"} label="Giveaway" detail={activeGiveaway ? `${activeGiveaway.entries.length} in` : "Closed"} />
        <StatusPill tone={miniGameRuns.length ? "info" : "neutral"} label="Games" detail={String(miniGameRuns.length)} />
      </div>

      <CommandsManagerPanel
        commands={commands}
        editingCommand={editing}
        loading={loading}
        onChange={setEditing}
        onSave={() => void save()}
        onTest={(id) => void testCommand(id)}
        onDelete={(id) => void deleteCommand(id)}
      />

      <CommandsTimersPanel
        timers={timers}
        editingTimer={editingTimer}
        loading={loading}
        onChange={setEditingTimer}
        onSave={() => void saveTimer()}
        onTest={(id) => void testTimer(id)}
        onDelete={(id) => void deleteTimer(id)}
      />

      <CommandsQuotesPanel
        quotes={quotes}
        editingQuote={editingQuote}
        loading={loading}
        onChange={setEditingQuote}
        onSave={() => void saveQuote()}
        onCountUse={(id) => void countQuoteUse(id)}
        onDelete={(id) => void deleteQuote(id)}
      />

      <CommandsViewerQueuePanel
        entries={viewerQueue}
        loading={loading}
        onRemove={(id) => void removeQueueEntry(id)}
        onPickNext={() => void pickNextQueueEntry()}
        onClear={() => void clearQueue()}
        onAdd={(displayName, note) => void addQueueEntry(displayName, note)}
      />

      <CommandsGiveawayPanel
        activeGiveaway={activeGiveaway}
        giveawayCount={giveaways.length}
        onOpen={(name, keyword) => void openGiveaway(name, keyword)}
        onPickWinner={(id) => void pickGiveawayWinner(id)}
        onAnnounceWinner={(id) => void announceGiveawayWinner(id)}
        onClose={(id) => void closeGiveaway(id)}
        onClearEntries={(id) => void clearGiveawayEntries(id)}
        onRemoveEntry={(id) => void removeGiveawayEntry(id)}
        onAddEntry={(id, displayName) => void addGiveawayEntry(id, displayName)}
      />

      <CommandsMiniGamesPanel runs={miniGameRuns} />

      <CommandsLoyaltyPanel
        viewers={loyaltyViewers}
        selectedViewer={selectedViewer}
        loading={loading}
        onSelect={setSelectedViewer}
        onAdjust={(viewerId, amount) => void adjustLoyalty(viewerId, amount)}
        onSet={(viewerId, amount) => void setLoyalty(viewerId, amount)}
      />
    </>
  );
}
