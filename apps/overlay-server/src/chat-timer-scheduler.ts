import { getChatTimers, recordChatTimerRun, type ChatTimer } from "./db.js";
import { sendTwitchChatMessage } from "./twitch-service.js";

function pickResponse(timer: ChatTimer): string {
  const responses = timer.responses.length ? timer.responses : [timer.message];
  return responses[Math.floor(Math.random() * responses.length)] ?? timer.message;
}

export async function sendChatTimer(timer: ChatTimer): Promise<boolean> {
  const message = pickResponse(timer);
  const ok = await sendTwitchChatMessage(message);
  if (ok) recordChatTimerRun(timer.id);
  return ok;
}

export class ChatTimerScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      void this.tick();
    }, 5000);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = Date.now();
      const timers = getChatTimers().filter((timer) => timer.enabled);
      for (const timer of timers) {
        const lastRunAt = timer.lastRunAt ? new Date(timer.lastRunAt).getTime() : 0;
        if (lastRunAt && now - lastRunAt < timer.intervalMs) continue;
        if (!lastRunAt && now - new Date(timer.createdAt).getTime() < timer.intervalMs) continue;
        try {
          await sendChatTimer(timer);
        } catch {
          // Twitch connectivity and scope issues are surfaced through integration health.
        }
      }
    } finally {
      this.running = false;
    }
  }
}
