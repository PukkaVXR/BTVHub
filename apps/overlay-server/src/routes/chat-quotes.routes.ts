import {
  deleteChatQuote,
  getChatQuote,
  getChatQuoteByNumber,
  getChatQuotes,
  getRandomChatQuote,
  recordChatQuoteUse,
  upsertChatQuote,
} from "../db.js";
import { chatQuoteFromBody, validateChatQuote } from "../schemas/chat-quote.schema.js";
import type { RouteModule } from "./types.js";

export const registerChatQuotesRoutes: RouteModule = (app) => {
  app.get("/api/chat-quotes", async () => getChatQuotes());

  app.get("/api/chat-quotes/random", async (req, reply) => {
    const quote = getRandomChatQuote();
    if (!quote) return reply.status(404).send({ ok: false, message: "No quotes found" });
    recordChatQuoteUse(quote.id);
    return { ok: true, quote };
  });

  app.put("/api/chat-quotes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const quote = chatQuoteFromBody(id, req.body as ReturnType<typeof getChatQuotes>[number]);
    const error = validateChatQuote(quote);
    if (error) return reply.status(400).send({ ok: false, message: error });
    const existing = getChatQuoteByNumber(quote.quoteNumber);
    if (existing && existing.id !== quote.id) {
      return reply.status(409).send({ ok: false, message: `Quote #${quote.quoteNumber} already exists.` });
    }
    upsertChatQuote(quote);
    return { ok: true, quote };
  });

  app.delete("/api/chat-quotes/:id", async (req) => {
    deleteChatQuote((req.params as { id: string }).id);
    return { ok: true };
  });

  app.post("/api/chat-quotes/:id/use", async (req, reply) => {
    const quote = getChatQuote((req.params as { id: string }).id);
    if (!quote) return reply.status(404).send({ ok: false, message: "Quote not found" });
    const useCount = recordChatQuoteUse(quote.id);
    return { ok: true, quote: { ...quote, useCount } };
  });
};
