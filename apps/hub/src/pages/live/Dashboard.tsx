import { useEffect, useMemo, useState } from "react";
import {
  api,
  type MacroConfig,
  type ObsSceneInfo,
  type ObsSourceInfo,
  type OverlayInfo,
  type SourceGroup,
} from "../../api";
import {
  AlertProjectChecksPanel,
  AlertQueuePanel,
  BrowserSourcesPanel,
  EmergencyControlsPanel,
  GoLiveChecklist,
  HealthPanel,
  LiveObsControlPanel,
  ObsSourceUrlsPanel,
  QuickShortcuts,
  ReadinessStrip,
  RecentActivityPanel,
  SessionPanel,
} from "../../components/live";
import { useAppHealth } from "../../context/AppHealthContext";
import { useToast } from "../../hooks/useToast";
import { goLiveChecklistItems } from "../../lib/readiness";
import { ButtonLink, PageHeader } from "../../ui";

export default function Dashboard() {
  const { preflight, refresh: refreshAppHealth } = useAppHealth();
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
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
  const [repairingBrowserSources, setRepairingBrowserSources] = useState(false);
  const toast = useToast();

  const load = async () => {
    const [overlaysResult, macrosResult, sourceGroupsResult, groupStatusResult] = await Promise.allSettled([
      api.overlays(),
      api.macros(),
      api.sourceGroups(),
      api.streamDeckSourceGroups(),
    ]);

    if (overlaysResult.status === "fulfilled") setOverlays(overlaysResult.value.overlays);
    if (macrosResult.status === "fulfilled") setMacros(macrosResult.value);
    if (sourceGroupsResult.status === "fulfilled") setSourceGroups(sourceGroupsResult.value);
    if (groupStatusResult.status === "fulfilled") setActiveSourceGroupId(groupStatusResult.value.activeId);
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
    void load();
    void loadObsScenes();
    const timer = setInterval(() => void load(), 5000);
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
    void load();
  };

  const skipCurrentAlert = async () => {
    const res = await api.skipCurrentAlert();
    toast(res.ok ? "Skipped current alert" : "No alert is currently playing");
    void load();
  };

  const toggleAlertQueuePause = async () => {
    const res = preflight?.alerts.paused ? await api.resumeAlertQueue() : await api.pauseAlertQueue();
    toast(res.queue.paused ? "Alert queue paused" : "Alert queue resumed");
    void load();
  };

  const replayLastAlert = async () => {
    const res = await api.replayLastAlert();
    toast(res.ok ? "Replayed last alert" : "No previous alert to replay");
    void load();
  };

  const adjustQueuedAlertPriority = async (id: string, nextPriority: number) => {
    const res = await api.setQueuedAlertPriority(id, nextPriority);
    toast(res.ok ? `Alert priority set to ${nextPriority}` : "That queued alert is no longer available");
    void load();
  };

  const replayActivityAlert = async (id: string) => {
    const res = await api.replayActivityAlert(id);
    toast(res.message);
    void load();
  };

  const emergencyAction = async (action: string) => {
    const res = await api.emergencyAction(action);
    toast(res.ok ? res.title : res.message);
    void load();
  };

  const repairObsBrowserSources = async () => {
    setRepairingBrowserSources(true);
    try {
      const res = await api.ensureObsBrowserSources();
      const changed = res.sources.filter((source) => source.action && source.action !== "unchanged").length;
      toast(`OBS browser sources checked in ${res.sceneName}; ${changed} updated`);
      void load();
      void refreshAppHealth();
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
    void load();
  };

  const stopSession = async () => {
    const res = await api.stopSession();
    toast(res.title);
    void load();
  };

  const switchObsScene = async () => {
    if (!selectedObsScene) return;
    const res = await api.setObsScene(selectedObsScene);
    toast(res.ok ? res.title : res.message);
    await loadObsScenes();
    void load();
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
    void load();
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
    void load();
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
      void load();
      await loadObsScenes();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Macro failed");
    }
  };

  const session = preflight?.session;
  const checklistItems = useMemo(() => goLiveChecklistItems(preflight), [preflight]);

  return (
    <>
      <PageHeader title="Dashboard" description="Live readiness for OBS, overlays, alerts, and integrations." />

      <ReadinessStrip preflight={preflight} />

      <div className="live-dashboard-grid">
        <GoLiveChecklist
          items={checklistItems}
          repairingBrowserSources={repairingBrowserSources}
          onRepairBrowserSources={() => void repairObsBrowserSources()}
        />
        <HealthPanel preflight={preflight} />
      </div>

      <EmergencyControlsPanel preflight={preflight} onAction={(action) => void emergencyAction(action)} />

      <SessionPanel
        session={session}
        title={sessionTitle}
        onTitleChange={setSessionTitle}
        onStart={() => void startSession()}
        onStop={() => void stopSession()}
      />

      <QuickShortcuts
        macros={macros}
        sourceGroups={sourceGroups}
        activeSourceGroupId={activeSourceGroupId}
        onRunMacro={(macro) => void runMacro(macro)}
        onApplySourceGroup={(group) => void applySourceGroup(group)}
        onEmergencyAction={(action) => void emergencyAction(action)}
      />

      <div className="card live-stream-deck-card">
        <div>
          <h2>Stream Deck Request Builder</h2>
          <p>API Ninja request setup now lives on its dedicated Stream Deck page.</p>
        </div>
        <ButtonLink variant="primary" size="sm" to="/stream-deck">
          Open Stream Deck
        </ButtonLink>
      </div>

      <LiveObsControlPanel
        currentObsScene={currentObsScene}
        selectedObsScene={selectedObsScene}
        obsScenes={obsScenes}
        obsSources={obsSources}
        sourceGroups={sourceGroups}
        activeSourceGroupId={activeSourceGroupId}
        sourceGroupId={sourceGroupId}
        sourceGroupName={sourceGroupName}
        selectedSourceNames={selectedSourceNames}
        obsTextInput={obsTextInput}
        obsTextValue={obsTextValue}
        onRefreshScenes={() => void loadObsScenes()}
        onSelectObsScene={setSelectedObsScene}
        onSwitchScene={() => void switchObsScene()}
        onObsTextInputChange={setObsTextInput}
        onObsTextValueChange={setObsTextValue}
        onUpdateObsText={() => void updateObsText()}
        onSourceGroupNameChange={setSourceGroupName}
        onClearSourceGroup={() => {
          setSourceGroupId("");
          setSourceGroupName("");
          setSelectedSourceNames([]);
        }}
        onSaveSourceGroup={() => void saveSourceGroup()}
        onToggleSourceGroupSelection={toggleSourceGroupSelection}
        onApplySourceGroup={(group) => void applySourceGroup(group)}
        onEditSourceGroup={editSourceGroup}
        onRemoveSourceGroup={(group) => void removeSourceGroup(group)}
        onToggleObsSource={(source) => void toggleObsSource(source)}
      />

      <AlertQueuePanel
        preflight={preflight}
        onSkipCurrent={() => void skipCurrentAlert()}
        onTogglePause={() => void toggleAlertQueuePause()}
        onReplayLast={() => void replayLastAlert()}
        onClearQueued={() => void clearQueue()}
        onAdjustPriority={(id, priority) => void adjustQueuedAlertPriority(id, priority)}
      />

      <AlertProjectChecksPanel preflight={preflight} />

      <BrowserSourcesPanel
        preflight={preflight}
        overlayChannels={overlayChannels}
        repairing={repairingBrowserSources}
        onRepair={() => void repairObsBrowserSources()}
      />

      <RecentActivityPanel preflight={preflight} onReplayAlert={(id) => void replayActivityAlert(id)} />

      <ObsSourceUrlsPanel overlays={overlays} />
    </>
  );
}
