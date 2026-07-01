import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { Effect, ThemeLayoutMeta } from "@btv/shared";
import type { ObsMotionPoint } from "../api";
import MediaPicker from "../components/MediaPicker";
import SoundPicker from "../components/SoundPicker";
import { PlacementControls } from "../theme-builder/placementControls";
import { defaultThemeLayout } from "../theme-builder/layoutCss";
import { api } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";
import { PageHeader } from "../ui";

type TriggerType = Effect["triggerType"];
type EffectType = Effect["type"];

const emptyEffect = (): Effect => ({
  id: `effect-${Date.now()}`,
  name: "New interaction",
  type: "chat_message",
  triggerType: "chat_command",
  triggerConfig: {
    command: "!hello",
    matchMode: "startsWith",
    modOnly: false,
    broadcasterOnly: false,
    subscriberOnly: false,
    vipOnly: false,
  },
  effectConfig: {
    message: "Hello {user}!",
    displayName: "Stream",
    color: "#9147ff",
  },
  cooldownMs: 5000,
  enabled: true,
});

function triggerSummary(e: Effect): string {
  if (e.triggerType === "chat_command") {
    const cmd = String(e.triggerConfig.command ?? "");
    const mode = String(e.triggerConfig.matchMode ?? "startsWith");
    const flags: string[] = [];
    if (e.triggerConfig.modOnly) flags.push("mods");
    if (e.triggerConfig.broadcasterOnly) flags.push("broadcaster");
    if (e.triggerConfig.subscriberOnly) flags.push("subs");
    return `${cmd} (${mode}${flags.length ? `, ${flags.join(", ")}` : ""})`;
  }
  if (e.triggerType === "channel_points") {
    return String(e.triggerConfig.rewardTitle ?? "any reward");
  }
  return e.triggerType;
}

function actionSummary(e: Effect): string {
  switch (e.type) {
    case "chat_message":
      return `Chat: "${String(e.effectConfig.message ?? "").slice(0, 40)}…"`;
    case "visual":
      return `Visual: ${e.effectConfig.style ?? "flash"}`;
    case "soundboard":
      return `Sound: ${e.effectConfig.soundUrl ?? e.effectConfig.soundAsset ?? "—"}`;
    case "obs_scene":
      return `Scene: ${e.effectConfig.sceneName ?? "—"}`;
    case "obs_transform":
      return `OBS motion: ${e.effectConfig.sourceName ?? "-"} (${e.effectConfig.mode ?? "dvd"})`;
    case "run_command":
      return `Command: ${e.effectConfig.command ?? "-"}`;
    case "alert":
      return `Alert (theme ${e.effectConfig.themeId ?? "default"})`;
    case "media": {
      const asset = e.effectConfig.mediaAsset ?? e.effectConfig.mediaUrl ?? "—";
      const loop = e.effectConfig.loop ? ", loop" : "";
      const dur = Number(e.effectConfig.durationMs ?? 0);
      return `Media: ${asset}${loop}${dur > 0 ? `, ${dur}ms` : ""}`;
    }
    default:
      return e.type;
  }
}

function getPath(config: Record<string, unknown>): ObsMotionPoint[] {
  return Array.isArray(config.path) ? (config.path as ObsMotionPoint[]) : [];
}

function MotionPathEditor({
  points,
  onChange,
}: {
  points: ObsMotionPoint[];
  onChange: (points: ObsMotionPoint[]) => void;
}) {
  const addPoint = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 1920);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 1080);
    onChange([...points, { x, y }]);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={addPoint}
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          width: "100%",
          maxWidth: 720,
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-md)",
          background: "linear-gradient(135deg, #10141a, #161d27)",
          overflow: "hidden",
          cursor: "crosshair",
          marginBottom: 10,
        }}
      >
        <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1="960" y1="0" x2="960" y2="1080" stroke="rgba(255,255,255,0.08)" />
          <line x1="0" y1="540" x2="1920" y2="540" stroke="rgba(255,255,255,0.08)" />
          {points.length > 1 && (
            <polyline
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.map((point, index) => (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle cx={point.x} cy={point.y} r="20" fill="var(--color-accent-hover)" />
              <text x={point.x + 28} y={point.y + 8} fill="white" fontSize="42" fontWeight="700">
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onChange(points.slice(0, -1))} disabled={!points.length}>
          Undo point
        </button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onChange([])} disabled={!points.length}>
          Clear path
        </button>
      </div>
    </div>
  );
}

