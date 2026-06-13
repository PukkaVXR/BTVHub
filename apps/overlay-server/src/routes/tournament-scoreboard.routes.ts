import { getSetting, setSetting } from "../db.js";
import { parseBody, TournamentScoreboardUpdateBodySchema } from "../schemas/request.schema.js";
import type { RouteModule } from "./types.js";

interface TournamentScoreboardTeam {
  id: string;
  name: string;
  score: number;
  color: string;
}

interface TournamentScoreboardState {
  title: string;
  subtitle: string;
  bestOf: number;
  visible: boolean;
  teams: TournamentScoreboardTeam[];
  updatedAt: string;
}

const SETTING_KEY = "tournament_scoreboard";

function defaultScoreboard(): TournamentScoreboardState {
  return {
    title: "Tournament Match",
    subtitle: "Winners bracket",
    bestOf: 3,
    visible: true,
    teams: [
      { id: "team-a", name: "Team A", score: 0, color: "#5b8cff" },
      { id: "team-b", name: "Team B", score: 0, color: "#ff5a67" },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function readScoreboard(): TournamentScoreboardState {
  const raw = getSetting(SETTING_KEY);
  if (!raw) return defaultScoreboard();
  try {
    const parsed = JSON.parse(raw) as Partial<TournamentScoreboardState>;
    const fallback = defaultScoreboard();
    return {
      title: typeof parsed.title === "string" ? parsed.title : fallback.title,
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : fallback.subtitle,
      bestOf: Number.isFinite(parsed.bestOf) ? Math.max(1, Math.min(99, Number(parsed.bestOf))) : fallback.bestOf,
      visible: typeof parsed.visible === "boolean" ? parsed.visible : fallback.visible,
      teams: Array.isArray(parsed.teams) && parsed.teams.length >= 2
        ? parsed.teams.slice(0, 2).map((team, index) => ({
            id: typeof team.id === "string" ? team.id : `team-${index + 1}`,
            name: typeof team.name === "string" ? team.name : `Team ${index + 1}`,
            score: Number.isFinite(team.score) ? Math.max(0, Number(team.score)) : 0,
            color: typeof team.color === "string" ? team.color : fallback.teams[index]?.color ?? "#5b8cff",
          }))
        : fallback.teams,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return defaultScoreboard();
  }
}

function writeScoreboard(input: Partial<TournamentScoreboardState>): TournamentScoreboardState {
  const current = readScoreboard();
  const next: TournamentScoreboardState = {
    ...current,
    ...input,
    bestOf: Math.max(1, Math.min(99, Number(input.bestOf ?? current.bestOf))),
    teams: Array.isArray(input.teams) && input.teams.length >= 2
      ? input.teams.slice(0, 2).map((team, index) => ({
          id: team.id || current.teams[index]?.id || `team-${index + 1}`,
          name: String(team.name ?? current.teams[index]?.name ?? `Team ${index + 1}`).slice(0, 48),
          score: Math.max(0, Number(team.score ?? current.teams[index]?.score ?? 0)),
          color: String(team.color ?? current.teams[index]?.color ?? "#5b8cff"),
        }))
      : current.teams,
    updatedAt: new Date().toISOString(),
  };
  setSetting(SETTING_KEY, JSON.stringify(next));
  return next;
}

export const registerTournamentScoreboardRoutes: RouteModule = (app) => {
  app.get("/api/tournament-scoreboard", async () => readScoreboard());

  app.put("/api/tournament-scoreboard", async (req, reply) => {
    const body = parseBody(reply, TournamentScoreboardUpdateBodySchema, req.body);
    return body ? writeScoreboard(body) : undefined;
  });

  app.post("/api/tournament-scoreboard/reset", async () => {
    const current = readScoreboard();
    return writeScoreboard({
      ...current,
      teams: current.teams.map((team) => ({ ...team, score: 0 })),
    });
  });
};
