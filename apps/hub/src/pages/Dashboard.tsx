import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type MacroConfig,
  type MacroStep,
  type ObsSceneInfo,
  type ObsSourceInfo,
  type OverlayInfo,
  type PreflightInfo,
  type SourceGroup,
} from "../api";
import { useToast } from "../hooks/useToast";
import { PageHeader } from "../ui";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: 999,
        display: "inline-block",
        background: ok ? "var(--success)" : "var(--danger)",
        boxShadow: ok ? "0 0 12px rgba(0,245,147,0.4)" : "0 0 12px rgba(235,4,0,0.35)",
      }}
    />
  );
}

function timeAgo(value?: string) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function macroStepLabel(step: MacroStep): string {
  switch (step.type) {
    case "wait":
      return `Wait ${step.durationMs}ms`;
    case "obs_scene":
      return `Scene ${step.sceneName}`;
    case "obs_source_visibility":
      return `${step.visible ? "Show" : "Hide"} ${step.sourceName}`;
    case "obs_source_motion":
      return `Move ${step.sourceName} (${step.mode ?? "set"})`;
    case "obs_text":
      return `Text ${step.inputName}`;
    case "obs_stream_start":
      return "Start stream";
    case "obs_stream_stop":
      return "Stop stream";
    case "obs_record_start":
      return "Start recording";
    case "obs_record_stop":
      return "Stop recording";
    case "obs_record_pause":
      return "Pause recording";
    case "obs_record_resume":
      return "Resume recording";
    case "obs_replay_buffer_start":
      return "Start replay buffer";
    case "obs_replay_buffer_stop":
      return "Stop replay buffer";
    case "obs_replay_buffer_save":
      return "Save replay";
    case "obs_filter":
      return `${step.enabled ? "Enable" : "Disable"} filter ${step.filterName}`;
    case "twitch_chat":
      return "Send Twitch chat";
    case "run_command":
      return `Run ${step.command}`;
    case "effect":
      return `Effect ${step.effectId}`;
    case "clear_alerts":
      return "Clear alerts";
    case "session_start":
      return "Start session";
    case "session_stop":
      return "Stop session";
    default:
      return "Unknown step";
  }
}

type StreamDeckBuilderAction =
  | "macro"
  | "sourceGroup"
  | "obsScene"
  | "sourceVisibility"
  | "sourceMotion"
  | "text"
  | "status";

interface StreamDeckRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body: string;
  notes: string[];
}

