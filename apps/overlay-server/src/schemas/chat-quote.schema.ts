import { nextChatQuoteNumber, type ChatQuote } from "../db.js";

export function chatQuoteFromBody(id: string, body: Partial<ChatQuote>): ChatQuote {
  const now = new Date().toISOString();
  const requestedNumber = Math.floor(Number(body.quoteNumber ?? 0));
  return {
    id,
    quoteNumber: requestedNumber > 0 ? requestedNumber : nextChatQuoteNumber(),
    text: String(body.text ?? "").trim(),
    author: String(body.author ?? "").trim() || undefined,
    addedBy: String(body.addedBy ?? "").trim() || undefined,
    useCount: Math.max(0, Math.floor(Number(body.useCount ?? 0))),
    lastUsedAt: body.lastUsedAt,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };
}

export function validateChatQuote(quote: ChatQuote): string | null {
  if (!Number.isFinite(quote.quoteNumber) || quote.quoteNumber < 1) return "Quote number must be 1 or greater.";
  if (!quote.text || quote.text.length < 2) return "Quote text must be at least 2 characters.";
  if (quote.text.length > 450) return "Quote text must be 450 characters or fewer.";
  if ((quote.author?.length ?? 0) > 80) return "Quote author must be 80 characters or fewer.";
  if ((quote.addedBy?.length ?? 0) > 80) return "Added by must be 80 characters or fewer.";
  return null;
}
