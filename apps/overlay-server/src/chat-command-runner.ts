import type { StreamEvent } from "@btv/shared";
import {
  adjustLoyaltyViewerPoints,
  getChatCommandByTrigger,
  enterGiveaway,
  getActiveGiveaway,
  getLoyaltyViewer,
  getChatQuoteByNumber,
  getRandomChatQuote,
  addViewerQueueEntry,
  getViewerQueueEntries,
  getViewerQueuePosition,
  removeViewerQueueEntry,
  recordChatCommandUse,
  recordChatQuoteUse,
  recordMiniGameRun,
  type ChatCommand,
  type ChatQuote,
} from "./db.js";
import { sendTwitchChatMessage } from "./twitch-service.js";

export interface ChatCommandResult {
  matched: boolean;
  sent: boolean;
  command?: string;
  message?: string;
}

const lastCommandUse = new Map<string, number>();

export async function runChatCommandFromEvent(event: StreamEvent): Promise<ChatCommandResult> {
  if (event.type !== "chat") return { matched: false, sent: false };
  const message = event.message?.trim() ?? "";
  if (!message.startsWith("!")) return { matched: false, sent: false };

  const [commandToken] = message.split(/\s+/);
  if (!commandToken) return { matched: false, sent: false };

  const trigger = commandToken.toLowerCase();
  const args = message.slice(commandToken.length).trim();
  const command = getChatCommandByTrigger(trigger);
  if (!command && trigger === "!points") return runPointsCommand(event);
  if (!command && trigger === "!quote") return runQuoteCommand(args);
  if (!command && trigger === "!join") return runJoinQueueCommand(event, args);
  if (!command && trigger === "!leave") return runLeaveQueueCommand(event);
  if (!command && trigger === "!queue") return runQueueStatusCommand(event);
  if (!command && (trigger === "!dice" || trigger === "!roll")) return runDiceCommand(event, args);
  if (!command && (trigger === "!raffle" || trigger === "!enter" || trigger === getActiveGiveaway()?.keyword)) {
    return runGiveawayCommand(event);
  }
  if (!command || !command.enabled) return { matched: false, sent: false, command: commandToken };
  if (!hasCommandPermission(event, command.permission)) {
    return { matched: true, sent: false, command: trigger, message: "Permission denied" };
  }
  const cooldownRemainingMs = getCooldownRemaining(command);
  if (cooldownRemainingMs > 0) {
    return {
      matched: true,
      sent: false,
      command: trigger,
      message: `Cooldown active for ${Math.ceil(cooldownRemainingMs / 1000)}s`,
    };
  }

  try {
    const ok = await sendTwitchChatMessage(renderCommandResponse(pickCommandResponse(command), event, command, trigger, args));
    if (ok) {
      const useCount = recordChatCommandUse(command.id);
      command.useCount = useCount;
      lastCommandUse.set(command.id, Date.now());
    }
    return {
      matched: true,
      sent: ok,
      command: trigger,
      message: ok ? "Command response sent" : "Command response blocked",
    };
  } catch (err) {
    return {
      matched: true,
      sent: false,
      command: trigger,
      message: err instanceof Error ? err.message : "Command response failed",
    };
  }
}

async function runGiveawayCommand(event: StreamEvent): Promise<ChatCommandResult> {
  if (!event.user?.id || !event.user.displayName) {
    return { matched: true, sent: false, command: "!raffle", message: "No viewer found" };
  }
  const giveaway = getActiveGiveaway();
  if (!giveaway) return sendBuiltInChatMessage("!raffle", "There is no open giveaway right now.", "Giveaway status");
  const result = enterGiveaway({
    giveawayId: giveaway.id,
    userId: event.user.id,
    login: event.user.login,
    displayName: event.user.displayName,
  });
  if (!result) return sendBuiltInChatMessage("!raffle", "This giveaway is closed.", "Giveaway entry");
  const message = result.alreadyEntered
    ? `${result.entry.displayName}, you are already entered in ${giveaway.name}.`
    : `${result.entry.displayName} entered ${giveaway.name}! ${result.giveaway.entries.length} entered.`;
  return sendBuiltInChatMessage("!raffle", message, "Giveaway entry");
}

async function runJoinQueueCommand(event: StreamEvent, note: string): Promise<ChatCommandResult> {
  if (!event.user?.id || !event.user.displayName) {
    return { matched: true, sent: false, command: "!join", message: "No viewer found" };
  }
  const result = addViewerQueueEntry({
    userId: event.user.id,
    login: event.user.login,
    displayName: event.user.displayName,
    note,
  });
  const message = result.alreadyQueued
    ? `${result.entry.displayName}, you are already in the queue at position ${result.position}.`
    : `${result.entry.displayName} joined the queue at position ${result.position}.`;
  return sendBuiltInChatMessage("!join", message, "Queue join");
}

