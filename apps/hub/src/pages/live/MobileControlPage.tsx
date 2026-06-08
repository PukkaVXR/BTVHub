import { useEffect, useMemo, useState } from "react";
import type { Effect } from "@btv/shared";
import { api, type MacroConfig, type SourceGroup } from "../../api";
import { useAppHealth } from "../../context/AppHealthContext";
import { useToast } from "../../hooks/useToast";
import { Button, Card, CardHeader, PageHeader, StatusPill } from "../../ui";

type BusyAction =
  | "start-session"
  | "stop-session"
  | "skip-alert"
  | "pause-alerts"
  | "clear-alerts"
  | "replay-alert"
  | `macro:${string}`
  | `layout:${string}`
  | `sound:${string}`
  | `emergency:${string}`;

const EMERGENCY_ACTIONS = [
  { id: "stop-sounds", label: "Stop sounds", detail: "Silence alert and overlay audio", tone: "warning" },
  { id: "hide-overlays", label: "Hide overlays", detail: "Clear visible overlay effects", tone: "warning" },
  { id: "reset-overlays", label: "Reset overlays", detail: "Restore overlay visibility", tone: "info" },
  { id: "all", label: "Stop all", detail: "Full emergency stop", tone: "danger" },
] as const;

export default function MobileControlPage() {
  const { preflight, refresh } = useAppHealth();
  const toast = useToast();
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [soundboardEffects, setSoundboardEffects] = useState<Effect[]>([]);
  const [activeSourceGroupId, setActiveSourceGroupId] = useState<string | undefined>();
  const [sessionTitle, setSessionTitle] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const activeSession = preflight?.session.session ?? null;

  const loadControls = async () => {
    const [macrosResult, sourceGroupsResult, groupStatusResult, effectsResult] = await Promise.allSettled([
      api.macros(),
      api.sourceGroups(),
      api.streamDeckSourceGroups(),
      api.effects(),
    ]);
    if (macrosResult.status === "fulfilled") setMacros(macrosResult.value);
    if (sourceGroupsResult.status === "fulfilled") setSourceGroups(sourceGroupsResult.value);
    if (groupStatusResult.status === "fulfilled") setActiveSourceGroupId(groupStatusResult.value.activeId);
    if (effectsResult.status === "fulfilled") setSoundboardEffects(effectsResult.value.filter((effect) => effect.type === "soundboard"));
  };

  useEffect(() => {
    void loadControls();
    const timer = setInterval(() => void loadControls(), 8000);
    return () => clearInterval(timer);
  }, []);

  const runAction = async (action: BusyAction, task: () => Promise<string>) => {
    setBusyAction(action);
    try {
      const message = await task();
      toast({ message, tone: "success" });
      await Promise.allSettled([loadControls(), refresh()]);
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Action failed", tone: "error" });
    } finally {
      setBusyAction(null);
    }
  };

  const statusCards = useMemo(
    () => [
      {
        label: "Twitch",
        detail: preflight?.twitch.connected ? (preflight.twitch.displayName ?? preflight.twitch.login ?? "Connected") : "Offline",
        tone: preflight?.twitch.connected ? "success" : "danger",
      },
      {
        label: "Chat",
        detail: preflight?.twitch.chat?.connected ? "Live" : preflight?.twitch.connected ? "Pending" : "Offline",
        tone: preflight?.twitch.chat?.connected ? "success" : preflight?.twitch.connected ? "warning" : "danger",
      },
      {
        label: "OBS",
        detail: preflight?.obs.connected ? "Connected" : "Offline",
        tone: preflight?.obs.connected ? "success" : "danger",
      },
      {
        label: "Alerts",
        detail: preflight?.alerts.paused ? "Paused" : `${preflight?.alerts.queued ?? 0} queued`,
        tone: preflight?.alerts.paused ? "warning" : "info",
      },
    ] satisfies Array<{ label: string; detail: string; tone: "success" | "warning" | "danger" | "info" }>,
    [preflight],
  );

  const startSession = () =>
    runAction("start-session", async () => {
      const res = await api.startSession(sessionTitle.trim() || undefined);
      setSessionTitle("");
      return res.title;
    });

  const stopSession = () =>
    runAction("stop-session", async () => {
      const res = await api.stopSession();
      return res.title;
    });

  const skipCurrentAlert = () =>
    runAction("skip-alert", async () => {
      const res = await api.skipCurrentAlert();
      return res.ok ? "Skipped current alert" : "No alert is currently playing";
    });

  const toggleAlertPause = () =>
    runAction("pause-alerts", async () => {
      const res = preflight?.alerts.paused ? await api.resumeAlertQueue() : await api.pauseAlertQueue();
      return res.queue.paused ? "Alert queue paused" : "Alert queue resumed";
    });

  const clearAlerts = () =>
    runAction("clear-alerts", async () => {
      const res = await api.clearAlertQueue();
      return `Cleared ${res.cleared} queued alert${res.cleared === 1 ? "" : "s"}`;
    });

  const replayAlert = () =>
    runAction("replay-alert", async () => {
      const res = await api.replayLastAlert();
      return res.ok ? "Replayed last alert" : "No previous alert to replay";
    });

  const runMacro = (macro: MacroConfig) =>
    runAction(`macro:${macro.id}`, async () => {
      const res = await api.runMacro(macro.id);
      return res.ok ? `Ran ${macro.name}` : res.message;
    });

  const runSound = (effect: Effect) =>
    runAction(`sound:${effect.id}`, async () => {
      const res = await api.fireEffect(effect.id);
      return res.ok ? `Played ${effect.name}` : res.message;
    });

  const applySourceGroup = (group: SourceGroup) =>
    runAction(`layout:${group.id}`, async () => {
      const res = await api.applySourceGroup(group.id);
      if (res.ok) setActiveSourceGroupId(group.id);
      return res.message;
    });

  const emergencyAction = (action: string) =>
    runAction(`emergency:${action}`, async () => {
      const res = await api.emergencyAction(action);
      return res.ok ? res.title : res.message;
    });

  const soundDetail = (effect: Effect) => {
    const source = String(effect.effectConfig.soundAsset ?? effect.effectConfig.soundUrl ?? "Sound effect");
    const cleanSource = source.replace(/^\/?assets\//, "").replace(/^sounds\//, "");
    const parts = [cleanSource || "Sound effect"];
    if (effect.effectConfig.loop) parts.push("loop");
    const durationMs = Number(effect.effectConfig.durationMs ?? 0);
    if (durationMs > 0) parts.push(`${Math.round(durationMs / 100) / 10}s`);
    return parts.join(" - ");
  };

  return (
    <div className="mobile-control-page">
      <PageHeader title="Mobile Control" description="A touch-first live control surface for phones, tablets, and compact OBS docks." />

      <div className="mobile-control-status" aria-label="Live status">
        {statusCards.map((status) => (
          <StatusPill key={status.label} tone={status.tone} label={status.label} detail={status.detail} />
        ))}
      </div>

      <Card className="mobile-control-emergency" hideableId="emergency" hideableTitle="Emergency">
        <CardHeader title="Emergency" description="Always reachable stream-safety actions." />
        <div className="mobile-control-button-grid mobile-control-button-grid--emergency">
          {EMERGENCY_ACTIONS.map((action) => (
            <MobileActionButton
              key={action.id}
              tone={action.tone}
              title={action.label}
              detail={action.detail}
              loading={busyAction === `emergency:${action.id}`}
              onClick={() => emergencyAction(action.id)}
            />
          ))}
        </div>
      </Card>

      <Card hideableId="session" hideableTitle="Session">
        <CardHeader title="Session" description={activeSession ? `Live since ${new Date(activeSession.started_at).toLocaleTimeString()}` : "Start or stop a stream session."} />
        <div className="mobile-control-session">
          <input
            value={sessionTitle}
            onChange={(event) => setSessionTitle(event.target.value)}
            placeholder="Session title"
            disabled={Boolean(activeSession)}
          />
          {activeSession ? (
            <Button type="button" variant="danger" loading={busyAction === "stop-session"} onClick={stopSession}>
              Stop session
            </Button>
          ) : (
            <Button type="button" variant="primary" loading={busyAction === "start-session"} onClick={startSession}>
              Start session
            </Button>
          )}
        </div>
      </Card>

      <Card hideableId="alert-queue" hideableTitle="Alert Queue">
        <CardHeader title="Alert Queue" description={preflight?.alerts.current ? `Playing ${preflight.alerts.current.eventType}` : "Fast controls for live alert playback."} />
        <div className="mobile-control-button-grid">
          <MobileActionButton title="Skip" detail="Move to next alert" loading={busyAction === "skip-alert"} onClick={skipCurrentAlert} />
          <MobileActionButton
            title={preflight?.alerts.paused ? "Resume" : "Pause"}
            detail={preflight?.alerts.paused ? "Let alerts play" : "Hold queued alerts"}
            loading={busyAction === "pause-alerts"}
            onClick={toggleAlertPause}
          />
          <MobileActionButton title="Replay" detail="Replay last alert" loading={busyAction === "replay-alert"} onClick={replayAlert} />
          <MobileActionButton tone="danger" title="Clear" detail="Empty alert queue" loading={busyAction === "clear-alerts"} onClick={clearAlerts} />
        </div>
      </Card>

      <Card hideableId="soundboard" hideableTitle="Soundboard">
        <CardHeader
          title="Soundboard"
          description="Play saved soundboard effects from large, thumb-friendly buttons."
          action={
            <Button type="button" variant="secondary" size="sm" loading={busyAction === "emergency:stop-sounds"} onClick={() => emergencyAction("stop-sounds")}>
              Stop sounds
            </Button>
          }
        />
        {soundboardEffects.length ? (
          <div className="mobile-control-button-grid">
            {soundboardEffects.map((effect) => (
              <MobileActionButton
                key={effect.id}
                title={effect.name}
                detail={soundDetail(effect)}
                loading={busyAction === `sound:${effect.id}`}
                onClick={() => runSound(effect)}
              />
            ))}
          </div>
        ) : (
          <p className="mobile-control-empty">No soundboard effects yet. Create soundboard actions in Interactive to make them appear here.</p>
        )}
      </Card>

      <Card hideableId="macros" hideableTitle="Macros">
        <CardHeader title="Macros" description="Run your live production macros from large, thumb-friendly buttons." />
        {macros.length ? (
          <div className="mobile-control-button-grid">
            {macros.map((macro) => (
              <MobileActionButton
                key={macro.id}
                title={macro.name}
                detail={macro.enabled ? `${macro.steps.length} step${macro.steps.length === 1 ? "" : "s"}` : "Disabled"}
                disabled={!macro.enabled}
                loading={busyAction === `macro:${macro.id}`}
                onClick={() => runMacro(macro)}
              />
            ))}
          </div>
        ) : (
          <p className="mobile-control-empty">No macros have been created yet.</p>
        )}
      </Card>

      <Card hideableId="activity-layouts" hideableTitle="Activity Layouts">
        <CardHeader title="Activity Layouts" description="Apply saved OBS source groups without opening the full editor." />
        {sourceGroups.length ? (
          <div className="mobile-control-button-grid">
            {sourceGroups.map((group) => (
              <MobileActionButton
                key={group.id}
                title={group.name}
                detail={`${group.sceneName} - ${group.sources.length} source${group.sources.length === 1 ? "" : "s"}`}
                active={group.id === activeSourceGroupId}
                loading={busyAction === `layout:${group.id}`}
                onClick={() => applySourceGroup(group)}
              />
            ))}
          </div>
        ) : (
          <p className="mobile-control-empty">No activity layouts have been saved yet.</p>
        )}
      </Card>
    </div>
  );
}

function MobileActionButton({
  title,
  detail,
  tone = "default",
  active = false,
  disabled = false,
  loading = false,
  onClick,
}: {
  title: string;
  detail: string;
  tone?: "default" | "info" | "warning" | "danger";
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "mobile-control-button",
        `mobile-control-button--${tone}`,
        active ? "mobile-control-button--active" : "",
      ].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      onClick={onClick}
    >
      <strong>{loading ? "Working..." : title}</strong>
      <span>{detail}</span>
    </button>
  );
}
