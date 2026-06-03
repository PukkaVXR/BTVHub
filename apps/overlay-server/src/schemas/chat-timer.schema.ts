import type { ChatTimer } from "../db.js";

function normalizeResponses(value: unknown, fallback: unknown): string[] {
  const rawResponses = Array.isArray(value)
    ? value
    : String(value ?? fallback ?? "")
      .split(/\n-{3,}\n|\n\|\|\|\n/)
      .map((response) => response.trim());
  const responses = rawResponses.map((response) => String(response).trim()).filter(Boolean);
  return responses.length ? responses : [String(fallback ?? "").trim()].filter(Boolean);
}

export function chatTimerFromBody(id: string, body: Partial<ChatTimer>): ChatTimer {
  const now = new Date().toISOString();
  const responses = normalizeResponses(body.responses, body.message);
  return {
    id,
    name: String(body.name ?? "").trim(),
    enabled: body.enabled ?? true,
    intervalMs: Math.max(0, Math.round(Number(body.intervalMs ?? 0))),
    message: responses[0] ?? "",
    responses,
    runCount: Math.max(0, Math.floor(Number(body.runCount ?? 0))),
    lastRunAt: body.lastRunAt,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };
}

export function validateChatTimer(timer: ChatTimer): string | null {
  if (!timer.name || timer.name.length < 2) return "Timer name must be at least 2 characters.";
  if (timer.name.length > 80) return "Timer name must be 80 characters or fewer.";
  if (!Number.isFinite(timer.intervalMs) || timer.intervalMs < 60_000) {
    return "Timer interval must be at least 60 seconds.";
  }
  if (timer.intervalMs > 24 * 60 * 60 * 1000) return "Timer interval must be 24 hours or less.";
  if (!timer.responses.length) return "At least one timer message is required.";
  if (timer.responses.some((response) => response.length > 450)) return "Each timer message must be 450 characters or fewer.";
  return null;
}