async function runLeaveQueueCommand(event: StreamEvent): Promise<ChatCommandResult> {
  if (!event.user?.id) return { matched: true, sent: false, command: "!leave", message: "No viewer found" };
  const entry = removeViewerQueueEntry(event.user.id);
  const message = entry
    ? `${entry.displayName} left the queue.`
    : `${event.user.displayName ?? "Viewer"}, you are not in the queue.`;
  return sendBuiltInChatMessage("!leave", message, "Queue leave");
}

async function runQueueStatusCommand(event: StreamEvent): Promise<ChatCommandResult> {
  const entries = getViewerQueueEntries();
  if (!entries.length) return sendBuiltInChatMessage("!queue", "The queue is currently empty.", "Queue status");
  const position = event.user?.id ? getViewerQueuePosition(event.user.id) : 0;
  const head = entries[0]!;
  const personal = position > 0 ? ` You are position ${position}.` : "";
  return sendBuiltInChatMessage(
    "!queue",
    `Queue has ${entries.length} viewer${entries.length === 1 ? "" : "s"}. Next: ${head.displayName}.${personal}`,
    "Queue status",
  );
}

async function runDiceCommand(event: StreamEvent, args: string): Promise<ChatCommandResult> {
  if (!event.user?.id || !event.user.displayName) {
    return { matched: true, sent: false, command: "!dice", message: "No viewer found" };
  }

  const wager = parseDiceWager(args);
  const viewer = getLoyaltyViewer(event.user.id);
  const currentPoints = viewer?.points ?? 0;
  const name = event.user.displayName;
  if (wager > currentPoints) {
    return sendBuiltInChatMessage(
      "!dice",
      `${name}, you only have ${currentPoints} point${currentPoints === 1 ? "" : "s"} to wager.`,
      "Dice game",
    );
  }

  const playerRoll = rollD6();
  const btvRoll = rollD6();
  const outcome = playerRoll > btvRoll ? "win" : playerRoll < btvRoll ? "lose" : "tie";
  const pointsDelta = outcome === "win" ? wager : outcome === "lose" ? -wager : 0;
  if (pointsDelta !== 0) adjustLoyaltyViewerPoints(event.user.id, pointsDelta);

  recordMiniGameRun({
    game: "dice",
    userId: event.user.id,
    login: event.user.login,
    displayName: name,
    wager,
    outcome,
    pointsDelta,
    result: { playerRoll, btvRoll },
  });

  return sendBuiltInChatMessage("!dice", formatDiceResult(name, playerRoll, btvRoll, wager, outcome, pointsDelta), "Dice game");
}

async function sendBuiltInChatMessage(command: string, message: string, label: string): Promise<ChatCommandResult> {
  try {
    const ok = await sendTwitchChatMessage(message);
    return { matched: true, sent: ok, command, message: ok ? `${label} sent` : `${label} blocked` };
  } catch (err) {
    return {
      matched: true,
      sent: false,
      command,
      message: err instanceof Error ? err.message : `${label} failed`,
    };
  }
}

async function runPointsCommand(event: StreamEvent): Promise<ChatCommandResult> {
  if (!event.user?.id) return { matched: true, sent: false, command: "!points", message: "No viewer found" };
  const viewer = getLoyaltyViewer(event.user.id);
  const points = viewer?.points ?? 0;
  const lifetime = viewer?.lifetimePoints ?? 0;
  const name = event.user.displayName ?? event.user.login ?? "Viewer";
  try {
    const ok = await sendTwitchChatMessage(`${name} has ${points} points (${lifetime} lifetime).`);
    return {
      matched: true,
      sent: ok,
      command: "!points",
      message: ok ? "Points sent" : "Points blocked",
    };
  } catch (err) {
    return {
      matched: true,
      sent: false,
      command: "!points",
      message: err instanceof Error ? err.message : "Points failed",
    };
  }
}