export default function InteractivePage() {
  const [effects, setEffects] = useState<Effect[]>([]);
  const [themes, setThemes] = useState<Array<{ id: string; name: string }>>([]);
  const [editing, setEditing] = useState<Effect | null>(null);
  const toast = useToast();

  const load = () =>
    void Promise.all([api.effects(), api.themes()]).then(([e, t]) => {
      setEffects(e);
      setThemes(t.map((x) => ({ id: x.id, name: x.name })));
    });

  useEffect(() => {
    load();
  }, []);

  const persistEffect = useCallback(async (effect: Effect | null) => {
    if (!effect) return;
    await api.saveEffect(effect);
  }, []);

  const saveStatus = useAutoSave(editing, persistEffect, { enabled: editing != null });

  const save = async () => {
    if (!editing) return;
    await api.saveEffect(editing);
    toast("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    await api.deleteEffect(id);
    toast("Deleted");
    load();
  };

  const fire = async (id: string) => {
    const res = await api.fireEffect(id);
    toast(res.ok ? res.title : res.message);
  };

  const setTrigger = (patch: Record<string, unknown>) => {
    if (!editing) return;
    setEditing({ ...editing, triggerConfig: { ...editing.triggerConfig, ...patch } });
  };

  const setAction = (patch: Record<string, unknown>) => {
    if (!editing) return;
    setEditing({ ...editing, effectConfig: { ...editing.effectConfig, ...patch } });
  };

  const onTriggerTypeChange = (triggerType: TriggerType) => {
    if (!editing) return;
    const triggerConfig =
      triggerType === "chat_command"
        ? { command: "!cmd", matchMode: "startsWith", modOnly: false }
        : triggerType === "channel_points"
          ? { rewardTitle: "", matchMode: "exact" }
          : {};
    setEditing({ ...editing, triggerType, triggerConfig });
  };

  const onEffectTypeChange = (type: EffectType) => {
    if (!editing) return;
    const effectConfig =
      type === "chat_message"
        ? { message: "Hello {user}!", displayName: "Stream", color: "#9147ff" }
        : type === "visual"
          ? { style: "flash", durationMs: 800 }
          : type === "soundboard"
            ? { soundAsset: "", loop: false, durationMs: 0 }
            : type === "media"
              ? {
                  mediaAsset: "",
                  loop: false,
                  durationMs: 10000,
                  fullscreen: true,
                  placement: defaultThemeLayout(),
                  volume: 1,
                  mute: false,
                }
            : type === "alert"
              ? { themeId: "default", message: "{user} triggered an alert!" }
              : type === "run_command"
                ? {
                    command: "powershell.exe",
                    argsText: "-NoProfile\n-File\nscripts/example.ps1",
                    timeoutMs: 10000,
                    successChatMessage: "Command finished successfully, {user}!",
                  }
              : type === "obs_transform"
                ? {
                    sceneName: "",
                    sourceName: "Camera",
                    mode: "dvd",
                    durationMs: 8000,
                    boundsWidth: 3840,
                    boundsHeight: 2160,
                    speedX: 9,
                    speedY: 6,
                    randomizeStart: true,
                    scale: 1,
                    visible: true,
                    restore: true,
                    path: [
                      { x: 220, y: 220 },
                      { x: 1460, y: 260 },
                      { x: 1040, y: 760 },
                      { x: 380, y: 650 },
                    ],
                  }
                : { sceneName: "" };
    setEditing({ ...editing, type, effectConfig });
  };

  return (
    <>
      <PageHeader
        title="Interactive"
        description="Channel point redemptions, chat commands, chat messages on overlay, sounds, and alerts."
      />

      <div className="actions" style={{ marginBottom: 16 }}>
        <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => setEditing(emptyEffect())}>
          New interaction
        </button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>
            Edit interaction <SaveIndicator status={saveStatus} label="Interactive effect" />
          </h2>

          <div className="form-row">
            <label>Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={editing.enabled}
              onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
            />{" "}
            Enabled
          </label>

          <h3 style={{ fontSize: 15, marginBottom: 8 }}>When (trigger)</h3>
          <div className="form-row">
            <label>Trigger type</label>
            <select
              value={editing.triggerType}
              onChange={(e) => onTriggerTypeChange(e.target.value as TriggerType)}
            >
              <option value="chat_command">Chat command</option>
              <option value="channel_points">Channel points</option>
              <option value="manual">Manual / test only</option>
            </select>
          </div>

          {editing.triggerType === "chat_command" && (
            <>
              <div className="form-row">
                <label>Command</label>
                <input
                  value={String(editing.triggerConfig.command ?? "")}
                  onChange={(e) => setTrigger({ command: e.target.value })}
                  placeholder="!hello"
                />
              </div>
              <div className="form-row">
                <label>Match mode</label>
                <select
                  value={String(editing.triggerConfig.matchMode ?? "startsWith")}
                  onChange={(e) => setTrigger({ matchMode: e.target.value })}
                >
                  <option value="startsWith">Starts with command</option>
                  <option value="exact">Exact command only</option>
                  <option value="contains">Contains command</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
                Use <code>{"{args}"}</code> in messages for text after the command.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editing.triggerConfig.modOnly)}
                    onChange={(e) => setTrigger({ modOnly: e.target.checked })}
                  />{" "}
                  Mods only
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editing.triggerConfig.broadcasterOnly)}
                    onChange={(e) => setTrigger({ broadcasterOnly: e.target.checked })}
                  />{" "}
                  Broadcaster only
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editing.triggerConfig.subscriberOnly)}
                    onChange={(e) => setTrigger({ subscriberOnly: e.target.checked })}
                  />{" "}
                  Subscribers only
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editing.triggerConfig.vipOnly)}
                    onChange={(e) => setTrigger({ vipOnly: e.target.checked })}
                  />{" "}
                  VIP only
                </label>
              </div>
            </>
          )}

          {editing.triggerType === "channel_points" && (
            <>
              <div className="form-row">
                <label>Reward title</label>
                <input
                  value={String(editing.triggerConfig.rewardTitle ?? "")}
                  onChange={(e) => setTrigger({ rewardTitle: e.target.value })}
                  placeholder="Exact title from Twitch"
                />
              </div>
              <div className="form-row">
                <label>Reward ID (optional)</label>
                <input
                  value={String(editing.triggerConfig.rewardId ?? "")}
                  onChange={(e) => setTrigger({ rewardId: e.target.value })}
                  placeholder="Twitch reward UUID"
                />
              </div>
              <div className="form-row">
                <label>Title match</label>
                <select
                  value={String(editing.triggerConfig.matchMode ?? "exact")}
                  onChange={(e) => setTrigger({ matchMode: e.target.value })}
                >
                  <option value="exact">Exact title</option>
                  <option value="contains">Contains text</option>
                </select>
              </div>
            </>
          )}

          <h3 style={{ fontSize: 15, margin: "16px 0 8px" }}>Then (action)</h3>
          <div className="form-row">
            <label>Action type</label>
            <select
              value={editing.type}
              onChange={(e) => onEffectTypeChange(e.target.value as EffectType)}
            >
              <option value="chat_message">Show message in chat overlay</option>
              <option value="visual">Screen effect (flash / shake)</option>
              <option value="soundboard">Play sound</option>
              <option value="media">Play media (video / GIF / image)</option>
              <option value="alert">Play alert (theme)</option>
              <option value="obs_scene">Switch OBS scene</option>
              <option value="obs_transform">Move / resize OBS source</option>
              <option value="run_command">Run local command</option>
            </select>
          </div>

          {editing.type === "chat_message" && (
            <>
              <div className="form-row">
                <label>Message</label>
                <textarea
                  rows={3}
                  value={String(editing.effectConfig.message ?? "")}
                  onChange={(e) => setAction({ message: e.target.value })}
                  placeholder="Hello {user}! You said: {args}"
                />
              </div>
              <div className="form-row">
                <label>Display name (in chat overlay)</label>
                <input
                  value={String(editing.effectConfig.displayName ?? "Stream")}
                  onChange={(e) => setAction({ displayName: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Username color</label>
                <input
                  type="color"
                  value={String(editing.effectConfig.color ?? "#9147ff")}
                  onChange={(e) => setAction({ color: e.target.value })}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Variables: <code>{"{user}"}</code>, <code>{"{login}"}</code>, <code>{"{args}"}</code>
              </p>
            </>
          )}

          {editing.type === "visual" && (
            <>
              <div className="form-row">
                <label>Style</label>
                <select
                  value={String(editing.effectConfig.style ?? "flash")}
                  onChange={(e) => setAction({ style: e.target.value })}
                >
                  <option value="flash">Flash</option>
                  <option value="shake">Shake</option>
                </select>
              </div>
              <div className="form-row">
                <label>Duration (ms)</label>
                <input
                  type="number"
                  value={Number(editing.effectConfig.durationMs ?? 800)}
                  onChange={(e) => setAction({ durationMs: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          {editing.type === "soundboard" && (
            <>
              <div className="form-row">
                <label>Sound file</label>
                <SoundPicker
                  value={String(editing.effectConfig.soundAsset ?? editing.effectConfig.soundUrl ?? "").replace(/^\/assets\//, "")}
                  onChange={(path) => setAction({ soundAsset: path, soundUrl: `/assets/${path}` })}
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(editing.effectConfig.loop)}
                  onChange={(e) => setAction({ loop: e.target.checked })}
                />{" "}
                Loop audio
              </label>
              <div className="form-row">
                <label>Duration (ms, 0 = until end)</label>
                <input
                  type="number"
                  value={Number(editing.effectConfig.durationMs ?? 0)}
                  onChange={(e) => setAction({ durationMs: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          {editing.type === "media" && (
            <>
              <div className="form-row">
                <label>Media file</label>
                <MediaPicker
                  value={String(editing.effectConfig.mediaAsset ?? "")}
                  onChange={(path) => setAction({ mediaAsset: path, mediaUrl: undefined })}
                />
              </div>
              <div className="form-row">
                <label>Or external URL</label>
                <input
                  value={String(editing.effectConfig.mediaUrl ?? "")}
                  onChange={(e) =>
                    setAction({ mediaUrl: e.target.value || undefined, mediaAsset: undefined })
                  }
                  placeholder="https://..."
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(editing.effectConfig.loop)}
                  onChange={(e) => setAction({ loop: e.target.checked })}
                />{" "}
                Loop
              </label>
              <div className="form-row">
                <label>Duration (ms, 0 = until video ends / 60s cap if looping)</label>
                <input
                  type="number"
                  value={Number(editing.effectConfig.durationMs ?? 0)}
                  onChange={(e) => setAction({ durationMs: Number(e.target.value) })}
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(editing.effectConfig.fullscreen)}
                  onChange={(e) => setAction({ fullscreen: e.target.checked })}
                />{" "}
                Fullscreen
              </label>
              {!editing.effectConfig.fullscreen && (
                <PlacementControls
                  placement={
                    (editing.effectConfig.placement as ThemeLayoutMeta) ?? defaultThemeLayout()
                  }
                  onChange={(placement) => setAction({ placement })}
                />
              )}
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(editing.effectConfig.mute)}
                  onChange={(e) => setAction({ mute: e.target.checked })}
                />{" "}
                Mute video audio
              </label>
              {!editing.effectConfig.mute && (
                <div className="form-row">
                  <label>Volume ({Math.round(Number(editing.effectConfig.volume ?? 1) * 100)}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={Number(editing.effectConfig.volume ?? 1)}
                    onChange={(e) => setAction({ volume: Number(e.target.value) })}
                  />
                </div>
              )}
            </>
          )}

          {editing.type === "alert" && (
            <>
              <div className="form-row">
                <label>Theme</label>
                <select
                  value={String(editing.effectConfig.themeId ?? "default")}
                  onChange={(e) => setAction({ themeId: e.target.value })}
                >
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Subtitle override (optional)</label>
                <input
                  value={String(editing.effectConfig.message ?? "")}
                  onChange={(e) => setAction({ message: e.target.value })}
                  placeholder="{user} redeemed!"
                />
              </div>
              <div className="form-row">
                <label>Sound (optional)</label>
                <SoundPicker
                  value={String(editing.effectConfig.soundAsset ?? "")}
                  onChange={(path) => setAction({ soundAsset: path })}
                />
              </div>
            </>
          )}

          {editing.type === "obs_scene" && (
            <div className="form-row">
              <label>OBS scene name</label>
              <input
                value={String(editing.effectConfig.sceneName ?? "")}
                onChange={(e) => setAction({ sceneName: e.target.value })}
              />
            </div>
          )}

          {editing.type === "obs_transform" && (
            <>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="form-row">
                  <label>OBS scene name</label>
                  <input
                    value={String(editing.effectConfig.sceneName ?? "")}
                    onChange={(e) => setAction({ sceneName: e.target.value })}
                    placeholder="Gameplay"
                  />
                </div>
                <div className="form-row">
                  <label>Source name</label>
                  <input
                    value={String(editing.effectConfig.sourceName ?? "")}
                    onChange={(e) => setAction({ sourceName: e.target.value })}
                    placeholder="Camera"
                  />
                </div>
              </div>

              <div className="form-row">
                <label>Motion mode</label>
                <select
                  value={String(editing.effectConfig.mode ?? "dvd")}
                  onChange={(e) => setAction({ mode: e.target.value })}
                >
                  <option value="dvd">DVD bounce</option>
                  <option value="path">Drawn path</option>
                  <option value="set">Set position / size</option>
                </select>
              </div>

              {String(editing.effectConfig.mode ?? "dvd") !== "set" && (
                <div className="form-row">
                  <label>Duration (ms)</label>
                  <input
                    type="number"
                    min={0}
                    max={60000}
                    value={Number(editing.effectConfig.durationMs ?? 8000)}
                    onChange={(e) => setAction({ durationMs: Number(e.target.value) })}
                  />
                </div>
              )}

              {String(editing.effectConfig.mode ?? "dvd") === "dvd" && (
                <>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <div className="form-row">
                      <label>Canvas width</label>
                      <input
                        type="number"
                        value={Number(editing.effectConfig.boundsWidth ?? 3840)}
                        onChange={(e) => setAction({ boundsWidth: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Canvas height</label>
                      <input
                        type="number"
                        value={Number(editing.effectConfig.boundsHeight ?? 2160)}
                        onChange={(e) => setAction({ boundsHeight: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Horizontal speed</label>
                      <input
                        type="number"
                        value={Number(editing.effectConfig.speedX ?? 9)}
                        onChange={(e) => setAction({ speedX: Number(e.target.value) })}
                      />
                    </div>
                  <div className="form-row">
                    <label>Vertical speed</label>
                      <input
                        type="number"
                        value={Number(editing.effectConfig.speedY ?? 6)}
                        onChange={(e) => setAction({ speedY: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <label style={{ marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={editing.effectConfig.randomizeStart !== false}
                      onChange={(e) => setAction({ randomizeStart: e.target.checked })}
                    />{" "}
                    Randomize starting angle
                  </label>
                </>
              )}

              {String(editing.effectConfig.mode ?? "dvd") === "path" && (
                <div className="form-row">
                  <label>Path</label>
                  <MotionPathEditor
                    points={getPath(editing.effectConfig)}
                    onChange={(path) => setAction({ path })}
                  />
                </div>
              )}

              {String(editing.effectConfig.mode ?? "dvd") === "set" && (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <div className="form-row">
                    <label>X position</label>
                    <input
                      type="number"
                      value={Number(editing.effectConfig.x ?? 0)}
                      onChange={(e) => setAction({ x: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Y position</label>
                    <input
                      type="number"
                      value={Number(editing.effectConfig.y ?? 0)}
                      onChange={(e) => setAction({ y: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Width (optional)</label>
                    <input
                      type="number"
                      value={Number(editing.effectConfig.width ?? 0)}
                      onChange={(e) => setAction({ width: Number(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Height (optional)</label>
                    <input
                      type="number"
                      value={Number(editing.effectConfig.height ?? 0)}
                      onChange={(e) => setAction({ height: Number(e.target.value) || undefined })}
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <label>Scale multiplier ({Number(editing.effectConfig.scale ?? 1).toFixed(2)}x)</label>
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.05}
                  value={Number(editing.effectConfig.scale ?? 1)}
                  onChange={(e) => setAction({ scale: Number(e.target.value) })}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={editing.effectConfig.visible !== false}
                    onChange={(e) => setAction({ visible: e.target.checked })}
                  />{" "}
                  Show source while running
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editing.effectConfig.restore !== false}
                    onChange={(e) => setAction({ restore: e.target.checked })}
                  />{" "}
                  Restore original position after motion
                </label>
              </div>
            </>
          )}

          {editing.type === "run_command" && (
            <>
              <div className="form-row">
                <label>Command</label>
                <input
                  value={String(editing.effectConfig.command ?? "")}
                  onChange={(e) => setAction({ command: e.target.value })}
                  placeholder="powershell.exe"
                />
              </div>
              <div className="form-row">
                <label>Arguments, one per line</label>
                <textarea
                  rows={4}
                  value={String(editing.effectConfig.argsText ?? "")}
                  onChange={(e) =>
                    setAction({
                      argsText: e.target.value,
                      args: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
                    })
                  }
                  placeholder={"-NoProfile\n-File\nscripts/example.ps1"}
                  style={{ fontFamily: "monospace", lineHeight: 1.45 }}
                />
              </div>
              <div className="form-row">
                <label>Working directory (optional)</label>
                <input
                  value={String(editing.effectConfig.cwd ?? "")}
                  onChange={(e) => setAction({ cwd: e.target.value || undefined })}
                  placeholder="D:\\ProjectBTV - Copy"
                />
              </div>
              <div className="form-row">
                <label>Timeout (ms)</label>
                <input
                  type="number"
                  value={Number(editing.effectConfig.timeoutMs ?? 10000)}
                  onChange={(e) => setAction({ timeoutMs: Number(e.target.value) })}
                />
              </div>
              <div className="form-row">
                <label>Twitch chat on success (optional)</label>
                <input
                  value={String(editing.effectConfig.successChatMessage ?? "")}
                  onChange={(e) => setAction({ successChatMessage: e.target.value || undefined })}
                  placeholder="Command finished successfully, {user}!"
                />
              </div>
            </>
          )}

          <div className="form-row" style={{ marginTop: 12 }}>
            <label>Cooldown (ms)</label>
            <input
              type="number"
              value={editing.cooldownMs}
              onChange={(e) => setEditing({ ...editing, cooldownMs: Number(e.target.value) })}
            />
          </div>

          <div className="actions" style={{ marginTop: 16 }}>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => void fire(editing.id)}
            >
              Test fire
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Interactions</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Action</th>
              <th>On</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {effects.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td style={{ fontSize: 13 }}>{triggerSummary(e)}</td>
                <td style={{ fontSize: 13 }}>{actionSummary(e)}</td>
                <td>{e.enabled ? "✓" : "—"}</td>
                <td>
                  <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setEditing(e)}>
                    Edit
                  </button>{" "}
                  <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => void fire(e.id)}>
                    Test
                  </button>{" "}
                  <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => void remove(e.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
