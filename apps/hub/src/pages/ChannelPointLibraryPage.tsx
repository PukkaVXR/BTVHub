import { useEffect, useMemo, useState } from "react";
import type { Effect } from "@btv/shared";
import MediaPicker from "../components/MediaPicker";
import SoundPicker from "../components/SoundPicker";
import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

type LibraryActionType = Effect["type"];

const ACTION_LABELS: Record<LibraryActionType, string> = {
  visual: "Screen effect",
  soundboard: "Sound",
  media: "Media",
  alert: "Alert",
  chat_message: "Chat overlay message",
  obs_scene: "OBS scene",
  obs_transform: "OBS motion",
  run_command: "Local command",
};

function defaultConfig(type: LibraryActionType): Record<string, unknown> {
  if (type === "soundboard") return { soundAsset: "", loop: false, durationMs: 0, volume: 1 };
  if (type === "media") return { mediaAsset: "", loop: false, durationMs: 10000, fullscreen: true, volume: 1, mute: false };
  if (type === "alert") return { themeId: "default", message: "{user} redeemed!" };
  if (type === "chat_message") return { message: "{user} redeemed {reward}!", displayName: "Stream", color: "#9147ff" };
  if (type === "obs_scene") return { sceneName: "" };
  if (type === "obs_transform") return { sceneName: "", sourceName: "Camera", mode: "dvd", durationMs: 8000, boundsWidth: 1920, boundsHeight: 1080, speedX: 8, speedY: 5, restore: true };
  if (type === "run_command") return { command: "powershell.exe", argsText: "-NoProfile\n-File\nscripts/example.ps1", timeoutMs: 10000 };
  return { style: "flash", durationMs: 800 };
}

const emptyChannelPointEffect = (): Effect => ({
  id: `channel-point-${Date.now()}`,
  name: "New Channel Point Effect",
  type: "visual",
  triggerType: "channel_points",
  triggerConfig: { rewardTitle: "", matchMode: "exact" },
  effectConfig: defaultConfig("visual"),
  cooldownMs: 5000,
  enabled: true,
});

function rewardSummary(effect: Effect): string {
  const title = String(effect.triggerConfig.rewardTitle ?? "").trim();
  const id = String(effect.triggerConfig.rewardId ?? "").trim();
  if (title && id) return `${title} (${id.slice(0, 8)}...)`;
  return title || id || "No reward mapped";
}

function actionSummary(effect: Effect): string {
  if (effect.type === "soundboard") return String(effect.effectConfig.soundAsset ?? effect.effectConfig.soundUrl ?? "No sound");
  if (effect.type === "media") return String(effect.effectConfig.mediaAsset ?? effect.effectConfig.mediaUrl ?? "No media");
  if (effect.type === "alert") return `Alert: ${String(effect.effectConfig.message ?? "default copy")}`;
  if (effect.type === "chat_message") return String(effect.effectConfig.message ?? "No message");
  if (effect.type === "obs_scene") return `Scene: ${String(effect.effectConfig.sceneName ?? "unset")}`;
  if (effect.type === "obs_transform") return `Move: ${String(effect.effectConfig.sourceName ?? "source")}`;
  if (effect.type === "run_command") return `Command: ${String(effect.effectConfig.command ?? "unset")}`;
  return `Visual: ${String(effect.effectConfig.style ?? "flash")}`;
}

