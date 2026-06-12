import type { DatabaseSync } from "node:sqlite";

export interface ChatCommand {
  id: string;
  command: string;
  aliases: string[];
  permission: "everyone" | "subscriber" | "vip" | "moderator" | "broadcaster";
  enabled: boolean;
  cooldownMs: number;
  response: string;
  responses: string[];
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatTimer {
  id: string;
  name: string;
  enabled: boolean;
  intervalMs: number;
  message: string;
  responses: string[];
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatQuote {
  id: string;
  quoteNumber: number;
  text: string;
  author?: string;
  addedBy?: string;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatRepositoryDeps {
  getDb: () => DatabaseSync;
  withTransaction: <T>(work: () => T) => T;
}

function parseChatCommandAliases(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(String(raw));
    return Array.isArray(value) ? value.filter((alias): alias is string => typeof alias === "string") : [];
  } catch {
    return [];
  }
}

function parseChatCommandResponses(raw: unknown, fallback: string): string[] {
  if (raw) {
    try {
      const value = JSON.parse(String(raw));
      const responses = Array.isArray(value)
        ? value.map((response) => String(response).trim()).filter(Boolean)
        : [];
      if (responses.length) return responses;
    } catch {
      // Fall back to the legacy response column.
    }
  }
  return fallback ? [fallback] : [];
}

function rowToChatCommand(row: Record<string, unknown>): ChatCommand {
  const responses = parseChatCommandResponses(row.responses_json, String(row.response ?? ""));
  return {
    id: String(row.id),
    command: String(row.command),
    aliases: parseChatCommandAliases(row.aliases_json),
    permission: String(row.permission ?? "everyone") as ChatCommand["permission"],
    enabled: Boolean(row.enabled),
    cooldownMs: Number(row.cooldown_ms ?? 0),
    response: String(row.response),
    responses,
    useCount: Number(row.use_count ?? 0),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToChatTimer(row: Record<string, unknown>): ChatTimer {
  const responses = parseChatCommandResponses(row.responses_json, String(row.message ?? ""));
  return {
    id: String(row.id),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    intervalMs: Number(row.interval_ms),
    message: String(row.message),
    responses,
    runCount: Number(row.run_count ?? 0),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToChatQuote(row: Record<string, unknown>): ChatQuote {
  return {
    id: String(row.id),
    quoteNumber: Number(row.quote_number),
    text: String(row.text),
    author: row.author ? String(row.author) : undefined,
    addedBy: row.added_by ? String(row.added_by) : undefined,
    useCount: Number(row.use_count ?? 0),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createChatRepository({ getDb, withTransaction }: ChatRepositoryDeps) {
  function getChatCommands(): ChatCommand[] {
    return (getDb().prepare("SELECT * FROM chat_commands ORDER BY command").all() as Array<Record<string, unknown>>).map(
      rowToChatCommand,
    );
  }

  function getChatCommand(id: string): ChatCommand | null {
    const row = getDb().prepare("SELECT * FROM chat_commands WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChatCommand(row) : null;
  }

  function getChatCommandByCommand(command: string): ChatCommand | null {
    const row = getDb().prepare("SELECT * FROM chat_commands WHERE lower(command) = lower(?)").get(command) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChatCommand(row) : null;
  }

  function getChatCommandByTrigger(trigger: string): ChatCommand | null {
    const normalized = trigger.toLowerCase();
    return getChatCommands().find((command) =>
      command.command.toLowerCase() === normalized || command.aliases.some((alias) => alias.toLowerCase() === normalized)
    ) ?? null;
  }

  function upsertChatCommand(command: ChatCommand): void {
    const now = new Date().toISOString();
    const responses = command.responses.length ? command.responses : [command.response];
    getDb().prepare(
      `INSERT INTO chat_commands (id, command, aliases_json, permission, enabled, cooldown_ms, response, responses_json, use_count, last_used_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET command=excluded.command, aliases_json=excluded.aliases_json,
         permission=excluded.permission, enabled=excluded.enabled, cooldown_ms=excluded.cooldown_ms,
         response=excluded.response, responses_json=excluded.responses_json, updated_at=excluded.updated_at`,
    ).run(
      command.id,
      command.command,
      JSON.stringify(command.aliases),
      command.permission,
      command.enabled ? 1 : 0,
      command.cooldownMs,
      responses[0] ?? command.response,
      JSON.stringify(responses),
      command.useCount,
      command.lastUsedAt ?? null,
      command.createdAt || now,
      command.updatedAt || now,
    );
  }

  function recordChatCommandUse(id: string): number {
    return withTransaction(() => {
      const now = new Date().toISOString();
      getDb().prepare("UPDATE chat_commands SET use_count = use_count + 1, last_used_at = ? WHERE id = ?").run(now, id);
      const row = getDb().prepare("SELECT use_count FROM chat_commands WHERE id = ?").get(id) as
        | { use_count: number }
        | undefined;
      return Number(row?.use_count ?? 0);
    });
  }

  function deleteChatCommand(id: string): void {
    getDb().prepare("DELETE FROM chat_commands WHERE id = ?").run(id);
  }

  function getChatTimers(): ChatTimer[] {
    return (getDb().prepare("SELECT * FROM chat_timers ORDER BY name").all() as Array<Record<string, unknown>>).map(
      rowToChatTimer,
    );
  }

  function getChatTimer(id: string): ChatTimer | null {
    const row = getDb().prepare("SELECT * FROM chat_timers WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChatTimer(row) : null;
  }

  function upsertChatTimer(timer: ChatTimer): void {
    const now = new Date().toISOString();
    const responses = timer.responses.length ? timer.responses : [timer.message];
    getDb().prepare(
      `INSERT INTO chat_timers (id, name, enabled, interval_ms, message, responses_json, run_count, last_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled,
         interval_ms=excluded.interval_ms, message=excluded.message, responses_json=excluded.responses_json,
         updated_at=excluded.updated_at`,
    ).run(
      timer.id,
      timer.name,
      timer.enabled ? 1 : 0,
      timer.intervalMs,
      responses[0] ?? timer.message,
      JSON.stringify(responses),
      timer.runCount,
      timer.lastRunAt ?? null,
      timer.createdAt || now,
      timer.updatedAt || now,
    );
  }

  function recordChatTimerRun(id: string): number {
    return withTransaction(() => {
      const now = new Date().toISOString();
      getDb().prepare("UPDATE chat_timers SET run_count = run_count + 1, last_run_at = ? WHERE id = ?").run(now, id);
      const row = getDb().prepare("SELECT run_count FROM chat_timers WHERE id = ?").get(id) as
        | { run_count: number }
        | undefined;
      return Number(row?.run_count ?? 0);
    });
  }

  function deleteChatTimer(id: string): void {
    getDb().prepare("DELETE FROM chat_timers WHERE id = ?").run(id);
  }

  function getChatQuotes(): ChatQuote[] {
    return (getDb()
      .prepare("SELECT * FROM chat_quotes ORDER BY quote_number DESC")
      .all() as Array<Record<string, unknown>>).map(rowToChatQuote);
  }

  function getChatQuote(id: string): ChatQuote | null {
    const row = getDb().prepare("SELECT * FROM chat_quotes WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChatQuote(row) : null;
  }

  function getChatQuoteByNumber(quoteNumber: number): ChatQuote | null {
    const row = getDb().prepare("SELECT * FROM chat_quotes WHERE quote_number = ?").get(quoteNumber) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChatQuote(row) : null;
  }

  function getRandomChatQuote(): ChatQuote | null {
    const row = getDb().prepare("SELECT * FROM chat_quotes ORDER BY random() LIMIT 1").get() as
      | Record<string, unknown>
      | undefined;
    return row ? rowToChatQuote(row) : null;
  }

  function nextChatQuoteNumber(): number {
    const row = getDb().prepare("SELECT COALESCE(MAX(quote_number), 0) + 1 AS next FROM chat_quotes").get() as {
      next: number;
    };
    return Number(row.next);
  }

  function upsertChatQuote(quote: ChatQuote): void {
    const now = new Date().toISOString();
    const quoteNumber = quote.quoteNumber > 0 ? quote.quoteNumber : nextChatQuoteNumber();
    getDb().prepare(
      `INSERT INTO chat_quotes (id, quote_number, text, author, added_by, use_count, last_used_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET quote_number=excluded.quote_number, text=excluded.text,
         author=excluded.author, added_by=excluded.added_by, updated_at=excluded.updated_at`,
    ).run(
      quote.id,
      quoteNumber,
      quote.text,
      quote.author ?? null,
      quote.addedBy ?? null,
      quote.useCount,
      quote.lastUsedAt ?? null,
      quote.createdAt || now,
      quote.updatedAt || now,
    );
  }

  function recordChatQuoteUse(id: string): number {
    return withTransaction(() => {
      const now = new Date().toISOString();
      getDb().prepare("UPDATE chat_quotes SET use_count = use_count + 1, last_used_at = ? WHERE id = ?").run(now, id);
      const row = getDb().prepare("SELECT use_count FROM chat_quotes WHERE id = ?").get(id) as
        | { use_count: number }
        | undefined;
      return Number(row?.use_count ?? 0);
    });
  }

  function deleteChatQuote(id: string): void {
    getDb().prepare("DELETE FROM chat_quotes WHERE id = ?").run(id);
  }

  return {
    getChatCommands,
    getChatCommand,
    getChatCommandByCommand,
    getChatCommandByTrigger,
    upsertChatCommand,
    recordChatCommandUse,
    deleteChatCommand,
    getChatTimers,
    getChatTimer,
    upsertChatTimer,
    recordChatTimerRun,
    deleteChatTimer,
    getChatQuotes,
    getChatQuote,
    getChatQuoteByNumber,
    getRandomChatQuote,
    nextChatQuoteNumber,
    upsertChatQuote,
    recordChatQuoteUse,
    deleteChatQuote,
  };
}
