import type { MiniGameRun } from "../../api";
import { Card, CardHeader, EmptyState, StatusPill } from "../../ui";

type CommandsMiniGamesPanelProps = {
  runs: MiniGameRun[];
};

function diceResultLabel(run: MiniGameRun): string {
  const playerRoll = Number(run.result.playerRoll ?? 0);
  const btvRoll = Number(run.result.btvRoll ?? 0);
  if (playerRoll && btvRoll) return `Dice: ${playerRoll} vs BTV ${btvRoll}`;
  return run.game === "dice" ? "Dice game" : run.game;
}

export function CommandsMiniGamesPanel({ runs }: CommandsMiniGamesPanelProps) {
  return (
    <div className="commands-section">
      <Card hideableId="simple-mini-games" hideableTitle="Simple Mini-Games">
        <CardHeader
          title="Simple mini-games"
          description="Chat can play quick games through BTV commands, with optional loyalty point wagers."
        />
        <div className="commands-editor">
          <div className="commands-loyalty-hero">
            <strong>!dice</strong>
            <span>Roll against BTV</span>
            <small>Use !dice for fun, or !dice 25 to wager 25 loyalty points.</small>
          </div>
          <div className="commands-stats">
            <StatusPill tone="info" label="Alias" detail="!roll" />
            <StatusPill tone="warning" label="Max wager" detail="1000 pts" />
            <StatusPill tone="success" label="Reward" detail="Win wager" />
          </div>
        </div>
      </Card>

      <Card hideableId="recent-mini-game-results" hideableTitle="Recent Mini-Game Results">
        <CardHeader title="Recent mini-game results" description="A short audit trail for point wagers and chat game activity." />
        {runs.length ? (
          <div className="commands-list">
            {runs.map((run) => (
              <div className="commands-list__item commands-list__item--static" key={run.id}>
                <span>
                  <strong>{run.displayName}</strong>
                  <em>{diceResultLabel(run)}</em>
                  <small>{new Date(run.createdAt).toLocaleString()}</small>
                </span>
                <div className="commands-list__status">
                  <StatusPill tone={run.outcome === "win" ? "success" : run.outcome === "lose" ? "warning" : "neutral"} label={run.outcome} />
                  {run.wager > 0 ? <StatusPill tone="info" label={`${run.wager} pt wager`} /> : null}
                  {run.pointsDelta !== 0 ? (
                    <StatusPill tone={run.pointsDelta > 0 ? "success" : "warning"} label={`${run.pointsDelta > 0 ? "+" : ""}${run.pointsDelta} pts`} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No mini-games played yet" description="Ask chat to try !dice, then recent rolls will appear here." />
        )}
      </Card>
    </div>
  );
}
