import { deleteChatCommand, getChatCommand, getChatCommandByTrigger, getChatCommands, upsertChatCommand } from "../db.js";
import { chatCommandFromBody, validateChatCommand } from "../schemas/chat-command.schema.js";
import { sendTwitchChatMessage } from "../twitch-service.js";
import { parseBody, UnknownRecordBodySchema } from "../schemas/request.schema.js";
import type { RouteModule } from "./types.js";

export const registerChatCommandsRoutes: RouteModule = (app) => {
  app.get("/api/chat-commands", async () => getChatCommands());

  app.put("/api/chat-commands/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parseBody(reply, UnknownRecordBodySchema, req.body);
    if (!body) return;
    const command = chatCommandFromBody(id, body as unknown as ReturnType<typeof getChatCommands>[number]);
    const error = validateChatCommand(command);
    if (error) return reply.status(400).send({ ok: false, message: error });
    for (const trigger of [command.command, ...command.aliases]) {
      const existing = getChatCommandByTrigger(trigger);
      if (existing && existing.id !== id) {
        return reply.status(409).send({ ok: false, message: `${trigger} is already used by ${existing.command}` });
      }
    }
    upsertChatCommand(command);
    return { ok: true, command };
  });

  app.delete("/api/chat-commands/:id", async (req) => {
    deleteChatCommand((req.params as { id: string }).id);
    return { ok: true };
  });

  app.post("/api/chat-commands/:id/test", async (req, reply) => {
    const command = getChatCommand((req.params as { id: string }).id);
    if (!command) return reply.status(404).send({ ok: false, message: "Command not found" });
    let ok = false;
    let message = "Twitch chat was not sent";
    try {
      ok = await sendTwitchChatMessage(command.response);
    } catch (err) {
      message = err instanceof Error ? err.message : message;
    }
    return reply.status(ok ? 200 : 409).send({
      ok,
      message: ok ? "Command response sent" : message,
    });
  });
};
