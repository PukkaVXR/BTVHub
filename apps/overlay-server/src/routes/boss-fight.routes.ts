import { getSetting, setSetting } from "../db.js";
import { AmountBodySchema, BossFightUpdateBodySchema, parseBody } from "../schemas/request.schema.js";
import type { RouteModule } from "./types.js";

interface BossFightState {
  name: string;
  subtitle: string;
  maxHp: number;
  currentHp: number;
  shield: number;
  phase: number;
  visible: boolean;
  enraged: boolean;
  color: string;
  updatedAt: string;
}

const SETTING_KEY = "boss_fight_state";

function defaultBossFight(): BossFightState {
  return {
    name: "Stream Boss",
    subtitle: "Chat versus the boss",
    maxHp: 1000,
    currentHp: 1000,
    shield: 0,
    phase: 1,
    visible: true,
    enraged: false,
    color: "#ff5a67",
    updatedAt: new Date().toISOString(),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(min, Math.min(max, Math.round(next))) : fallback;
}

function readBossFight(): BossFightState {
  const fallback = defaultBossFight();
  const raw = getSetting(SETTING_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<BossFightState>;
    const maxHp = clampNumber(parsed.maxHp, fallback.maxHp, 1, 999999);
    return {
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 60) : fallback.name,
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle.slice(0, 120) : fallback.subtitle,
      maxHp,
      currentHp: clampNumber(parsed.currentHp, maxHp, 0, maxHp),
      shield: clampNumber(parsed.shield, fallback.shield, 0, 999999),
      phase: clampNumber(parsed.phase, fallback.phase, 1, 99),
      visible: typeof parsed.visible === "boolean" ? parsed.visible : fallback.visible,
      enraged: typeof parsed.enraged === "boolean" ? parsed.enraged : fallback.enraged,
      color: typeof parsed.color === "string" && parsed.color.trim() ? parsed.color : fallback.color,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

function writeBossFight(input: Partial<BossFightState>): BossFightState {
  const current = readBossFight();
  const maxHp = clampNumber(input.maxHp ?? current.maxHp, current.maxHp, 1, 999999);
  const next: BossFightState = {
    ...current,
    ...input,
    name: String(input.name ?? current.name).slice(0, 60),
    subtitle: String(input.subtitle ?? current.subtitle).slice(0, 120),
    maxHp,
    currentHp: clampNumber(input.currentHp ?? current.currentHp, current.currentHp, 0, maxHp),
    shield: clampNumber(input.shield ?? current.shield, current.shield, 0, 999999),
    phase: clampNumber(input.phase ?? current.phase, current.phase, 1, 99),
    visible: typeof input.visible === "boolean" ? input.visible : current.visible,
    enraged: typeof input.enraged === "boolean" ? input.enraged : current.enraged,
    color: String(input.color ?? current.color),
    updatedAt: new Date().toISOString(),
  };
  setSetting(SETTING_KEY, JSON.stringify(next));
  return next;
}

export const registerBossFightRoutes: RouteModule = (app) => {
  app.get("/api/boss-fight", async () => readBossFight());

  app.put("/api/boss-fight", async (req, reply) => {
    const body = parseBody(reply, BossFightUpdateBodySchema, req.body);
    return body ? writeBossFight(body) : undefined;
  });

  app.post("/api/boss-fight/reset", async () => writeBossFight(defaultBossFight()));

  app.post("/api/boss-fight/damage", async (req, reply) => {
    const body = parseBody(reply, AmountBodySchema.partial(), req.body);
    if (!body) return;
    const { amount } = body;
    const state = readBossFight();
    const damage = clampNumber(amount, 0, 0, 999999);
    const shieldDamage = Math.min(state.shield, damage);
    const hpDamage = damage - shieldDamage;
    return writeBossFight({
      ...state,
      shield: state.shield - shieldDamage,
      currentHp: state.currentHp - hpDamage,
    });
  });

  app.post("/api/boss-fight/heal", async (req, reply) => {
    const body = parseBody(reply, AmountBodySchema.partial(), req.body);
    if (!body) return;
    const { amount } = body;
    const state = readBossFight();
    return writeBossFight({
      ...state,
      currentHp: state.currentHp + clampNumber(amount, 0, 0, 999999),
    });
  });
};
