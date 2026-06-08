import { useEffect, useMemo, useState } from "react";
import type { Effect } from "@btv/shared";
import SoundPicker from "../components/SoundPicker";
import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

type SoundboardTrigger = "manual" | "chat_command" | "channel_points";

const emptySoundboardEffect = (): Effect => ({
  id: `sound-${Date.now()}`,
  name: "New Sound",
  type: "soundboard",
  triggerType: "manual",
  triggerConfig: {},
  effectConfig: { soundAsset: "", loop: false, durationMs: 0, volume: 1 },
  cooldownMs: 5000,
  enabled: true,
});

function soundAsset(effect: Effect): string {
  return String(effect.effectConfig.soundAsset ?? effect.effectConfig.soundUrl ?? "").replace(/^\/assets\//, "");
}

function soundDetail(effect: Effect): string {
  const source = soundAsset(effect).replace(/^sounds\//, "") || "No sound selected";
  const details = [source];
  if (effect.effectConfig.loop) details.push("loop");
  const durationMs = Number(effect.effectConfig.durationMs ?? 0);
  if (durationMs > 0) details.push(`${Math.round(durationMs / 100) / 10}s`);
  return details.join(" - ");
}

export default function SoundboardPage() {
  const toast = useToast();
  const [effects, setEffects] = useState<Effect[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const items = await api.effects();
    const sounds = items
      .filter((effect) => effect.type === "soundboard")
      .sort((a, b) => a.name.localeCompare(b.name));
    setEffects(sounds);
    if (!editingId && sounds[0]) setEditingId(sounds[0].id);
  };

  useEffect(() => {
    void load();
  }, []);

  const editing = useMemo(() => effects.find((effect) => effect.id === editingId) ?? null, [editingId, effects]);

  const updateLocal = (effect: Effect) => {
    setEffects((prev) => [...prev.filter((item) => item.id !== effect.id), effect].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const save = async (effect: Effect, message = "Sound saved") => {
    setSavingId(effect.id);
    try {
      await api.saveEffect(effect);
      updateLocal(effect);
      toast({ message, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not save sound", tone: "error" });
      void load();
    } finally {
      setSavingId(null);
    }
  };

  const patchEditing = (patch: Partial<Effect>, effectConfig?: Record<string, unknown>, triggerConfig?: Record<string, unknown>) => {
    if (!editing) return;
    const next: Effect = {
      ...editing,
      ...patch,
      effectConfig: { ...editing.effectConfig, ...effectConfig },
      triggerConfig: { ...editing.triggerConfig, ...triggerConfig },
    };
    updateLocal(next);
  };

  const addSound = () => {
    const effect = emptySoundboardEffect();
    setEffects((prev) => [effect, ...prev]);
    setEditingId(effect.id);
  };

  const removeSound = async (effect: Effect) => {
    if (!window.confirm(`Delete soundboard button "${effect.name}"?`)) return;
    setSavingId(effect.id);
    try {
      await api.deleteEffect(effect.id);
      toast({ message: "Soundboard button deleted", tone: "success" });
      setEffects((prev) => prev.filter((item) => item.id !== effect.id));
      if (editingId === effect.id) setEditingId(null);
      void load();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not delete sound", tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const fire = async (effect: Effect) => {
    setSavingId(effect.id);
    try {
      const res = await api.fireEffect(effect.id);
      toast({ message: res.ok ? `Played ${effect.name}` : res.message, tone: res.ok ? "success" : "error" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not play sound", tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const stopSounds = async () => {
    setSavingId("stop");
    try {
      const res = await api.emergencyAction("stop-sounds");
      toast({ message: res.ok ? res.title : res.message, tone: res.ok ? "success" : "error" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not stop sounds", tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Soundboard"
        description="Create and test reusable sound buttons for Mobile Control, Stream Deck, chat commands, and channel point triggers."
        action={
          <div className="soundboard-header-actions">
            <Button type="button" variant="secondary" size="sm" loading={savingId === "stop"} onClick={() => void stopSounds()}>
              Stop sounds
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={addSound}>
              New sound
            </Button>
          </div>
        }
      />

      <div className="soundboard-page">
        <Card hideableId="buttons" hideableTitle="Buttons">
          <CardHeader title="Buttons" description="These are soundboard effects. They can be fired manually or attached to chat and channel points." />
          {effects.length ? (
            <div className="soundboard-list">
              {effects.map((effect) => (
                <button
                  type="button"
                  key={effect.id}
                  className={`soundboard-list-item${effect.id === editingId ? " active" : ""}`}
                  onClick={() => setEditingId(effect.id)}
                >
                  <strong>{effect.name}</strong>
                  <span>{soundDetail(effect)}</span>
                  <StatusPill tone={effect.enabled ? "success" : "neutral"} label={effect.enabled ? "Enabled" : "Disabled"} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No soundboard buttons yet" description="Create a sound, upload or choose an audio asset, then test it live." />
          )}
        </Card>

        <Card hideableId="edit-sound" hideableTitle="Edit Sound">
          {editing ? (
            <>
              <CardHeader
                title="Edit Sound"
                description="Configure the sound, trigger, loop behaviour, and cooldown."
                action={
                  <div className="soundboard-header-actions">
                    <Button type="button" variant="secondary" size="sm" loading={savingId === editing.id} disabled={!soundAsset(editing)} onClick={() => void fire(editing)}>
                      Test play
                    </Button>
                    <Button type="button" variant="primary" size="sm" loading={savingId === editing.id} onClick={() => void save(editing)}>
                      Save
                    </Button>
                  </div>
                }
              />

              <div className="soundboard-editor">
                <label>
                  Button name
                  <input value={editing.name} onChange={(event) => patchEditing({ name: event.target.value })} />
                </label>
                <label>
                  Enabled
                  <select value={editing.enabled ? "yes" : "no"} onChange={(event) => patchEditing({ enabled: event.target.value === "yes" })}>
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </label>

                <div className="soundboard-editor__wide">
                  <label>Sound file</label>
                  <SoundPicker
                    value={soundAsset(editing)}
                    onChange={(path) => patchEditing({}, { soundAsset: path, soundUrl: `/assets/${path}` })}
                  />
                </div>

                <label>
                  Trigger
                  <select
                    value={editing.triggerType as SoundboardTrigger}
                    onChange={(event) => {
                      const trigger = event.target.value as SoundboardTrigger;
                      patchEditing(
                        { triggerType: trigger },
                        {},
                        trigger === "chat_command"
                          ? { command: "!sound", matchMode: "startsWith" }
                          : trigger === "channel_points"
                            ? { rewardTitle: "", matchMode: "exact" }
                            : {},
                      );
                    }}
                  >
                    <option value="manual">Manual only</option>
                    <option value="chat_command">Chat command</option>
                    <option value="channel_points">Channel points</option>
                  </select>
                </label>

                {editing.triggerType === "chat_command" && (
                  <label>
                    Chat command
                    <input
                      value={String(editing.triggerConfig.command ?? "")}
                      onChange={(event) => patchEditing({}, {}, { command: event.target.value })}
                      placeholder="!airhorn"
                    />
                  </label>
                )}

                {editing.triggerType === "channel_points" && (
                  <label>
                    Reward title
                    <input
                      value={String(editing.triggerConfig.rewardTitle ?? "")}
                      onChange={(event) => patchEditing({}, {}, { rewardTitle: event.target.value })}
                      placeholder="Exact Twitch reward title"
                    />
                  </label>
                )}

                <label>
                  Cooldown (ms)
                  <input type="number" min={0} value={editing.cooldownMs} onChange={(event) => patchEditing({ cooldownMs: Number(event.target.value) })} />
                </label>
                <label>
                  Duration (ms, 0 = until end)
                  <input type="number" min={0} value={Number(editing.effectConfig.durationMs ?? 0)} onChange={(event) => patchEditing({}, { durationMs: Number(event.target.value) })} />
                </label>
                <label>
                  Volume
                  <input type="range" min={0} max={1} step={0.05} value={Number(editing.effectConfig.volume ?? 1)} onChange={(event) => patchEditing({}, { volume: Number(event.target.value) })} />
                </label>
                <label>
                  Loop
                  <select value={editing.effectConfig.loop ? "yes" : "no"} onChange={(event) => patchEditing({}, { loop: event.target.value === "yes" })}>
                    <option value="no">Play once</option>
                    <option value="yes">Loop</option>
                  </select>
                </label>
              </div>

              <div className="soundboard-footer-actions">
                <Button type="button" variant="danger" loading={savingId === editing.id} onClick={() => void removeSound(editing)}>
                  Delete button
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="Select a sound" description="Choose a soundboard button from the list, or create a new one." />
          )}
        </Card>
      </div>
    </>
  );
}