const STREAM_DECK_API_BASE = "http://127.0.0.1:4782/api";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function Dashboard() {
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [obsScenes, setObsScenes] = useState<ObsSceneInfo[]>([]);
  const [currentObsScene, setCurrentObsScene] = useState<string | null>(null);
  const [selectedObsScene, setSelectedObsScene] = useState("");
  const [obsSources, setObsSources] = useState<ObsSourceInfo[]>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [activeSourceGroupId, setActiveSourceGroupId] = useState<string | undefined>();
  const [sourceGroupName, setSourceGroupName] = useState("");
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);
  const [obsTextInput, setObsTextInput] = useState("");
  const [obsTextValue, setObsTextValue] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [builderAction, setBuilderAction] = useState<StreamDeckBuilderAction>("macro");
  const [builderMacroId, setBuilderMacroId] = useState("");
  const [builderSourceGroupId, setBuilderSourceGroupId] = useState("");
  const [builderSceneName, setBuilderSceneName] = useState("");
  const [builderSourceName, setBuilderSourceName] = useState("");
  const [builderVisible, setBuilderVisible] = useState(true);
  const [builderMotionMode, setBuilderMotionMode] = useState<"dvd" | "set">("dvd");
  const [builderTextInput, setBuilderTextInput] = useState("");
  const [builderTextValue, setBuilderTextValue] = useState("");
  const [repairingBrowserSources, setRepairingBrowserSources] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([
      api.overlays(),
      api.preflight(),
      api.macros(),
      api.sourceGroups(),
      api.streamDeckSourceGroups(),
    ]).then(([o, p, m, groups, groupStatus]) => {
      setOverlays(o.overlays);
      setPreflight(p);
      setMacros(m);
      setSourceGroups(groups);
      setActiveSourceGroupId(groupStatus.activeId);
    });
  };

  const loadObsScenes = async () => {
    try {
      const res = await api.obsScenes();
      setObsScenes(res.scenes);
      setCurrentObsScene(res.currentScene);
      const nextScene = selectedObsScene || res.currentScene || res.scenes[0]?.sceneName || "";
      setSelectedObsScene(nextScene);
      if (nextScene) {
        const sources = await api.obsSceneSources(nextScene);
        setObsSources(sources.sources);
      }
    } catch {
      setObsScenes([]);
      setObsSources([]);
      setCurrentObsScene(null);
    }
  };

  useEffect(() => {
    load();
    void loadObsScenes();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedObsScene) {
      setObsSources([]);
      return;
    }
    void api
      .obsSceneSources(selectedObsScene)
      .then((res) => setObsSources(res.sources))
      .catch(() => setObsSources([]));
  }, [selectedObsScene]);

  const overlayChannels = useMemo(() => {
    if (!preflight) return [];
    return Object.entries(preflight.overlays.channels).sort(([a], [b]) => a.localeCompare(b));
  }, [preflight]);

  const clearQueue = async () => {
    const res = await api.clearAlertQueue();
    toast(`Cleared ${res.cleared} queued alert${res.cleared === 1 ? "" : "s"}`);
    load();
  };

  const skipCurrentAlert = async () => {
    const res = await api.skipCurrentAlert();
    toast(res.ok ? "Skipped current alert" : "No alert is currently playing");
    load();
  };

  const toggleAlertQueuePause = async () => {
    const res = preflight?.alerts.paused ? await api.resumeAlertQueue() : await api.pauseAlertQueue();
    toast(res.queue.paused ? "Alert queue paused" : "Alert queue resumed");
    load();
  };

  const replayLastAlert = async () => {
    const res = await api.replayLastAlert();
    toast(res.ok ? "Replayed last alert" : "No previous alert to replay");
    load();
  };

  const adjustQueuedAlertPriority = async (id: string, nextPriority: number) => {
    const res = await api.setQueuedAlertPriority(id, nextPriority);
    toast(res.ok ? `Alert priority set to ${nextPriority}` : "That queued alert is no longer available");
    load();
  };

  const replayActivityAlert = async (id: string) => {
    const res = await api.replayActivityAlert(id);
    toast(res.message);
    load();
  };

  const emergencyAction = async (action: string) => {
    const res = await api.emergencyAction(action);
    toast(res.ok ? res.title : res.message);
    load();
  };

  const repairObsBrowserSources = async () => {
    setRepairingBrowserSources(true);
    try {
      const res = await api.ensureObsBrowserSources();
      const changed = res.sources.filter((source) => source.action && source.action !== "unchanged").length;
      toast(`OBS browser sources checked in ${res.sceneName}; ${changed} updated`);
      load();
      await loadObsScenes();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not repair OBS browser sources");
    } finally {
      setRepairingBrowserSources(false);
    }
  };

  const startSession = async () => {
    const res = await api.startSession(sessionTitle);
    toast(res.title);
    setSessionTitle("");
    load();
  };

  const stopSession = async () => {
    const res = await api.stopSession();
    toast(res.title);
    load();
  };

  const switchObsScene = async () => {
    if (!selectedObsScene) return;
    const res = await api.setObsScene(selectedObsScene);
    toast(res.ok ? res.title : res.message);
    await loadObsScenes();
    load();
  };

  const toggleObsSource = async (source: ObsSourceInfo) => {
    if (!selectedObsScene) return;
    const res = await api.setObsSourceVisible(
      selectedObsScene,
      source.sourceName,
      !source.sceneItemEnabled,
    );
    toast(res.ok ? res.title : res.message);
    await loadObsScenes();
  };

  const toggleSourceGroupSelection = (sourceName: string) => {
    setSelectedSourceNames((prev) =>
      prev.includes(sourceName)
        ? prev.filter((name) => name !== sourceName)
        : [...prev, sourceName],
    );
  };

  const editSourceGroup = (group: SourceGroup) => {
    setSourceGroupId(group.id);
    setSourceGroupName(group.name);
    setSelectedObsScene(group.sceneName);
    setSelectedSourceNames(group.sources.map((source) => source.sourceName));
  };

  const saveSourceGroup = async () => {
    if (!selectedObsScene || !sourceGroupName.trim() || selectedSourceNames.length === 0) return;
    const id = sourceGroupId || `source-group-${Date.now()}`;
    const saved = await api.saveSourceGroup({
      id,
      name: sourceGroupName.trim(),
      sceneName: selectedObsScene,
      sources: selectedSourceNames.map((sourceName) => ({ sourceName })),
      updatedAt: new Date().toISOString(),
    });
    await api.captureSourceGroup(saved.group.id, selectedSourceNames);
    toast("Activity layout saved with current positions");
    setSourceGroupId("");
    setSourceGroupName("");
    setSelectedSourceNames([]);
    load();
  };

  const applySourceGroup = async (group: SourceGroup) => {
    const res = await api.applySourceGroup(group.id);
    toast(res.ok ? res.message : res.message);
    setActiveSourceGroupId(group.id);
    setSelectedObsScene(group.sceneName);
    await loadObsScenes();
  };

  const removeSourceGroup = async (group: SourceGroup) => {
    await api.deleteSourceGroup(group.id);
    toast("Activity layout deleted");
    load();
  };

  const updateObsText = async () => {
    if (!obsTextInput.trim()) return;
    const res = await api.setObsText(obsTextInput, obsTextValue);
    toast(res.ok ? res.title : res.message);
  };

  const runMacro = async (macro: MacroConfig) => {
    try {
      const res = await api.runMacro(macro.id);
      toast(res.ok ? `${res.title}: ${macro.name}` : res.message);
      load();
      await loadObsScenes();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Macro failed");
    }
  };

  useEffect(() => {
    if (!builderMacroId && macros.length) setBuilderMacroId(macros[0]!.id);
  }, [builderMacroId, macros]);

  useEffect(() => {
    if (!builderSourceGroupId && sourceGroups.length) setBuilderSourceGroupId(sourceGroups[0]!.id);
  }, [builderSourceGroupId, sourceGroups]);

  useEffect(() => {
    if (!builderSceneName && selectedObsScene) setBuilderSceneName(selectedObsScene);
  }, [builderSceneName, selectedObsScene]);

  useEffect(() => {
    if (!builderSourceName && obsSources.length) setBuilderSourceName(obsSources[0]!.sourceName);
  }, [builderSourceName, obsSources]);

  const streamDeckRequest = useMemo<StreamDeckRequest>(() => {
    const postHeaders = { "Content-Type": "application/json" };
    switch (builderAction) {
      case "macro":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/macro/${encodeURIComponent(builderMacroId || "macro-id")}`,
          headers: postHeaders,
          body: "{}",
          notes: ["API Ninja method: POST", "Use the selected macro id from the Macros page."],
        };
      case "sourceGroup":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/source-group/${encodeURIComponent(builderSourceGroupId || "source-group-id")}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Shows this activity's sources, hides non-members, and restores saved positions."],
        };
      case "obsScene":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/scene`,
          headers: postHeaders,
          body: prettyJson({ sceneName: builderSceneName || selectedObsScene || "Scene name" }),
          notes: ["Switches the OBS program scene."],
        };
      case "sourceVisibility":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/source-visibility`,
          headers: postHeaders,
          body: prettyJson({
            sceneName: builderSceneName || selectedObsScene || "Scene name",
            sourceName: builderSourceName || "Source name",
            visible: builderVisible,
          }),
          notes: ["Create one key for show and one key for hide, or change visible as needed."],
        };
      case "sourceMotion": {
        const base = {
          sceneName: builderSceneName || selectedObsScene || "Scene name",
          sourceName: builderSourceName || "Source name",
          mode: builderMotionMode,
        };
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/source-motion`,
          headers: postHeaders,
          body:
            builderMotionMode === "dvd"
              ? prettyJson({
                  ...base,
                  durationMs: 8000,
                  boundsWidth: 3840,
                  boundsHeight: 2160,
                  speedX: 9,
                  speedY: 6,
                  randomizeStart: true,
                  restore: true,
                })
              : prettyJson({
                  ...base,
                  x: 0,
                  y: 0,
                  width: 720,
                }),
          notes: ["DVD mode bounces the source and restores it by default."],
        };
      }
      case "text":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/text`,
          headers: postHeaders,
          body: prettyJson({
            inputName: builderTextInput || obsTextInput || "OBS text source",
            text: builderTextValue || "Text from Stream Deck",
          }),
          notes: ["Updates an OBS text input."],
        };
      case "status":
        return {
          method: "GET",
          url: `${STREAM_DECK_API_BASE}/stream-deck/status`,
          headers: {},
          body: "",
          notes: ["Use this for a polling/status key if your Stream Deck plugin supports it."],
        };
      default:
        return {
          method: "POST",
          url: STREAM_DECK_API_BASE,
          headers: postHeaders,
          body: "{}",
          notes: [],
        };
    }
  }, [
    builderAction,
    builderMacroId,
    builderMotionMode,
    builderSceneName,
    builderSourceGroupId,
    builderSourceName,
    builderTextInput,
    builderTextValue,
    builderVisible,
    obsTextInput,
    selectedObsScene,
  ]);

  const apiNinjaConfig = useMemo(
    () =>
      [
        `Method: ${streamDeckRequest.method}`,
        `URL: ${streamDeckRequest.url}`,
        `Headers: ${Object.keys(streamDeckRequest.headers).length ? prettyJson(streamDeckRequest.headers) : "(none)"}`,
        `Body: ${streamDeckRequest.body || "(empty)"}`,
      ].join("\n\n"),
    [streamDeckRequest],
  );

  const copyStreamDeckConfig = async () => {
    await navigator.clipboard.writeText(apiNinjaConfig);
    toast("API Ninja request copied");
  };

  const session = preflight?.session;

  return (
    <>
      <PageHeader title="Dashboard" description="Live readiness for OBS, overlays, alerts, and integrations." />

      <div className="grid">
        {preflight?.checks.map((check) => (
          <div key={check.id} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <StatusDot ok={check.ok} />
              <h2 style={{ margin: 0 }}>{check.label}</h2>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>{check.detail}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ borderColor: "rgba(235, 4, 0, 0.45)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Emergency Controls</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Fast stream-safety actions for overlays, sounds, automations, channel points, and reconnects.
            </p>
          </div>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void emergencyAction("all")}>
            Stop all BTV effects
          </button>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void emergencyAction("stop-sounds")}>
            Stop sounds
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void emergencyAction("hide-overlays")}>
            Hide overlays
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void emergencyAction("reset-overlays")}>
            Reset overlays
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void emergencyAction(preflight?.emergency.automationsDisabled ? "enable-automations" : "disable-automations")}
          >
            {preflight?.emergency.automationsDisabled ? "Enable automations" : "Disable automations"}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void emergencyAction(preflight?.emergency.channelPointActionsDisabled ? "enable-channel-points" : "disable-channel-points")}
          >
            {preflight?.emergency.channelPointActionsDisabled ? "Enable channel points" : "Disable channel points"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void emergencyAction("reconnect-obs")}>
            Reconnect OBS
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void emergencyAction("reconnect-twitch")}>
            Reconnect Twitch
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Stream Session</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              {session?.session
                ? `${session.session.title} started ${timeAgo(session.session.started_at)}`
                : "No active analytics session"}
            </p>
          </div>
          {session?.session ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void stopSession()}>
              Stop session
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, minWidth: 320 }}>
              <input
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Optional session title"
                style={{ marginBottom: 0 }}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void startSession()}>
                Start
              </button>
            </div>
          )}
        </div>
        <div className="grid" style={{ marginTop: 14 }}>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Duration</p>
            <strong>{formatDuration(session?.durationMs ?? 0)}</strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Events</p>
            <strong>{session?.totals.events ?? 0}</strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Follows</p>
            <strong>{session?.totals.follows ?? 0}</strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Subs</p>
            <strong>{session?.totals.subs ?? 0}</strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Bits</p>
            <strong>{session?.totals.cheers ?? 0}</strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Chat</p>
            <strong>{session?.totals.chatMessages ?? 0}</strong>
          </div>
        </div>
        {session?.sceneSpans.length ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Recent OBS scenes</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {session.sceneSpans.slice(0, 5).map((span) => (
                <span key={`${span.sceneName}-${span.startedAt}`} className="badge badge-ok">
                  {span.sceneName}: {formatDuration(span.durationMs)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Quick Macros</h2>
        {macros.length ? (
          <div className="grid" style={{ marginTop: 12 }}>
            {macros.map((macro) => (
              <div key={macro.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <strong>{macro.name}</strong>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                      {macro.enabled ? `${macro.steps.length} step${macro.steps.length === 1 ? "" : "s"}` : "Disabled"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void runMacro(macro)}
                    disabled={!macro.enabled}
                  >
                    Run
                  </button>
                </div>
                {macro.steps.length ? (
                  <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                    {macro.steps.slice(0, 3).map(macroStepLabel).join(" -> ")}
                    {macro.steps.length > 3 ? " -> ..." : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No macros configured.</p>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Stream Deck Request Builder</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Build BarRaider API Ninja requests without hand-writing endpoints.
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void copyStreamDeckConfig()}>
            Copy API Ninja config
          </button>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <div>
            <label>Button action</label>
            <select
              value={builderAction}
              onChange={(e) => setBuilderAction(e.target.value as StreamDeckBuilderAction)}
            >
              <option value="macro">Run macro</option>
              <option value="sourceGroup">Activate activity layout</option>
              <option value="obsScene">Switch OBS scene</option>
              <option value="sourceVisibility">Show / hide OBS source</option>
              <option value="sourceMotion">Move OBS source</option>
              <option value="text">Update OBS text</option>
              <option value="status">Read hub status</option>
            </select>

            {builderAction === "macro" && (
              <>
                <label>Macro</label>
                <select value={builderMacroId} onChange={(e) => setBuilderMacroId(e.target.value)}>
                  <option value="">Select macro</option>
                  {macros.map((macro) => (
                    <option key={macro.id} value={macro.id}>
                      {macro.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {builderAction === "sourceGroup" && (
              <>
                <label>Activity layout</label>
                <select value={builderSourceGroupId} onChange={(e) => setBuilderSourceGroupId(e.target.value)}>
                  <option value="">Select activity</option>
                  {sourceGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {["obsScene", "sourceVisibility", "sourceMotion"].includes(builderAction) && (
              <>
                <label>Scene</label>
                <select value={builderSceneName} onChange={(e) => setBuilderSceneName(e.target.value)}>
                  <option value="">Select scene</option>
                  {obsScenes.map((scene) => (
                    <option key={scene.sceneName} value={scene.sceneName}>
                      {scene.sceneName}
                    </option>
                  ))}
                </select>
              </>
            )}

            {["sourceVisibility", "sourceMotion"].includes(builderAction) && (
              <>
                <label>Source</label>
                <select value={builderSourceName} onChange={(e) => setBuilderSourceName(e.target.value)}>
                  <option value="">Select source</option>
                  {obsSources.map((source) => (
                    <option key={`${source.sceneItemId}-${source.sourceName}`} value={source.sourceName}>
                      {source.sourceName}
                    </option>
                  ))}
                </select>
              </>
            )}

            {builderAction === "sourceVisibility" && (
              <label>
                <input
                  type="checkbox"
                  checked={builderVisible}
                  onChange={(e) => setBuilderVisible(e.target.checked)}
                />{" "}
                Show source
              </label>
            )}

            {builderAction === "sourceMotion" && (
              <>
                <label>Motion</label>
                <select value={builderMotionMode} onChange={(e) => setBuilderMotionMode(e.target.value as "dvd" | "set")}>
                  <option value="dvd">DVD bounce</option>
                  <option value="set">Set position / size</option>
                </select>
              </>
            )}

            {builderAction === "text" && (
              <>
                <label>OBS text input</label>
                <input
                  value={builderTextInput}
                  onChange={(e) => setBuilderTextInput(e.target.value)}
                  placeholder="OBS text source"
                />
                <label>Text</label>
                <input
                  value={builderTextValue}
                  onChange={(e) => setBuilderTextValue(e.target.value)}
                  placeholder="Text from Stream Deck"
                />
              </>
            )}
          </div>

          <div>
            <label>API Ninja request</label>
            <div className="url-box" style={{ marginTop: 0 }}>{streamDeckRequest.url}</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <div>
                <label>Method</label>
                <input value={streamDeckRequest.method} readOnly />
              </div>
              <div>
                <label>Content-Type</label>
                <input value={streamDeckRequest.headers["Content-Type"] ?? ""} readOnly placeholder="None" />
              </div>
            </div>
            <label>Body</label>
            <textarea
              rows={8}
              value={streamDeckRequest.body}
              readOnly
              placeholder="No body for this request"
              style={{ fontFamily: "monospace", lineHeight: 1.45 }}
            />
            <div className="actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyStreamDeckConfig()}>
                Copy all fields
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void navigator.clipboard.writeText(streamDeckRequest.url).then(() => toast("URL copied"))}
              >
                Copy URL
              </button>
              {streamDeckRequest.body && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void navigator.clipboard.writeText(streamDeckRequest.body).then(() => toast("Body copied"))}
                >
                  Copy body
                </button>
              )}
            </div>
            {streamDeckRequest.notes.length ? (
              <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
                {streamDeckRequest.notes.join(" ")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>OBS Control</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Current scene: {currentObsScene ?? "Unavailable"}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadObsScenes()}>
            Refresh OBS
          </button>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div>
            <label>Scene</label>
            <select value={selectedObsScene} onChange={(e) => setSelectedObsScene(e.target.value)}>
              <option value="">Select scene</option>
              {obsScenes.map((scene) => (
                <option key={scene.sceneName} value={scene.sceneName}>
                  {scene.sceneName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void switchObsScene()}
              disabled={!selectedObsScene}
            >
              Switch scene
            </button>
          </div>
          <div>
            <label>Text input name</label>
            <input
              value={obsTextInput}
              onChange={(e) => setObsTextInput(e.target.value)}
              placeholder="OBS text source"
            />
            <label>Text</label>
            <input
              value={obsTextValue}
              onChange={(e) => setObsTextValue(e.target.value)}
              placeholder="Text to send"
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void updateObsText()}
              disabled={!obsTextInput.trim()}
            >
              Update text
            </button>
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <h2 style={{ marginBottom: 8 }}>Activity Layouts</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
            Save which sources belong to an activity and capture their current OBS positions.
          </p>
          <div className="grid">
            <div>
              <label>Activity name</label>
              <input
                value={sourceGroupName}
                onChange={(e) => setSourceGroupName(e.target.value)}
                placeholder="Apex, Just Chatting, Coding..."
              />
              <div className="actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void saveSourceGroup()}
                  disabled={!selectedObsScene || !sourceGroupName.trim() || selectedSourceNames.length === 0}
                >
                  {sourceGroupId ? "Update layout" : "Save layout"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSourceGroupId("");
                    setSourceGroupName("");
                    setSelectedSourceNames([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div>
              <label>Sources in this activity</label>
              <div style={{ display: "grid", gap: 6, maxHeight: 190, overflow: "auto", paddingRight: 4 }}>
                {obsSources.map((source) => (
                  <label key={`group-${source.sceneItemId}-${source.sourceName}`} style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={selectedSourceNames.includes(source.sourceName)}
                      onChange={() => toggleSourceGroupSelection(source.sourceName)}
                    />{" "}
                    {source.sourceName}
                  </label>
                ))}
                {!obsSources.length && <span style={{ color: "var(--muted)", fontSize: 13 }}>Select an OBS scene first.</span>}
              </div>
            </div>
          </div>
          {sourceGroups.length ? (
            <div className="grid" style={{ marginTop: 14 }}>
              {sourceGroups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    border: `1px solid ${group.id === activeSourceGroupId ? "var(--success)" : "var(--border)"}`,
                    borderRadius: "var(--radius)",
                    padding: 12,
                    background: group.id === activeSourceGroupId ? "var(--success-soft)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{group.name}</strong>
                    {group.id === activeSourceGroupId && <span className="badge badge-ok">Live</span>}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    {group.sceneName} - {group.sources.length} source{group.sources.length === 1 ? "" : "s"}
                  </p>
                  <div className="actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void applySourceGroup(group)}>
                      Go live
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => editSourceGroup(group)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeSourceGroup(group)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {obsSources.length ? (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Visible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {obsSources.map((source) => (
                <tr key={`${source.sceneItemId}-${source.sourceName}`}>
                  <td>{source.sourceName}</td>
                  <td>{source.sceneItemEnabled ? "Yes" : "No"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void toggleObsSource(source)}
                    >
                      {source.sceneItemEnabled ? "Hide" : "Show"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
            Connect OBS and select a scene to inspect sources.
          </p>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Alert Queue</h2>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void skipCurrentAlert()} disabled={!preflight?.alerts.current}>
              Skip current
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void toggleAlertQueuePause()}>
              {preflight?.alerts.paused ? "Resume queue" : "Pause queue"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void replayLastAlert()}>
              Replay last
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void clearQueue()}>
              Clear queued
            </button>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Now playing</p>
            <strong>
              {preflight?.alerts.current
                ? `${preflight.alerts.current.eventType} ${
                    preflight.alerts.current.user ? `from ${preflight.alerts.current.user}` : ""
                  }`
                : "Idle"}
            </strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Queued</p>
            <strong>{preflight?.alerts.queued ?? 0}{preflight?.alerts.paused ? " paused" : ""}</strong>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Updated</p>
            <strong>{preflight ? timeAgo(preflight.generatedAt) : ""}</strong>
          </div>
        </div>
        {preflight?.alerts.next.length ? (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>Priority</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {preflight.alerts.next.map((item) => (
                <tr key={item.id}>
                  <td>{item.eventType}</td>
                  <td>{item.user ?? "-"}</td>
                  <td>{item.priority}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void adjustQueuedAlertPriority(item.id, item.priority + 1)}
                        title="Increase this queued alert's priority."
                      >
                        Priority +
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void adjustQueuedAlertPriority(item.id, item.priority - 1)}
                        title="Decrease this queued alert's priority."
                      >
                        Priority -
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {preflight?.alertProjects.projects.length ? (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Alert Project Checks</h2>
            <span className={preflight.alertProjects.errors ? "badge badge-off" : "badge"}>
              {preflight.alertProjects.errors} broken / {preflight.alertProjects.warnings} warning
              {preflight.alertProjects.warnings === 1 ? "" : "s"}
            </span>
          </div>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Event</th>
                <th>Issue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {preflight.alertProjects.projects.slice(0, 6).map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.eventType}</td>
                  <td>
                    {project.issues[0]?.message ?? `${project.errors} error(s), ${project.warnings} warning(s)`}
                  </td>
                  <td>
                    <Link className="btn btn-secondary btn-sm" to={`/alerts/${encodeURIComponent(project.id)}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preflight.alertProjects.projects.length > 6 && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
              {preflight.alertProjects.projects.length - 6} more project(s) have checks hidden.
            </p>
          )}
        </div>
      ) : null}

      <div className="card">
        <h2>Connected Browser Sources</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          {preflight?.overlays.clientCount ?? 0} active WebSocket client
          {(preflight?.overlays.clientCount ?? 0) === 1 ? "" : "s"}
        </p>
        {preflight?.expectedOverlays.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {preflight.expectedOverlays.map((overlay) => (
              <span key={overlay.id} className={overlay.reachable ? "badge badge-ok" : "badge"}>
                {overlay.label}: {overlay.reachable ? "reachable" : overlay.obsSource?.configured ? "configured, not live" : "not in OBS"}
              </span>
            ))}
          </div>
        ) : null}
        {preflight?.obs.connected && (
          preflight.overlays.clientCount === 0
          || preflight.expectedOverlays.some((overlay) => overlay.obsSource && (!overlay.obsSource.configured || !overlay.obsSource.correctUrl))
        ) ? (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              OBS browser sources are missing, mismatched, hidden, or not actively loading.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void repairObsBrowserSources()}
              disabled={repairingBrowserSources}
            >
              {repairingBrowserSources ? "Repairing..." : "Repair OBS browser sources"}
            </button>
          </div>
        ) : null}
        {overlayChannels.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {overlayChannels.map(([channel, count]) => (
              <span key={channel} className="badge badge-ok">
                {channel}: {count}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Open OBS or preview an overlay page to connect browser sources.
          </p>
        )}
        {preflight?.overlays.clients.length ? (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Route</th>
                <th>Channels</th>
                <th>Status</th>
                <th>Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {preflight.overlays.clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.route ?? "-"}</td>
                  <td>{client.channels.join(", ")}</td>
                  <td>{client.status}</td>
                  <td>{timeAgo(client.lastHeartbeatAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {preflight?.expectedOverlays.some((overlay) => overlay.obsSource?.configured) ? (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Overlay</th>
                <th>OBS source</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {preflight.expectedOverlays.map((overlay) => (
                <tr key={`obs-source-${overlay.id}`}>
                  <td>{overlay.label}</td>
                  <td>{overlay.obsSource?.sourceName ?? "-"}</td>
                  <td>{overlay.obsSource?.correctUrl ? "Correct" : overlay.obsSource?.configured ? "Mismatch" : "Missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="card">
        <h2>Recent Activity</h2>
        {preflight?.activity.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Type</th>
                <th>User</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {preflight.activity.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td>{timeAgo(row.at)}</td>
                  <td>{row.event.source}</td>
                  <td>{row.event.type}</td>
                  <td>{row.event.user?.displayName ?? "-"}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void replayActivityAlert(row.id)}>
                      Replay alert
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>No events yet.</p>
        )}
      </div>

      <div className="card">
        <h2>OBS Source URLs</h2>
        <div className="grid">
          {overlays.slice(0, 4).map((o) => (
            <div key={o.id}>
              <strong>{o.name}</strong>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{o.id}</p>
              <div className="url-box">{o.url}</div>
            </div>
          ))}
        </div>
        <div className="actions">
          <Link className="btn btn-secondary btn-sm" to="/overlays">
            Manage overlays
          </Link>
          <Link className="btn btn-secondary btn-sm" to="/integrations">
            Integrations
          </Link>
          <Link className="btn btn-primary btn-sm" to="/alerts">
            Test alerts
          </Link>
        </div>
      </div>
    </>
  );
}
