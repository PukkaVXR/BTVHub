import { useEffect, useState, type CSSProperties } from "react";
import { api, type TournamentScoreboardState, type TournamentScoreboardTeam } from "../api";
import { useToast } from "../hooks/useToast";
import { overlayUrl } from "../lib/serverUrls";
import { Button, Card, CardHeader, ControlGrid, CopyField, EmptyState, PageHeader } from "../ui";

const OVERLAY_URL = overlayUrl("/o/tournament-scoreboard.html");

function clampScore(value: number): number {
  return Math.max(0, Math.min(999, value));
}

export default function TournamentScoreboardPage() {
  const toast = useToast();
  const [scoreboard, setScoreboard] = useState<TournamentScoreboardState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setScoreboard(await api.tournamentScoreboard());
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (next: TournamentScoreboardState, message = "Scoreboard updated") => {
    setScoreboard(next);
    setSaving(true);
    try {
      const saved = await api.saveTournamentScoreboard(next);
      setScoreboard(saved);
      toast({ message, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not save scoreboard", tone: "error" });
      void load();
    } finally {
      setSaving(false);
    }
  };

  const patch = (patch: Partial<TournamentScoreboardState>, message?: string) => {
    if (!scoreboard) return;
    void save({ ...scoreboard, ...patch }, message);
  };

  const updateTeam = (teamId: string, patch: Partial<TournamentScoreboardTeam>, message?: string) => {
    if (!scoreboard) return;
    patchScoreboardTeams(
      scoreboard.teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team)),
      message,
    );
  };

  const patchScoreboardTeams = (teams: TournamentScoreboardTeam[], message?: string) => {
    if (!scoreboard) return;
    void save({ ...scoreboard, teams }, message);
  };

  const adjustScore = (team: TournamentScoreboardTeam, amount: number) => {
    updateTeam(
      team.id,
      { score: clampScore(team.score + amount) },
      `${team.name} score ${amount > 0 ? "increased" : "decreased"}`,
    );
  };

  const swapTeams = () => {
    if (!scoreboard) return;
    patchScoreboardTeams([scoreboard.teams[1]!, scoreboard.teams[0]!], "Teams swapped");
  };

  const resetScores = async () => {
    setSaving(true);
    try {
      setScoreboard(await api.resetTournamentScoreboard());
      toast({ message: "Scores reset", tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not reset scores", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Tournament Scoreboard"
        description="A lightweight live match scoreboard with OBS browser-source output."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {!scoreboard ? (
        <EmptyState title="Loading scoreboard" description="Fetching the current match state." />
      ) : (
        <div className="tournament-page">
          <Card hideableId="obs-source" hideableTitle="OBS Browser Source">
            <CardHeader
              title="OBS Browser Source"
              description="Add this URL as a browser source in OBS. It updates automatically while this page changes scores."
            />
            <CopyField label="Tournament scoreboard URL" value={OVERLAY_URL} />
          </Card>

          <Card hideableId="match-setup" hideableTitle="Match Setup">
            <CardHeader
              title="Match Setup"
              description="Set the title, match type, and whether the scoreboard should be visible on stream."
              action={
                <Button
                  type="button"
                  variant={scoreboard.visible ? "secondary" : "primary"}
                  size="sm"
                  loading={saving}
                  onClick={() =>
                    patch(
                      { visible: !scoreboard.visible },
                      scoreboard.visible ? "Scoreboard hidden" : "Scoreboard shown",
                    )
                  }
                >
                  {scoreboard.visible ? "Hide on stream" : "Show on stream"}
                </Button>
              }
            />
            <div className="tournament-form-grid">
              <label>
                Match title
                <input value={scoreboard.title} onChange={(event) => patch({ title: event.target.value })} />
              </label>
              <label>
                Subtitle
                <input value={scoreboard.subtitle} onChange={(event) => patch({ subtitle: event.target.value })} />
              </label>
              <label>
                Best of
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={scoreboard.bestOf}
                  onChange={(event) => patch({ bestOf: Number(event.target.value) })}
                />
              </label>
            </div>
          </Card>

          <Card hideableId="score-controls" hideableTitle="Score Controls">
            <CardHeader
              title="Score Controls"
              description="Fast controls for live score changes."
              action={
                <div className="tournament-header-actions">
                  <Button type="button" variant="secondary" size="sm" loading={saving} onClick={swapTeams}>
                    Swap sides
                  </Button>
                  <Button type="button" variant="danger" size="sm" loading={saving} onClick={() => void resetScores()}>
                    Reset scores
                  </Button>
                </div>
              }
            />

            <ControlGrid className="tournament-team-grid">
              {scoreboard.teams.map((team) => (
                <section
                  className="tournament-team-card"
                  key={team.id}
                  style={{ "--team-color": team.color } as CSSProperties}
                >
                  <div className="tournament-team-card__header">
                    <label>
                      Team name
                      <input
                        value={team.name}
                        onChange={(event) => updateTeam(team.id, { name: event.target.value })}
                      />
                    </label>
                    <label>
                      Colour
                      <input
                        type="color"
                        value={team.color}
                        onChange={(event) => updateTeam(team.id, { color: event.target.value })}
                      />
                    </label>
                  </div>

                  <ControlGrid className="tournament-score-control">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={saving}
                      onClick={() => adjustScore(team, -1)}
                    >
                      -1
                    </Button>
                    <strong>{team.score}</strong>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={saving}
                      onClick={() => adjustScore(team, 1)}
                    >
                      +1
                    </Button>
                  </ControlGrid>
                </section>
              ))}
            </ControlGrid>
          </Card>
        </div>
      )}
    </>
  );
}
