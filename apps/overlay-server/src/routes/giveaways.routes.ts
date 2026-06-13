import {
  clearGiveawayEntries,
  closeGiveaway,
  enterGiveaway,
  getActiveGiveaway,
  getGiveaway,
  getGiveaways,
  openGiveaway,
  pickGiveawayWinner,
  removeGiveawayEntry,
} from "../db.js";
import { sendTwitchChatMessage } from "../twitch-service.js";
import { GiveawayOpenBodySchema, parseBody, ViewerIdentityBodySchema } from "../schemas/request.schema.js";
import type { RouteModule } from "./types.js";

export const registerGiveawaysRoutes: RouteModule = (app) => {
  app.get("/api/giveaways", async () => ({ giveaways: getGiveaways(), active: getActiveGiveaway() }));

  app.post("/api/giveaways/open", async (req, reply) => {
    const body = parseBody(reply, GiveawayOpenBodySchema, req.body);
    if (!body) return;
    const giveaway = openGiveaway({
      name: String(body.name ?? "").trim() || "Stream giveaway",
      keyword: String(body.keyword ?? "").trim() || "!enter",
    });
    return { ok: true, giveaway };
  });

  app.post("/api/giveaways/:id/close", async (req, reply) => {
    const giveaway = closeGiveaway((req.params as { id: string }).id);
    if (!giveaway) return reply.status(404).send({ ok: false, message: "Giveaway not found" });
    return { ok: true, giveaway };
  });

  app.post("/api/giveaways/:id/entries", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(reply, ViewerIdentityBodySchema, req.body);
    if (!body) return;
    const displayName = String(body.displayName ?? "").trim();
    const login = String(body.login ?? "").trim() || undefined;
    const userId = String(body.userId ?? login ?? displayName).trim();
    if (!displayName || !userId) return reply.status(400).send({ ok: false, message: "Display name is required." });
    const result = enterGiveaway({ giveawayId: id, userId, login, displayName });
    if (!result) return reply.status(409).send({ ok: false, message: "Giveaway is not open." });
    return { ok: true, ...result };
  });

  app.delete("/api/giveaways/entries/:entryId", async (req, reply) => {
    const entry = removeGiveawayEntry((req.params as { entryId: string }).entryId);
    if (!entry) return reply.status(404).send({ ok: false, message: "Entry not found" });
    return { ok: true, entry };
  });

  app.post("/api/giveaways/:id/pick", async (req, reply) => {
    const giveaway = pickGiveawayWinner((req.params as { id: string }).id);
    if (!giveaway?.winner) return reply.status(409).send({ ok: false, message: "No entries to pick from." });
    return { ok: true, giveaway, winner: giveaway.winner };
  });

  app.post("/api/giveaways/:id/announce", async (req, reply) => {
    const giveaway = getGiveaway((req.params as { id: string }).id);
    if (!giveaway?.winner) return reply.status(409).send({ ok: false, message: "Pick a winner first." });
    const ok = await sendTwitchChatMessage(`${giveaway.winner.displayName} won ${giveaway.name}!`);
    return { ok, giveaway, winner: giveaway.winner };
  });

  app.post("/api/giveaways/:id/clear", async (req) => ({
    ok: true,
    cleared: clearGiveawayEntries((req.params as { id: string }).id),
  }));
};
