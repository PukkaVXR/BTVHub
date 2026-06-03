import { deleteChatTimer, getChatTimer, getChatTimers, upsertChatTimer } from "../db.js";
import { sendChatTimer } from "../chat-timer-scheduler.js";
import { chatTimerFromBody, validateChatTimer } from "../schemas/chat-timer.schema.js";
import type { RouteModule } from "./types.js";

export const registerChatTimersRoutes: RouteModule = (app) => {
  app.get("/api/chat-timers", async () => getChatTimers());

  app.put("/api/chat-timers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const timer = chatTimerFromBody(id, req.body as ReturnType<typeof getChatTimers>[number]);
    const error = validateChatTimer(timer);
    if (error) return reply.status(400).send({ ok: false, message: error });
    upsertChatTimer(timer);
    return { ok: true, timer };
  });

  app.delete("/api/chat-timers/:id", async (req) => {
    deleteChatTimer((req.params as { id: string }).id);
    return { ok: true };
  });

  app.post("/api/chat-timers/:id/test", async (req, reply) => {
    const timer = getChatTimer((req.params as { id: string }).id);
    if (!timer) return reply.status(404).send({ ok: false, message: "Timer not found" });
    let ok = false;
    let message = "Timer message was not sent";
    try {
      ok = await sendChatTimer(timer);
    } catch (err) {
      message = err instanceof Error ? err.message : message;
    }
    return reply.status(ok ? 200 : 409).send({
      ok,
      message: ok ? "Timer message sent" : message,
    });
  });
};