async function runQuoteCommand(args: string): Promise<ChatCommandResult> {
  const requestedNumber = Number.parseInt(args.split(/\s+/)[0] ?? "", 10);
  const quote = Number.isFinite(requestedNumber) && requestedNumber > 0
    ? getChatQuoteByNumber(requestedNumber)
    : getRandomChatQuote();
  if (!quote) {
    return { matched: true, sent: false, command: "!quote", message: "No quote found" };
  }

  try {
    const ok = await sendTwitchChatMessage(formatQuote(quote));
    if (ok) recordChatQuoteUse(quote.id);
    return {
      matched: true,
      sent: ok,
      command: "!quote",
      message: ok ? "Quote sent" : "Quote blocked",
    };
  } catch (err) {
    return {
      matched: true,
      sent: false,
      command: "!quote",
      message: err instanceof Error ? err.message : "Quote failed",
    };
  }
}

function formatQuote(quote: ChatQuote): string {
  const author = quote.author ? ` - ${quote.author}` : "";
  return `#${quote.quoteNumber}: "${quote.text}"${author}`;
}

function parseDiceWager(args: string): number {
  const raw = args.trim().split(/\s+/)[0] ?? "";
  const wager = Number.parseInt(raw, 10);
  if (!Number.isFinite(wager) || wager <= 0) return 0;
  return Math.min(1000, Math.floor(wager));
}

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function formatDiceResult(
  name: string,
  playerRoll: number,
  btvRoll: number,
  wager: number,
  outcome: "win" | "lose" | "tie",
  pointsDelta: number,
): string {
  const result = `${name} rolled ${playerRoll}. BTV rolled ${btvRoll}.`;
  if (wager <= 0) {
    if (outcome === "win") return `${result} ${name} wins for bragging rights.`;
    if (outcome === "lose") return `${result} BTV wins this round.`;
    return `${result} Tie game.`;
  }
  if (outcome === "win") return `${result} ${name} wins ${pointsDelta} points.`;
  if (outcome === "lose") return `${result} ${name} loses ${Math.abs(pointsDelta)} points.`;
  return `${result} Tie game. ${name}'s ${wager} point wager is returned.`;
}

function pickCommandResponse(command: ChatCommand): string {
  const responses = command.responses.length ? command.responses : [command.response];
  return responses[Math.floor(Math.random() * responses.length)] ?? command.response;
}

function renderCommandResponse(
  template: string,
  event: StreamEvent,
  command: ChatCommand,
  trigger: string,
  args: string,
): string {
  const replacements: Record<string, string> = {
    user: event.user?.displayName ?? "Someone",
    displayName: event.user?.displayName ?? "Someone",
    login: event.user?.login ?? event.user?.displayName ?? "viewer",
    command: command.command,
    trigger,
    args,
    count: String(command.useCount + 1),
    nextCount: String(command.useCount + 1),
  };

  return template.replace(/\{(user|displayName|login|command|trigger|args|count|nextCount)\}/gi, (match, key: string) => {
    const value = replacements[key] ?? replacements[key.toLowerCase()];
    return value ?? match;
  });
}

function getCooldownRemaining(command: ChatCommand): number {
  if (command.cooldownMs <= 0) return 0;
  const lastUsedAt = lastCommandUse.get(command.id);
  if (!lastUsedAt) return 0;
  return Math.max(0, command.cooldownMs - (Date.now() - lastUsedAt));
}

function hasCommandPermission(event: StreamEvent, permission: ChatCommand["permission"]): boolean {
  if (permission === "everyone") return true;
  const roles = readRoles(event);
  if (roles.has("broadcaster")) return true;
  if (permission === "broadcaster") return false;
  if (permission === "moderator") return roles.has("moderator");
  if (permission === "vip") return roles.has("moderator") || roles.has("vip");
  if (permission === "subscriber") {
    return roles.has("moderator") || roles.has("vip") || roles.has("subscriber") || roles.has("founder");
  }
  return false;
}

function readRoles(event: StreamEvent): Set<string> {
  const roles = new Set<string>();
  const payloadRoles = event.payload.roles;
  if (Array.isArray(payloadRoles)) {
    for (const role of payloadRoles) roles.add(String(role).toLowerCase());
  }

  const badges = event.payload.badges;
  if (Array.isArray(badges)) {
    for (const badge of badges) {
      if (badge && typeof badge === "object" && "set_id" in badge) {
        roles.add(String((badge as { set_id: unknown }).set_id).toLowerCase());
      } else if (badge && typeof badge === "object" && "setId" in badge) {
        roles.add(String((badge as { setId: unknown }).setId).toLowerCase());
      } else if (typeof badge === "string") {
        roles.add(badge.toLowerCase());
      }
    }
  }

  if ((event.payload as { subscriber?: unknown }).subscriber) roles.add("subscriber");
  return roles;
}