export default function ChannelPointLibraryPage() {
  const toast = useToast();
  const [effects, setEffects] = useState<Effect[]>([]);
  const [themes, setThemes] = useState<Array<{ id: string; name: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const [items, themeItems] = await Promise.all([api.effects(), api.themes()]);
    const channelPointEffects = items
      .filter((effect) => effect.triggerType === "channel_points")
      .sort((a, b) => a.name.localeCompare(b.name));
    setEffects(channelPointEffects);
    setThemes(themeItems.map((theme) => ({ id: theme.id, name: theme.name })));
    if (!editingId && channelPointEffects[0]) setEditingId(channelPointEffects[0].id);
  };

  useEffect(() => {
    void load();
  }, []);

  const editing = useMemo(() => effects.find((effect) => effect.id === editingId) ?? null, [editingId, effects]);

  const updateLocal = (effect: Effect) => {
    setEffects((prev) => [...prev.filter((item) => item.id !== effect.id), effect].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const save = async (effect: Effect, message = "Channel point effect saved") => {
    setSavingId(effect.id);
    try {
      await api.saveEffect(effect);
      updateLocal(effect);
      toast({ message, tone: "success" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not save effect", tone: "error" });
      void load();
    } finally {
      setSavingId(null);
    }
  };

  const patchEditing = (patch: Partial<Effect>, effectConfig?: Record<string, unknown>, triggerConfig?: Record<string, unknown>) => {
    if (!editing) return;
    updateLocal({
      ...editing,
      ...patch,
      triggerType: "channel_points",
      effectConfig: { ...editing.effectConfig, ...effectConfig },
      triggerConfig: { ...editing.triggerConfig, ...triggerConfig },
    });
  };

  const addEffect = () => {
    const effect = emptyChannelPointEffect();
    setEffects((prev) => [effect, ...prev]);
    setEditingId(effect.id);
  };

  const deleteEffect = async (effect: Effect) => {
    if (!window.confirm(`Delete channel point effect "${effect.name}"?`)) return;
    setSavingId(effect.id);
    try {
      await api.deleteEffect(effect.id);
      toast({ message: "Channel point effect deleted", tone: "success" });
      setEffects((prev) => prev.filter((item) => item.id !== effect.id));
      if (editingId === effect.id) setEditingId(null);
      void load();
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not delete effect", tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const testFire = async (effect: Effect) => {
    setSavingId(effect.id);
    try {
      const res = await api.fireEffect(effect.id);
      toast({ message: res.ok ? `Fired ${effect.name}` : res.message, tone: res.ok ? "success" : "error" });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Could not fire effect", tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Channel Point Effects"
        description="A focused library for Twitch channel point rewards and the BTV effects they trigger."
        action={
          <div className="channel-points-header-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={addEffect}>
              New reward effect
            </Button>
          </div>
        }
      />

      <div className="channel-points-page">
        <Card hideableId="reward-library" hideableTitle="Reward Library">
          <CardHeader title="Reward Library" description="Every card maps one Twitch reward to one BTV effect." />
          {effects.length ? (
            <div className="channel-points-list">
              {effects.map((effect) => (
                <button
                  type="button"
                  key={effect.id}
                  className={`channel-points-list-item${effect.id === editingId ? " active" : ""}`}
                  onClick={() => setEditingId(effect.id)}
                >
                  <strong>{effect.name}</strong>
                  <span>{rewardSummary(effect)}</span>
                  <small>{ACTION_LABELS[effect.type]} - {actionSummary(effect)}</small>
                  <StatusPill tone={effect.enabled ? "success" : "neutral"} label={effect.enabled ? "Enabled" : "Disabled"} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No channel point effects yet" description="Create a reward effect, enter the Twitch reward title, then choose what BTV should do." />
          )}
        </Card>

        <Card hideableId="edit-reward-effect" hideableTitle="Edit Reward Effect">
          {editing ? (
            <>
              <CardHeader
                title="Edit Reward Effect"
                description="Match a Twitch reward by title or ID, then choose the effect BTV should run."
                action={
                  <div className="channel-points-header-actions">
                    <Button type="button" variant="secondary" size="sm" loading={savingId === editing.id} onClick={() => void testFire(editing)}>
                      Test fire
                    </Button>
                    <Button type="button" variant="primary" size="sm" loading={savingId === editing.id} onClick={() => void save(editing)}>
                      Save
                    </Button>
                  </div>
                }
              />

              <div className="channel-points-editor">
                <label>
                  Library name
                  <input value={editing.name} onChange={(event) => patchEditing({ name: event.target.value })} />
                </label>
                <label>
                  Enabled
                  <select value={editing.enabled ? "yes" : "no"} onChange={(event) => patchEditing({ enabled: event.target.value === "yes" })}>
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </label>
                <label>
                  Twitch reward title
                  <input value={String(editing.triggerConfig.rewardTitle ?? "")} onChange={(event) => patchEditing({}, {}, { rewardTitle: event.target.value })} placeholder="Hydrate" />
                </label>
                <label>
                  Reward ID optional
                  <input value={String(editing.triggerConfig.rewardId ?? "")} onChange={(event) => patchEditing({}, {}, { rewardId: event.target.value })} placeholder="Twitch reward UUID" />
                </label>
                <label>
                  Title match
                  <select value={String(editing.triggerConfig.matchMode ?? "exact")} onChange={(event) => patchEditing({}, {}, { matchMode: event.target.value })}>
                    <option value="exact">Exact title</option>
                    <option value="contains">Contains text</option>
                  </select>
                </label>
                <label>
                  Cooldown (ms)
                  <input type="number" min={0} value={editing.cooldownMs} onChange={(event) => patchEditing({ cooldownMs: Number(event.target.value) })} />
                </label>
                <label>
                  Effect type
                  <select
                    value={editing.type}
                    onChange={(event) => {
                      const type = event.target.value as LibraryActionType;
                      patchEditing({ type }, defaultConfig(type));
                    }}
                  >
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <ActionFields effect={editing} themes={themes} onPatch={(config) => patchEditing({}, config)} />
              </div>

              <div className="channel-points-footer-actions">
                <Button type="button" variant="danger" loading={savingId === editing.id} onClick={() => void deleteEffect(editing)}>
                  Delete reward effect
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="Select a reward effect" description="Choose a channel point effect from the library, or create a new one." />
          )}
        </Card>
      </div>
    </>
  );
}

function ActionFields({
  effect,
  themes,
  onPatch,
}: {
  effect: Effect;
  themes: Array<{ id: string; name: string }>;
  onPatch: (config: Record<string, unknown>) => void;
}) {
  if (effect.type === "soundboard") {
    const soundAsset = String(effect.effectConfig.soundAsset ?? effect.effectConfig.soundUrl ?? "").replace(/^\/assets\//, "");
    return (
      <>
        <div className="channel-points-editor__wide">
          <label>Sound file</label>
          <SoundPicker value={soundAsset} onChange={(path) => onPatch({ soundAsset: path, soundUrl: `/assets/${path}` })} />
        </div>
        <label>
          Loop
          <select value={effect.effectConfig.loop ? "yes" : "no"} onChange={(event) => onPatch({ loop: event.target.value === "yes" })}>
            <option value="no">Play once</option>
            <option value="yes">Loop</option>
          </select>
        </label>
        <label>
          Duration (ms)
          <input type="number" min={0} value={Number(effect.effectConfig.durationMs ?? 0)} onChange={(event) => onPatch({ durationMs: Number(event.target.value) })} />
        </label>
      </>
    );
  }

  if (effect.type === "media") {
    return (
      <>
        <div className="channel-points-editor__wide">
          <label>Media file</label>
          <MediaPicker value={String(effect.effectConfig.mediaAsset ?? "")} onChange={(path) => onPatch({ mediaAsset: path, mediaUrl: undefined })} />
        </div>
        <label>
          Fullscreen
          <select value={effect.effectConfig.fullscreen ? "yes" : "no"} onChange={(event) => onPatch({ fullscreen: event.target.value === "yes" })}>
            <option value="yes">Fullscreen</option>
            <option value="no">Use configured placement</option>
          </select>
        </label>
        <label>
          Duration (ms)
          <input type="number" min={0} value={Number(effect.effectConfig.durationMs ?? 10000)} onChange={(event) => onPatch({ durationMs: Number(event.target.value) })} />
        </label>
      </>
    );
  }

  if (effect.type === "alert") {
    return (
      <>
        <label>
          Alert theme
          <select value={String(effect.effectConfig.themeId ?? "default")} onChange={(event) => onPatch({ themeId: event.target.value })}>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </label>
        <label>
          Subtitle override
          <input value={String(effect.effectConfig.message ?? "")} onChange={(event) => onPatch({ message: event.target.value })} placeholder="{user} redeemed!" />
        </label>
      </>
    );
  }

  if (effect.type === "chat_message") {
    return (
      <>
        <label className="channel-points-editor__wide">
          Message
          <textarea rows={3} value={String(effect.effectConfig.message ?? "")} onChange={(event) => onPatch({ message: event.target.value })} placeholder="{user} redeemed {reward}!" />
        </label>
        <label>
          Display name
          <input value={String(effect.effectConfig.displayName ?? "Stream")} onChange={(event) => onPatch({ displayName: event.target.value })} />
        </label>
        <label>
          Username colour
          <input type="color" value={String(effect.effectConfig.color ?? "#9147ff")} onChange={(event) => onPatch({ color: event.target.value })} />
        </label>
      </>
    );
  }

  if (effect.type === "obs_scene") {
    return (
      <label>
        OBS scene name
        <input value={String(effect.effectConfig.sceneName ?? "")} onChange={(event) => onPatch({ sceneName: event.target.value })} />
      </label>
    );
  }

  if (effect.type === "obs_transform") {
    return (
      <>
        <label>
          OBS scene
          <input value={String(effect.effectConfig.sceneName ?? "")} onChange={(event) => onPatch({ sceneName: event.target.value })} />
        </label>
        <label>
          Source name
          <input value={String(effect.effectConfig.sourceName ?? "")} onChange={(event) => onPatch({ sourceName: event.target.value })} />
        </label>
        <label>
          Motion mode
          <select value={String(effect.effectConfig.mode ?? "dvd")} onChange={(event) => onPatch({ mode: event.target.value })}>
            <option value="dvd">DVD bounce</option>
            <option value="set">Set transform</option>
            <option value="path">Drawn path</option>
          </select>
        </label>
        <label>
          Duration (ms)
          <input type="number" min={0} value={Number(effect.effectConfig.durationMs ?? 8000)} onChange={(event) => onPatch({ durationMs: Number(event.target.value) })} />
        </label>
      </>
    );
  }

  if (effect.type === "run_command") {
    return (
      <>
        <label>
          Command
          <input value={String(effect.effectConfig.command ?? "")} onChange={(event) => onPatch({ command: event.target.value })} />
        </label>
        <label>
          Timeout (ms)
          <input type="number" min={1000} value={Number(effect.effectConfig.timeoutMs ?? 10000)} onChange={(event) => onPatch({ timeoutMs: Number(event.target.value) })} />
        </label>
        <label className="channel-points-editor__wide">
          Args, one per line
          <textarea rows={3} value={String(effect.effectConfig.argsText ?? "")} onChange={(event) => onPatch({ argsText: event.target.value, args: event.target.value.split("\n").filter(Boolean) })} />
        </label>
      </>
    );
  }

  return (
    <>
      <label>
        Visual style
        <select value={String(effect.effectConfig.style ?? "flash")} onChange={(event) => onPatch({ style: event.target.value })}>
          <option value="flash">Flash</option>
          <option value="shake">Shake</option>
        </select>
      </label>
      <label>
        Duration (ms)
        <input type="number" min={0} value={Number(effect.effectConfig.durationMs ?? 800)} onChange={(event) => onPatch({ durationMs: Number(event.target.value) })} />
      </label>
    </>
  );
}
