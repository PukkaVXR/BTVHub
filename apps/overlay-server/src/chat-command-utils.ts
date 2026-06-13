import type { StreamEvent } from "@btv/shared";

export interface ParsedChatCommand {
  command: string;
  args: string;
  token: string;
}

export function normalizeChatCommand(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ").split(" ")[0] ?? "";
  if (!raw) return "";
  return (raw.startsWith("!") ? raw : `!${raw}`).toLowerCase();
}

export function parseChatCommandText(text: string, requireBang = true): ParsedChatCommand | null {
  const message = text.trim();
  if (!message || (requireBang && !message.startsWith("!"))) return null;
  const token = message.split(/\s+/)[0] ?? "";
  if (!token) return null;
  return {
    command: token.toLowerCase(),
    args: message.slice(token.length).trim(),
    token,
  };
}

export function readChatCommand(event: StreamEvent): ParsedChatCommand | null {
  if (event.type !== "chat") return null;
  const payloadCommand = event.payload.command;
  if (typeof payloadCommand === "string" && payloadCommand.trim()) {
    const token = payloadCommand.trim().split(/\s+/)[0] ?? "";
    return {
      command: normalizeChatCommand(token),
      args: typeof event.payload.args === "string" ? event.payload.args : "",
      token,
    };
  }
  const parsed = parseChatCommandText(event.message ?? "");
  return parsed ? { ...parsed, command: normalizeChatCommand(parsed.command) } : null;
}

export function matchChatCommand(
  text: string,
  command: string,
  mode: string = "startsWith",
): { matched: boolean; args: string } {
  const message = text.trim();
  const expected = command.trim().toLowerCase();
  if (!expected) return { matched: false, args: "" };

  if (mode === "exact") {
    const parsed = parseChatCommandText(message, false);
    return parsed?.command === expected
      ? { matched: true, args: parsed.args }
      : { matched: false, args: "" };
  }
  if (mode === "contains") {
    const index = message.toLowerCase().indexOf(expected);
    return index >= 0
      ? { matched: true, args: message.slice(index + expected.length).trim() }
      : { matched: false, args: "" };
  }
  return message.toLowerCase().startsWith(expected)
    ? { matched: true, args: message.slice(expected.length).trim() }
    : { matched: false, args: "" };
}
