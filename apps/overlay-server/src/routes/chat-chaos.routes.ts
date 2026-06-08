import { getSetting, setSetting } from "../db.js";
import type { RouteModule } from "./types.js";

type ChaosStatus = "calm" | "building" | "chaotic" | "meltdown";

interface ChatChaosState {
  title: string;
  subtitle: string;
  level: number;
  threshold: number;
  decayPerMinute: number;
  visible: boolean;
  color: string;
  updatedAt: string;
}

const SETTING_KEY = "chat_chaos_state";

function defaultChaos(): ChatChaosState {
  return {
    title: "Chat Chaos",
    subtitle: "Energy meter",
    level: 0,
    threshold: 100,
    decayPerMinute: 5,
    visible: true,
    color: "#f59e0b",
    updatedAt: new Date().toISOString(),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(min, Math.min(max, Math.round(next))) : fallback;
}

function readChaos(): ChatChaosState {
  const fallback = defaultChaos();
  const raw = getSetting(SETTING_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<ChatChaosState>;
    const threshold = clampNumber(parsed.threshold, fallback.threshold, 1, 9999);
    return {
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 60) : fallback.title,
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle.slice(0, 120) : fallback.subtitle,
      level: clampNumber(parsed.level, fallback.level, 0, threshold),
      threshold,
      decayPerMinute: clampNumber(parsed.decayPerMinute, fallback.decayPerMinute, 0, 999),
      visible: typeof parsed.visible === "boolean" ? parsed.visible : fallback.visible,
      color: typeof parsed.color === "string" && parsed.color.trim() ? parsed.color : fallback.color,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

function writeChaos(input: Partial<ChatChaosState>): ChatChaosState {
  const current = readChaos();
  const threshold = clampNumber(input.threshold ?? current.threshold, current.threshold, 1, 9999);
  const next: ChatChaosState = {
    ...current,
    ...input,
    title: String(input.title ?? current.title).slice(0, 60),
    subtitle: String(input.subtitle ?? current.subtitle).slice(0, 120),
    threshold,
    level: clampNumber(input.level ?? current.level, current.level, 0, threshold),
    decayPerMinute: clampNumber(input.decayPerMinute ?? current.decayPerMinute, current.decayPerMinute, 0, 999),
    visible: typeof input.visible === "boolean" ? input.visible : current.visible,
    color: String(input.color ?? current.color),
    updatedAt: new Date().toISOString(),
  };
  setSetting(SETTING_KEY, JSON.stringify(next));
  return next;
}

function statusForLevel(state: ChatChaosState): ChaosStatus {
  const percent = state.level / Math.max(1, state.threshold);
  if (percent >= 1) return "meltdown";
  if (percent >= 0.7) return "chaotic";
  if (percent >= 0.35) return "building";
  return "calm";
}

export const registerChatChaosRoutes: RouteModule = (app) => {
  app.get("/api/chat-chaos", async () => ({ ...readChaos(), status: statusForLevel(readChaos()) }));

  app.put("/api/chat-chaos", async (req) => {
    const saved = writeChaos(req.body as Partial<ChatChaosState>);
    return { ...saved, status: statusForLevel(saved) };
  });

  app.post("/api/chat-chaos/reset", async () => {
    const saved = writeChaos(defaultChaos());
    return { ...saved, status: statusForLevel(saved) };
  });

  app.post("/api/chat-chaos/adjust", async (req) => {
    const { amount } = req.body as { amount?: number };
    const current = readChaos();
    const saved = writeChaos({ ...current, level: current.level + clampNumber(amount, 0, -9999, 9999) });
    return { ...saved, status: statusForLevel(saved) };
  });
};
