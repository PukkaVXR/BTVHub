import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, type ChatChaosState } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, Card, CardHeader, CopyField, EmptyState, PageHeader, StatusPill } from "../ui";

const OVERLAY_URL = "http://127.0.0.1:4782/o/chat-chaos.html";
const QUICK_AMOUNTS = [5, 10, 25, 50];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function statusTone(status: ChatChaosState["status"]): "neutral" | "info" | "warning" | "danger" {
  if (status === "meltdown") return "danger";
  if (status === "chaotic") return "warning";
  if (status === "building") return "info";
  return "neutral";
}

function statusLabel(status: ChatChaosState["status"]): string {
  if (status === "meltdown") return "Meltdown";
  if (status === "chaotic") return "Chaotic";
  if (status === "building") return "Building";
  return "Calm";
}

export default function ChatChaosPage() {
  const toast = useToast();
  const [chaos, setChaos] = useState<ChatChaosState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setChaos(await api.chatChaos());
  };

  useEffect(() => {
    void load();
  }, []);

  const percent = useMemo(() => {
    if (!chaos) return 0;
    return Math.round((chaos.level / Math.max(1, chaos.threshold)) * 100);
  }, [chaos]);

  const save = async (next: ChatChaosState, message = "Chaos meter updated") => {
    setChaos(next);
    setSaving(true);
    try {
      const saved = await api.saveChatChaos(next);
      setChaos(saved);
      toast({ message, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not save chaos meter", tone: "error" });
      void load();
    } finally {
      setSaving(false);
    }
  };

  const patch = (patch: Partial<ChatChaosState>, message?: string) => {
    if (!chaos) return;
    const threshold = clampNumber(Number(patch.threshold ?? chaos.threshold), 1, 9999);
    void save(
      {
        ...chaos,
        ...patch,
        threshold,
        level: clampNumber(Number(patch.level ?? chaos.level), 0, threshold),
        decayPerMinute: clampNumber(Number(patch.decayPerMinute ?? chaos.decayPerMinute), 0, 999),
      },
      message,
    );
  };

  const adjust = async (amount: number) => {
    setSaving(true);
    try {
      setChaos(await api.adjustChatChaos(amount));
      toast({ message: amount > 0 ? `Chaos increased by ${amount}` : `Chaos reduced by ${Math.abs(amount)}`, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not adjust chaos", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      setChaos(await api.resetChatChaos());
      toast({ message: "Chaos meter reset", tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not reset chaos meter", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Chat Chaos"
        description="Control a live chat energy meter for hype moments, escalating reactions, and future chat-triggered chaos."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {!chaos ? (
        <EmptyState title="Loading chaos meter" description="Fetching the current meter state." />
      ) : (
        <div className="chaos-page">
          <Card hideableId="obs-source" hideableTitle="OBS Browser Source">
            <CardHeader
              title="OBS Browser Source"
              description="Add this URL as a browser source in OBS. The meter updates automatically as chaos changes."
              action={<StatusPill tone={statusTone(chaos.status)} label={statusLabel(chaos.status)} detail={`${percent}%`} />}
            />
            <CopyField label="Chat chaos overlay URL" value={OVERLAY_URL} />
          </Card>

          <Card hideableId="meter-setup" hideableTitle="Meter Setup">
            <CardHeader
              title="Meter Setup"
              description="Set the on-stream copy, maximum threshold, and decay rate for future automation."
              action={
                <Button type="button" variant={chaos.visible ? "secondary" : "primary"} size="sm" loading={saving} onClick={() => patch({ visible: !chaos.visible }, chaos.visible ? "Chaos meter hidden" : "Chaos meter shown")}>
                  {chaos.visible ? "Hide on stream" : "Show on stream"}
                </Button>
              }
            />
            <div className="chaos-form-grid">
              <label>
                Meter title
                <input value={chaos.title} onChange={(event) => patch({ title: event.target.value })} />
              </label>
              <label>
                Subtitle
                <input value={chaos.subtitle} onChange={(event) => patch({ subtitle: event.target.value })} />
              </label>
              <label>
                Colour
                <input type="color" value={chaos.color} onChange={(event) => patch({ color: event.target.value })} />
              </label>
            </div>
          </Card>

          <Card hideableId="live-controls" hideableTitle="Live Controls">
            <CardHeader title="Live Controls" description="Raise or lower the meter while live, or tune exact values for testing." />
            <div className="chaos-control-grid">
              <section className="chaos-panel" style={{ "--chaos-color": chaos.color } as CSSProperties}>
                <div className="chaos-live-meter">
                  <span style={{ width: `${percent}%` }} />
                  <strong>{chaos.level} / {chaos.threshold}</strong>
                </div>
                <div className="chaos-quick-grid">
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button key={amount} type="button" variant="primary" size="sm" loading={saving} onClick={() => void adjust(amount)}>
                      +{amount}
                    </Button>
                  ))}
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button key={`down-${amount}`} type="button" variant="secondary" size="sm" loading={saving} onClick={() => void adjust(-amount)}>
                      -{amount}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="chaos-fields">
                <label>
                  Current level
                  <input type="number" min={0} max={chaos.threshold} value={chaos.level} onChange={(event) => patch({ level: Number(event.target.value) })} />
                </label>
                <label>
                  Threshold
                  <input type="number" min={1} max={9999} value={chaos.threshold} onChange={(event) => patch({ threshold: Number(event.target.value) })} />
                </label>
                <label>
                  Decay per minute
                  <input type="number" min={0} max={999} value={chaos.decayPerMinute} onChange={(event) => patch({ decayPerMinute: Number(event.target.value) })} />
                </label>
              </section>
            </div>
            <div className="chaos-action-row">
              <Button type="button" variant="secondary" loading={saving} onClick={() => patch({ level: chaos.threshold }, "Chaos maxed")}>
                Max chaos
              </Button>
              <Button type="button" variant="secondary" loading={saving} onClick={() => patch({ level: 0 }, "Chaos calmed")}>
                Calm down
              </Button>
              <Button type="button" variant="danger" loading={saving} onClick={() => void reset()}>
                Reset meter
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
