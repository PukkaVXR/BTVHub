import { useEffect, useMemo, useState } from "react";
import { api, type StreamRecap, type StreamSession } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, ButtonAnchor, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function sessionLabel(session: StreamSession): string {
  const started = new Date(session.started_at).toLocaleString();
  return `${session.title} - ${started}${session.ended_at ? "" : " (active)"}`;
}

export default function StreamRecapPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [recap, setRecap] = useState<StreamRecap | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedId) ?? null, [selectedId, sessions]);

  const loadSessions = async () => {
    const result = await api.sessions();
    setSessions(result.sessions);
    if (!selectedId && result.sessions[0]) setSelectedId(result.sessions[0].id);
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const generate = async (id = selectedId) => {
    if (!id) return;
    setLoading(true);
    try {
      setRecap(await api.sessionRecap(id));
      toast({ message: "Stream recap generated", tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not generate recap", tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!recap) return;
    try {
      await navigator.clipboard.writeText(recap.markdown);
      toast({ message: "Recap copied to clipboard", tone: "success" });
    } catch {
      toast({ message: "Could not copy recap", tone: "error" });
    }
  };

  return (
    <>
      <PageHeader
        title="Stream Recaps"
        description="Generate a clean recap from session analytics, event totals, scene spans, and community activity."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadSessions()}>
            Refresh sessions
          </Button>
        }
      />

      <div className="stream-recap-page">
        <Card hideableId="choose-session" hideableTitle="Choose Session">
          <CardHeader
            title="Choose Session"
            description="Pick a completed or active session and generate a reusable recap."
            action={<StatusPill tone="info" label={`${sessions.length}`} detail="sessions" />}
          />
          {sessions.length ? (
            <div className="stream-recap-picker">
              <label>
                Session
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{sessionLabel(session)}</option>
                  ))}
                </select>
              </label>
              <Button type="button" variant="primary" loading={loading} disabled={!selectedId} onClick={() => void generate()}>
                Generate recap
              </Button>
            </div>
          ) : (
            <EmptyState title="No sessions yet" description="Start a stream session from the dashboard, then events will be available for recap generation." />
          )}
        </Card>

        {recap && recap.summary.session ? (
          <>
            <Card hideableId="recap-summary" hideableTitle="Recap Summary">
              <CardHeader
                title={recap.summary.session.title}
                description={`Generated ${new Date(recap.generatedAt).toLocaleString()}`}
                action={
                  <div className="stream-recap-actions">
                    <Button type="button" variant="secondary" size="sm" onClick={() => void copyMarkdown()}>
                      Copy markdown
                    </Button>
                    <ButtonAnchor variant="primary" size="sm" href={`/api/sessions/${encodeURIComponent(recap.summary.session.id)}/recap.md`}>
                      Download .md
                    </ButtonAnchor>
                  </div>
                }
              />
              <div className="stream-recap-stat-grid">
                <RecapStat label="Duration" value={formatDuration(recap.summary.durationMs)} />
                <RecapStat label="Events" value={recap.summary.totals.events} />
                <RecapStat label="Follows" value={recap.summary.totals.follows} />
                <RecapStat label="Subs" value={recap.summary.totals.subs} />
                <RecapStat label="Bits" value={recap.summary.totals.cheers} />
                <RecapStat label="Chat" value={recap.summary.totals.chatMessages} />
              </div>
            </Card>

            <div className="stream-recap-grid">
              <Card hideableId="highlights" hideableTitle="Highlights">
                <CardHeader title="Highlights" description="The short version." />
                <ul className="stream-recap-list">
                  {recap.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                </ul>
              </Card>

              <Card hideableId="top-scenes" hideableTitle="Top Scenes">
                <CardHeader title="Top Scenes" description="Longest scene spans." />
                {recap.topScenes.length ? (
                  <ul className="stream-recap-list">
                    {recap.topScenes.map((scene) => <li key={`${scene.sceneName}-${scene.startedAt}`}>{scene.sceneName}: {formatDuration(scene.durationMs)}</li>)}
                  </ul>
                ) : (
                  <EmptyState title="No scenes tracked" description="Scene spans appear once a session has OBS scene changes." />
                )}
              </Card>

              <Card hideableId="community-shoutouts" hideableTitle="Community Shoutouts">
                <CardHeader title="Community Shoutouts" description="Most active named supporters." />
                {recap.supporters.length ? (
                  <ul className="stream-recap-list">
                    {recap.supporters.map((user) => <li key={user.name}>{user.name}: {user.events} events{user.amount ? `, ${user.amount} total amount` : ""}</li>)}
                  </ul>
                ) : (
                  <EmptyState title="No shoutouts yet" description="Named follows, subs, cheers, raids, and chats will appear here." />
                )}
              </Card>
            </div>

            <Card hideableId="markdown-recap" hideableTitle="Markdown Recap">
              <CardHeader title="Markdown Recap" description="Ready for Discord, YouTube descriptions, notes, or stream logs." />
              <textarea className="stream-recap-markdown" value={recap.markdown} readOnly />
            </Card>
          </>
        ) : selectedSession ? (
          <EmptyState title="No recap generated yet" description={`Generate a recap for ${selectedSession.title} when you're ready.`} />
        ) : null}
      </div>
    </>
  );
}

function RecapStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stream-recap-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
