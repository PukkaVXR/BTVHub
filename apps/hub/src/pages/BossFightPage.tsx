import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, type BossFightState } from "../api";
import { useToast } from "../hooks/useToast";
import { overlayUrl } from "../lib/serverUrls";
import { Button, Card, CardHeader, CopyField, EmptyState, PageHeader, StatusPill } from "../ui";

const OVERLAY_URL = overlayUrl("/o/boss-fight.html");
const QUICK_AMOUNTS = [10, 25, 50, 100];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export default function BossFightPage() {
  const toast = useToast();
  const [boss, setBoss] = useState<BossFightState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setBoss(await api.bossFight());
  };

  useEffect(() => {
    void load();
  }, []);

  const hpPercent = useMemo(() => {
    if (!boss) return 0;
    return Math.round((boss.currentHp / Math.max(1, boss.maxHp)) * 100);
  }, [boss]);

  const save = async (next: BossFightState, message = "Boss fight updated") => {
    setBoss(next);
    setSaving(true);
    try {
      const saved = await api.saveBossFight(next);
      setBoss(saved);
      toast({ message, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not save boss fight", tone: "error" });
      void load();
    } finally {
      setSaving(false);
    }
  };

  const patch = (patch: Partial<BossFightState>, message?: string) => {
    if (!boss) return;
    const maxHp = clampNumber(Number(patch.maxHp ?? boss.maxHp), 1, 999999);
    void save(
      {
        ...boss,
        ...patch,
        maxHp,
        currentHp: clampNumber(Number(patch.currentHp ?? boss.currentHp), 0, maxHp),
        shield: clampNumber(Number(patch.shield ?? boss.shield), 0, 999999),
        phase: clampNumber(Number(patch.phase ?? boss.phase), 1, 99),
      },
      message,
    );
  };

  const damage = async (amount: number) => {
    setSaving(true);
    try {
      setBoss(await api.damageBossFight(amount));
      toast({ message: `Boss took ${amount} damage`, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not damage boss", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const heal = async (amount: number) => {
    setSaving(true);
    try {
      setBoss(await api.healBossFight(amount));
      toast({ message: `Boss healed ${amount} HP`, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not heal boss", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      setBoss(await api.resetBossFight());
      toast({ message: "Boss fight reset", tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not reset boss fight", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Boss Fight"
        description="Run a live stream boss with HP, shield, phases, enrage mode, and an OBS browser-source health bar."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {!boss ? (
        <EmptyState title="Loading boss fight" description="Fetching the current boss state." />
      ) : (
        <div className="boss-page">
          <Card hideableId="obs-source" hideableTitle="OBS Browser Source">
            <CardHeader
              title="OBS Browser Source"
              description="Add this URL as a browser source in OBS. The boss bar updates automatically as HP changes."
              action={<StatusPill tone={boss.currentHp <= 0 ? "danger" : boss.enraged ? "warning" : "success"} label={boss.currentHp <= 0 ? "Defeated" : boss.enraged ? "Enraged" : "Active"} detail={`${hpPercent}% HP`} />}
            />
            <CopyField label="Boss fight overlay URL" value={OVERLAY_URL} />
          </Card>

          <Card hideableId="boss-setup" hideableTitle="Boss Setup">
            <CardHeader
              title="Boss Setup"
              description="Tune the identity, stats, and stream visibility."
              action={
                <Button type="button" variant={boss.visible ? "secondary" : "primary"} size="sm" loading={saving} onClick={() => patch({ visible: !boss.visible }, boss.visible ? "Boss hidden" : "Boss shown")}>
                  {boss.visible ? "Hide on stream" : "Show on stream"}
                </Button>
              }
            />
            <div className="boss-form-grid">
              <label>
                Boss name
                <input value={boss.name} onChange={(event) => patch({ name: event.target.value })} />
              </label>
              <label>
                Subtitle
                <input value={boss.subtitle} onChange={(event) => patch({ subtitle: event.target.value })} />
              </label>
              <label>
                Colour
                <input type="color" value={boss.color} onChange={(event) => patch({ color: event.target.value })} />
              </label>
            </div>
          </Card>

          <Card hideableId="health-controls" hideableTitle="Health Controls">
            <CardHeader title="Health Controls" description="Apply damage, healing, shields, and phase changes while live." />
            <div className="boss-control-grid">
              <section className="boss-panel" style={{ "--boss-color": boss.color } as CSSProperties}>
                <div className="boss-health-meter">
                  <span style={{ width: `${hpPercent}%` }} />
                  <strong>{boss.currentHp} / {boss.maxHp} HP</strong>
                </div>

                <div className="boss-quick-grid">
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button key={amount} type="button" variant="danger" size="sm" loading={saving} onClick={() => void damage(amount)}>
                      -{amount}
                    </Button>
                  ))}
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button key={`heal-${amount}`} type="button" variant="secondary" size="sm" loading={saving} onClick={() => void heal(amount)}>
                      +{amount}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="boss-fields">
                <label>
                  Current HP
                  <input type="number" min={0} max={boss.maxHp} value={boss.currentHp} onChange={(event) => patch({ currentHp: Number(event.target.value) })} />
                </label>
                <label>
                  Max HP
                  <input type="number" min={1} max={999999} value={boss.maxHp} onChange={(event) => patch({ maxHp: Number(event.target.value), currentHp: Number(event.target.value) })} />
                </label>
                <label>
                  Shield
                  <input type="number" min={0} max={999999} value={boss.shield} onChange={(event) => patch({ shield: Number(event.target.value) })} />
                </label>
                <label>
                  Phase
                  <input type="number" min={1} max={99} value={boss.phase} onChange={(event) => patch({ phase: Number(event.target.value) })} />
                </label>
              </section>
            </div>
            <div className="boss-action-row">
              <Button type="button" variant={boss.enraged ? "primary" : "secondary"} loading={saving} onClick={() => patch({ enraged: !boss.enraged }, boss.enraged ? "Enrage disabled" : "Boss enraged")}>
                {boss.enraged ? "Disable enrage" : "Enable enrage"}
              </Button>
              <Button type="button" variant="secondary" loading={saving} onClick={() => patch({ currentHp: boss.maxHp }, "Boss restored")}>
                Restore HP
              </Button>
              <Button type="button" variant="danger" loading={saving} onClick={() => void reset()}>
                Reset boss
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
