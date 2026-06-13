import type { ChatCommand } from "../db.js";
import { normalizeChatCommand } from "../chat-command-utils.js";

const PERMISSIONS: ChatCommand["permission"][] = ["everyone", "subscriber", "vip", "moderator", "broadcaster"];

function normalizeAliases(value: unknown, command: string): string[] {
  const rawAliases = Array.isArray(value)
    ? value
    : String(value ?? "")
      .split(/[,\n]/)
      .map((alias) => alias.trim());
  return Array.from(new Set(rawAliases.map(normalizeChatCommand).filter((alias) => alias && alias !== command)));
}

function normalizeResponses(value: unknown, fallback: unknown): string[] {
  const rawResponses = Array.isArray(value)
    ? value
    : String(value ?? fallback ?? "")
      .split(/\n-{3,}\n|\n\|\|\|\n/)
      .map((response) => response.trim());
  const responses = rawResponses.map((response) => String(response).trim()).filter(Boolean);
  return responses.length ? responses : [String(fallback ?? "").trim()].filter(Boolean);
}

export function chatCommandFromBody(id: string, body: Partial<ChatCommand>): ChatCommand {
  const now = new Date().toISOString();
  const command = normalizeChatCommand(body.command);
  const responses = normalizeResponses(body.responses, body.response);
  return {
    id,
    command,
    aliases: normalizeAliases(body.aliases, command),
    permission: PERMISSIONS.includes(body.permission as ChatCommand["permission"])
      ? (body.permission as ChatCommand["permission"])
      : "everyone",
    enabled: body.enabled ?? true,
    cooldownMs: Math.max(0, Math.round(Number(body.cooldownMs ?? 0))),
    response: responses[0] ?? "",
    responses,
    useCount: Math.max(0, Math.floor(Number(body.useCount ?? 0))),
    lastUsedAt: body.lastUsedAt,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };
}

export function validateChatCommand(command: ChatCommand): string | null {
  if (!command.command || command.command.length < 2) return "Command must start with ! and include a name.";
  if (!/^![a-z0-9][a-z0-9_-]*$/.test(command.command)) {
    return "Command can only use letters, numbers, underscores, and dashes.";
  }
  if (command.aliases.some((alias) => !/^![a-z0-9][a-z0-9_-]*$/.test(alias))) {
    return "Aliases can only use letters, numbers, underscores, and dashes.";
  }
  if (!PERMISSIONS.includes(command.permission)) return "Permission is not valid.";
  if (!Number.isFinite(command.cooldownMs) || command.cooldownMs < 0) return "Cooldown must be zero or greater.";
  if (command.cooldownMs > 24 * 60 * 60 * 1000) return "Cooldown must be 24 hours or less.";
  if (!command.responses.length) return "At least one response is required.";
  if (command.responses.some((response) => response.length > 450)) return "Each response must be 450 characters or fewer.";
  return null;
}
