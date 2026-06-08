import { getSetting, setSetting } from "../db.js";
import type { RouteModule } from "./types.js";

interface PredictionOption {
  id: string;
  label: string;
  votes: number;
  color: string;
  isWinner: boolean;
}

interface PredictionState {
  title: string;
  prompt: string;
  status: "draft" | "open" | "locked" | "revealed";
  visible: boolean;
  options: PredictionOption[];
  updatedAt: string;
}

const SETTING_KEY = "prediction_vote_state";

function defaultPrediction(): PredictionState {
  return {
    title: "Prediction",
    prompt: "Who wins this round?",
    status: "draft",
    visible: true,
    options: [
      { id: "option-a", label: "Option A", votes: 0, color: "#5b8cff", isWinner: false },
      { id: "option-b", label: "Option B", votes: 0, color: "#ff5a67", isWinner: false },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeOption(option: Partial<PredictionOption>, index: number, fallback: PredictionOption): PredictionOption {
  return {
    id: typeof option.id === "string" && option.id.trim() ? option.id : fallback.id || `option-${index + 1}`,
    label: typeof option.label === "string" && option.label.trim() ? option.label.slice(0, 48) : fallback.label || `Option ${index + 1}`,
    votes: Number.isFinite(option.votes) ? Math.max(0, Math.min(999999, Math.round(Number(option.votes)))) : fallback.votes,
    color: typeof option.color === "string" && option.color.trim() ? option.color : fallback.color,
    isWinner: Boolean(option.isWinner),
  };
}

function readPrediction(): PredictionState {
  const fallback = defaultPrediction();
  const raw = getSetting(SETTING_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<PredictionState>;
    const options = Array.isArray(parsed.options) && parsed.options.length >= 2
      ? parsed.options.slice(0, 4).map((option, index) => normalizeOption(option, index, fallback.options[index] ?? fallback.options[0]!))
      : fallback.options;
    const status = parsed.status === "open" || parsed.status === "locked" || parsed.status === "revealed" || parsed.status === "draft"
      ? parsed.status
      : fallback.status;
    return {
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 60) : fallback.title,
      prompt: typeof parsed.prompt === "string" ? parsed.prompt.slice(0, 120) : fallback.prompt,
      status,
      visible: typeof parsed.visible === "boolean" ? parsed.visible : fallback.visible,
      options,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

function writePrediction(input: Partial<PredictionState>): PredictionState {
  const current = readPrediction();
  const next: PredictionState = {
    ...current,
    ...input,
    title: String(input.title ?? current.title).slice(0, 60),
    prompt: String(input.prompt ?? current.prompt).slice(0, 120),
    status: input.status === "open" || input.status === "locked" || input.status === "revealed" || input.status === "draft" ? input.status : current.status,
    visible: typeof input.visible === "boolean" ? input.visible : current.visible,
    options: Array.isArray(input.options) && input.options.length >= 2
      ? input.options.slice(0, 4).map((option, index) => normalizeOption(option, index, current.options[index] ?? current.options[0]!))
      : current.options,
    updatedAt: new Date().toISOString(),
  };
  setSetting(SETTING_KEY, JSON.stringify(next));
  return next;
}

export const registerPredictionsRoutes: RouteModule = (app) => {
  app.get("/api/predictions", async () => readPrediction());

  app.put("/api/predictions", async (req) => writePrediction(req.body as Partial<PredictionState>));

  app.post("/api/predictions/reset", async () => writePrediction(defaultPrediction()));

  app.post("/api/predictions/options/:optionId/vote", async (req, reply) => {
    const { optionId } = req.params as { optionId: string };
    const state = readPrediction();
    const optionExists = state.options.some((option) => option.id === optionId);
    if (!optionExists) return reply.code(404).send({ error: "Prediction option not found" });
    return writePrediction({
      ...state,
      options: state.options.map((option) => option.id === optionId ? { ...option, votes: option.votes + 1 } : option),
    });
  });

  app.post("/api/predictions/options/:optionId/winner", async (req, reply) => {
    const { optionId } = req.params as { optionId: string };
    const state = readPrediction();
    const optionExists = state.options.some((option) => option.id === optionId);
    if (!optionExists) return reply.code(404).send({ error: "Prediction option not found" });
    return writePrediction({
      ...state,
      status: "revealed",
      options: state.options.map((option) => ({ ...option, isWinner: option.id === optionId })),
    });
  });
};
