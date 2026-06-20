import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, type PredictionOption, type PredictionState } from "../api";
import { useToast } from "../hooks/useToast";
import { overlayUrl } from "../lib/serverUrls";
import { Button, Card, CardHeader, ControlGrid, CopyField, EmptyState, MeterBar, PageHeader, StatusPill } from "../ui";

const OVERLAY_URL = overlayUrl("/o/prediction.html");

function clampVotes(value: number): number {
  return Math.max(0, Math.min(999999, Math.round(value)));
}

function statusTone(status: PredictionState["status"]): "neutral" | "info" | "warning" | "success" {
  if (status === "open") return "info";
  if (status === "locked") return "warning";
  if (status === "revealed") return "success";
  return "neutral";
}

function statusLabel(status: PredictionState["status"]): string {
  if (status === "open") return "Voting open";
  if (status === "locked") return "Locked";
  if (status === "revealed") return "Winner revealed";
  return "Draft";
}

export default function PredictionVotingPage() {
  const toast = useToast();
  const [prediction, setPrediction] = useState<PredictionState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setPrediction(await api.prediction());
  };

  useEffect(() => {
    void load();
  }, []);

  const totalVotes = useMemo(
    () => prediction?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0,
    [prediction],
  );

  const save = async (next: PredictionState, message = "Prediction updated") => {
    setPrediction(next);
    setSaving(true);
    try {
      const saved = await api.savePrediction(next);
      setPrediction(saved);
      toast({ message, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not save prediction", tone: "error" });
      void load();
    } finally {
      setSaving(false);
    }
  };

  const patch = (patch: Partial<PredictionState>, message?: string) => {
    if (!prediction) return;
    void save({ ...prediction, ...patch }, message);
  };

  const updateOption = (optionId: string, patch: Partial<PredictionOption>, message?: string) => {
    if (!prediction) return;
    void save(
      {
        ...prediction,
        options: prediction.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option)),
      },
      message,
    );
  };

  const adjustVotes = (option: PredictionOption, amount: number) => {
    updateOption(option.id, { votes: clampVotes(option.votes + amount) }, `${option.label} votes updated`);
  };

  const castVote = async (option: PredictionOption) => {
    setSaving(true);
    try {
      setPrediction(await api.votePredictionOption(option.id));
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not add vote", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const revealWinner = async (option: PredictionOption) => {
    setSaving(true);
    try {
      setPrediction(await api.revealPredictionWinner(option.id));
      toast({ message: `${option.label} revealed as winner`, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not reveal winner", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      setPrediction(await api.resetPrediction());
      toast({ message: "Prediction reset", tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not reset prediction", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Predictions"
        description="Run a lightweight stream prediction or vote with a live OBS browser-source overlay."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {!prediction ? (
        <EmptyState title="Loading prediction" description="Fetching the current voting state." />
      ) : (
        <div className="prediction-page">
          <Card hideableId="obs-source" hideableTitle="OBS Browser Source">
            <CardHeader
              title="OBS Browser Source"
              description="Add this URL as a browser source in OBS. The overlay updates automatically as votes change."
              action={
                <StatusPill
                  tone={statusTone(prediction.status)}
                  label={statusLabel(prediction.status)}
                  detail={`${totalVotes} votes`}
                />
              }
            />
            <CopyField label="Prediction overlay URL" value={OVERLAY_URL} />
          </Card>

          <Card hideableId="prediction-setup" hideableTitle="Prediction Setup">
            <CardHeader
              title="Prediction Setup"
              description="Set the copy, visibility, and live state."
              action={
                <Button
                  type="button"
                  variant={prediction.visible ? "secondary" : "primary"}
                  size="sm"
                  loading={saving}
                  onClick={() =>
                    patch(
                      { visible: !prediction.visible },
                      prediction.visible ? "Prediction hidden" : "Prediction shown",
                    )
                  }
                >
                  {prediction.visible ? "Hide on stream" : "Show on stream"}
                </Button>
              }
            />
            <div className="prediction-form-grid">
              <label>
                Overlay title
                <input value={prediction.title} onChange={(event) => patch({ title: event.target.value })} />
              </label>
              <label>
                Question
                <input value={prediction.prompt} onChange={(event) => patch({ prompt: event.target.value })} />
              </label>
            </div>
            <div className="prediction-action-row">
              <Button
                type="button"
                variant={prediction.status === "open" ? "primary" : "secondary"}
                loading={saving}
                onClick={() => patch({ status: "open" }, "Voting opened")}
              >
                Open voting
              </Button>
              <Button
                type="button"
                variant={prediction.status === "locked" ? "primary" : "secondary"}
                loading={saving}
                onClick={() => patch({ status: "locked" }, "Voting locked")}
              >
                Lock voting
              </Button>
              <Button type="button" variant="danger" loading={saving} onClick={() => void reset()}>
                Reset prediction
              </Button>
            </div>
          </Card>

          <Card hideableId="options-votes" hideableTitle="Options And Votes">
            <CardHeader
              title="Options And Votes"
              description="Tune option names and colours, add manual votes, then reveal a winner when ready."
            />
            <div className="prediction-option-grid">
              {prediction.options.map((option) => {
                const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                return (
                  <section
                    className="prediction-option-card"
                    key={option.id}
                    style={{ "--prediction-color": option.color } as CSSProperties}
                  >
                    <div className="prediction-option-card__header">
                      <label>
                        Option label
                        <input
                          value={option.label}
                          onChange={(event) => updateOption(option.id, { label: event.target.value })}
                        />
                      </label>
                      <label>
                        Colour
                        <input
                          type="color"
                          value={option.color}
                          onChange={(event) => updateOption(option.id, { color: event.target.value })}
                        />
                      </label>
                    </div>

                    <MeterBar
                      className="prediction-vote-meter"
                      value={percent}
                      tone={option.isWinner ? "success" : "info"}
                      trackLabel={`${percent}%`}
                      aria-label={`${option.label} has ${percent}% of votes`}
                    />

                    <ControlGrid className="prediction-vote-control">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={saving}
                        onClick={() => adjustVotes(option, -1)}
                      >
                        -1
                      </Button>
                      <strong>{option.votes}</strong>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={saving}
                        onClick={() => void castVote(option)}
                      >
                        +1 vote
                      </Button>
                    </ControlGrid>

                    <Button
                      type="button"
                      variant={option.isWinner ? "primary" : "secondary"}
                      loading={saving}
                      onClick={() => void revealWinner(option)}
                    >
                      {option.isWinner ? "Winner selected" : "Reveal as winner"}
                    </Button>
                  </section>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
