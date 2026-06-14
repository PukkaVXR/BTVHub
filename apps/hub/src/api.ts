import { emitTestAlertSuccess } from "./lib/testAlertMilestone";
import { resolveApiBase } from "./lib/serverUrls";

const API = resolveApiBase();
let apiTokenPromise: Promise<string> | null = null;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function getLocalApiToken(): Promise<string> {
  if (!apiTokenPromise) {
    apiTokenPromise = fetch(`${API}/auth/token`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not bootstrap local API token");
        const data = (await res.json()) as { token?: string };
        if (!data.token) throw new Error("Local API token response was empty");
        return data.token;
      })
      .catch((error) => {
        apiTokenPromise = null;
        throw error;
      });
  }
  return apiTokenPromise;
}



async function request<T>(path: string, init?: RequestInit): Promise<T> {

  const headers = new Headers(init?.headers);

  if (init?.body != null && !headers.has("Content-Type")) {

    headers.set("Content-Type", "application/json");

  }

  if (path !== "/auth/token" && !headers.has("X-BTV-Token")) {
    headers.set("X-BTV-Token", await getLocalApiToken());
  }

  const res = await fetch(`${API}${path}`, {

    ...init,

    headers,

  });

  if (!res.ok) {

    let message = res.statusText;

    let data: unknown;

    try {

      const err = (await res.json()) as {

        error?: string;

        message?: string;

      };

      data = err;

      message = err.message ?? err.error ?? message;

    } catch {

      /* non-json body */

    }

    throw new ApiRequestError(message, res.status, data);

  }

  return res.json() as Promise<T>;

}



export const api = {

  health: () => request<HealthInfo>("/health"),

  preflight: () => request<PreflightInfo>("/preflight"),

  plugins: () => request<import("@btv/shared").PluginRegistryResponse>("/plugins"),

  setPluginEnabled: (id: string, enabled: boolean) =>
    request<{ ok: boolean; plugin: import("@btv/shared").PluginRegistryItem }>(`/plugins/${encodeURIComponent(id)}/enabled`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

  savePluginSettings: (id: string, settings: Record<string, unknown>) =>
    request<{ ok: boolean; plugin: import("@btv/shared").PluginRegistryItem }>(`/plugins/${encodeURIComponent(id)}/settings`, {
      method: "PUT",
      body: JSON.stringify({ settings }),
    }),

  updatePluginManifest: (
    id: string,
    data: {
      name?: string;
      description?: string;
      author?: string;
      capabilities?: import("@btv/shared").PluginCapabilityType[];
      permissions?: import("@btv/shared").PluginPermission[];
    },
  ) =>
    request<{ ok: boolean; plugin: import("@btv/shared").PluginRegistryItem }>(`/plugins/${encodeURIComponent(id)}/manifest`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  exportPluginPack: (id: string) =>
    request<import("@btv/shared").PluginPack>(`/plugins/${encodeURIComponent(id)}/export`),

  importPluginPack: (pack: import("@btv/shared").PluginPack) =>
    request<{ ok: boolean; plugin: import("@btv/shared").PluginRegistryItem }>("/plugins/import", {
      method: "POST",
      body: JSON.stringify({ pack }),
    }),

  createDevPlugin: (data: { id?: string; name: string; description?: string; author?: string; capabilities: import("@btv/shared").PluginCapabilityType[] }) =>
    request<{ ok: boolean; plugin: import("@btv/shared").PluginRegistryItem }>("/plugins/dev", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  currentSession: () => request<StreamSessionSummary>("/sessions/current"),

  sessions: () => request<{ sessions: StreamSession[] }>("/sessions"),

  sessionDetail: (id: string) =>
    request<StreamSessionDetail>(`/sessions/${encodeURIComponent(id)}`),

  sessionRecap: (id: string) =>
    request<StreamRecap>(`/sessions/${encodeURIComponent(id)}/recap`),

  startSession: (title?: string) =>
    request<ActionResponse & { session: StreamSessionSummary }>("/sessions/start", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  stopSession: () =>
    request<ActionResponse & { session: StreamSessionSummary }>("/sessions/stop", {
      method: "POST",
    }),

  overlays: () => request<{ overlays: OverlayInfo[] }>("/overlays"),

  overlayPacks: () => request<{ packs: OverlayPackSummary[] }>("/overlay-packs"),

  createOverlayPack: (data: { name: string; description?: string }) =>
    request<{ ok: boolean; pack: OverlayPackSummary }>("/overlay-packs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  applyOverlayPack: (id: string) =>
    request<{ ok: boolean; pack: OverlayPackSummary }>(`/overlay-packs/${encodeURIComponent(id)}/apply`, {
      method: "POST",
    }),

  exportOverlayPack: (id: string) =>
    request<OverlayPackExport>(`/overlay-packs/${encodeURIComponent(id)}/export`),

  importOverlayPack: (pack: OverlayPackExport | unknown) =>
    request<{ ok: boolean; pack: OverlayPackSummary }>("/overlay-packs/import", {
      method: "POST",
      body: JSON.stringify({ pack }),
    }),

  deleteOverlayPack: (id: string) =>
    request<{ ok: boolean }>(`/overlay-packs/${encodeURIComponent(id)}`, { method: "DELETE" }),

  ensureObsBrowserSources: (sceneName?: string) =>
    request<{ ok: boolean; sceneName: string; sources: ObsBrowserSourceStatus[] }>("/obs/browser-sources/ensure", {
      method: "POST",
      body: JSON.stringify({ sceneName }),
    }),
  browserSourceLayouts: () =>
    request<ObsBrowserSourceLayoutsResponse>("/obs/browser-source-layouts"),

  saveBrowserSourceLayouts: (layouts: ObsBrowserSourceLayout[], canvas?: ObsBrowserSourceCanvas) =>
    request<ObsBrowserSourceLayoutsResponse>("/obs/browser-source-layouts", {
      method: "PUT",
      body: JSON.stringify({ layouts, canvas }),
    }),

  applyBrowserSourceLayouts: (sceneName: string | undefined, layouts: ObsBrowserSourceLayout[], canvas?: ObsBrowserSourceCanvas) =>
    request<ObsBrowserSourceLayoutsApplyResponse>("/obs/browser-source-layouts/apply", {
      method: "POST",
      body: JSON.stringify({ sceneName, layouts, canvas }),
    }),

  themes: () => request<import("@btv/shared").Theme[]>("/themes"),

  alertProjects: () => request<import("@btv/shared").AlertProject[]>("/alert-projects"),

  alertProject: (id: string) =>
    request<import("@btv/shared").AlertProject>("/alert-projects/" + encodeURIComponent(id)),

  saveAlertProject: (project: import("@btv/shared").AlertProject) =>
    request<{ ok: boolean; project: import("@btv/shared").AlertProject }>("/alert-projects/" + encodeURIComponent(project.id), {
      method: "PUT",
      body: JSON.stringify(project),
    }),

  deleteAlertProject: (id: string) =>
    request("/alert-projects/" + encodeURIComponent(id), { method: "DELETE" }),

  testAlertProject: (id: string, eventType: import("@btv/shared").StreamEventType, testPayload?: Record<string, unknown>, variationId?: string) =>
    request<{ ok: boolean; event: import("@btv/shared").StreamEvent }>("/alert-projects/" + encodeURIComponent(id) + "/test", {
      method: "POST",
      body: JSON.stringify({ eventType, testPayload, variationId }),
    }),

  saveTheme: (theme: import("@btv/shared").Theme) =>

    request(`/themes/${theme.id}`, { method: "PUT", body: JSON.stringify(theme) }),

  deleteTheme: (id: string) => request(`/themes/${id}`, { method: "DELETE" }),

  overlayTheme: () => request<OverlayThemeConfig>("/overlay-theme"),

  saveOverlayTheme: (theme: OverlayThemeConfig) =>
    request<{ ok: boolean; theme: OverlayThemeConfig }>("/overlay-theme", {
      method: "PUT",
      body: JSON.stringify(theme),
    }),

  alertRules: () => request<import("@btv/shared").AlertRule[]>("/alert-rules"),

  saveAlertRule: (rule: import("@btv/shared").AlertRule) =>

    request(`/alert-rules/${rule.id}`, { method: "PUT", body: JSON.stringify(rule) }),

  widgets: () => request<import("@btv/shared").WidgetConfig[]>("/widgets"),

  saveWidget: (w: import("@btv/shared").WidgetConfig) =>

    request(`/widgets/${w.id}`, { method: "PUT", body: JSON.stringify(w) }),

  goals: () =>

    request<

      Array<{

        id: string;

        label: string;

        type: string;

        current_count: number;

        target_count: number;

      }>

    >("/goals"),

  saveGoal: (id: string, data: { current?: number; target?: number; label?: string }) =>

    request(`/goals/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  webhooks: () => request<WebhookInfo[]>("/webhooks"),

  saveWebhook: (h: import("@btv/shared").WebhookHook) =>

    request<{ ok: boolean; url: string }>(`/webhooks/${h.id}`, {

      method: "PUT",

      body: JSON.stringify(h),

    }),

  deleteWebhook: (id: string) => request(`/webhooks/${id}`, { method: "DELETE" }),

  webhookLog: () =>

    request<Array<{ id: string; hook_id: string; body: string; created_at: string }>>(

      "/webhooks/log",

    ),

  effects: () => request<import("@btv/shared").Effect[]>("/effects"),

  saveEffect: (e: import("@btv/shared").Effect) =>

    request(`/effects/${e.id}`, { method: "PUT", body: JSON.stringify(e) }),

  deleteEffect: (id: string) => request(`/effects/${id}`, { method: "DELETE" }),

  fireEffect: (id: string) =>
    request<ActionResponse>(`/effects/${id}/fire`, { method: "POST" }),

  clearAlertQueue: () =>
    request<{ ok: boolean; cleared: number; queue: AlertQueueInfo }>("/alerts/clear", {
      method: "POST",
    }),

  skipCurrentAlert: () =>
    request<{ ok: boolean; queue: AlertQueueInfo }>("/alerts/skip", { method: "POST" }),

  pauseAlertQueue: () =>
    request<{ ok: boolean; queue: AlertQueueInfo }>("/alerts/pause", { method: "POST" }),

  resumeAlertQueue: () =>
    request<{ ok: boolean; queue: AlertQueueInfo }>("/alerts/resume", { method: "POST" }),

  replayLastAlert: () =>
    request<{ ok: boolean; queue: AlertQueueInfo }>("/alerts/replay-last", { method: "POST" }),

  setQueuedAlertPriority: (id: string, priority: number) =>
    request<{ ok: boolean; queue: AlertQueueInfo }>(`/alerts/queue/${encodeURIComponent(id)}/priority`, {
      method: "POST",
      body: JSON.stringify({ priority }),
    }),

  emergencyAction: (action: string) =>
    request<ActionResponse>("/emergency/" + encodeURIComponent(action), {
      method: "POST",
    }),

  macros: () => request<MacroConfig[]>("/macros"),

  automations: () => request<AutomationConfig[]>("/automations"),

  saveAutomation: (automation: AutomationConfig) =>
    request<{ ok: boolean; automation: AutomationConfig }>("/automations/" + encodeURIComponent(automation.id), {
      method: "PUT",
      body: JSON.stringify(automation),
    }),

  deleteAutomation: (id: string) =>
    request("/automations/" + encodeURIComponent(id), { method: "DELETE" }),

  runAutomation: (id: string) =>
    request<ActionResponse>("/automations/" + encodeURIComponent(id) + "/run", { method: "POST" }),

  automationRules: () => request<AutomationRule[]>("/automation-rules"),

  automationRuns: () => request<AutomationRun[]>("/automation-runs"),

  saveAutomationRule: (rule: AutomationRule) =>
    request<{ ok: boolean; rule: AutomationRule }>("/automation-rules/" + encodeURIComponent(rule.id), {
      method: "PUT",
      body: JSON.stringify(rule),
    }),

  deleteAutomationRule: (id: string) =>
    request("/automation-rules/" + encodeURIComponent(id), { method: "DELETE" }),

  runAutomationRule: (id: string) =>
    request<ActionResponse>("/automation-rules/" + encodeURIComponent(id) + "/run", { method: "POST" }),

  testAutomationRule: (id: string, event: TestStreamEvent) =>
    request<ActionResponse & { event: import("@btv/shared").StreamEvent }>("/automation-rules/" + encodeURIComponent(id) + "/test", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  testEvent: (event: TestStreamEvent) =>
    request<{ ok: boolean; event: import("@btv/shared").StreamEvent }>("/events/test", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  sourceGroups: () => request<SourceGroup[]>("/source-groups"),

  streamDeckSourceGroups: () => request<StreamDeckSourceGroupsStatus>("/stream-deck/source-groups"),

  saveSourceGroup: (group: SourceGroup) =>
    request<{ ok: boolean; group: SourceGroup }>("/source-groups/" + encodeURIComponent(group.id), {
      method: "PUT",
      body: JSON.stringify(group),
    }),

  captureSourceGroup: (id: string, sourceNames: string[]) =>
    request<{ ok: boolean; group: SourceGroup }>("/source-groups/" + encodeURIComponent(id) + "/capture", {
      method: "POST",
      body: JSON.stringify({ sourceNames }),
    }),

  deleteSourceGroup: (id: string) =>
    request("/source-groups/" + encodeURIComponent(id), { method: "DELETE" }),

  applySourceGroup: (id: string) =>
    request<ActionResponse>("/actions/source-group/" + encodeURIComponent(id), {
      method: "POST",
    }),

  saveMacro: (macro: MacroConfig) =>
    request("/macros/" + encodeURIComponent(macro.id), {
      method: "PUT",
      body: JSON.stringify(macro),
    }),

  deleteMacro: (id: string) =>
    request("/macros/" + encodeURIComponent(id), { method: "DELETE" }),

  runMacro: (id: string) =>
    request<MacroRunResponse>("/actions/macro/" + encodeURIComponent(id), {
      method: "POST",
    }),

  activity: () =>

    request<Array<{ id: string; event: import("@btv/shared").StreamEvent; at: string }>>(

      "/activity",

    ),

  replayActivityAlert: (id: string) =>
    request<{ ok: boolean; message: string; queue: AlertQueueInfo }>(`/activity/${encodeURIComponent(id)}/replay-alert`, {
      method: "POST",
    }),

  logs: () => request<SystemLogEntry[]>("/logs"),

  coreEvents: () => request<import("@btv/shared").BtvEvent[]>("/events"),

  dispatchEvent: (event: { type: string; payload?: unknown; metadata?: Record<string, unknown> }) =>
    request<{ ok: boolean; event: import("@btv/shared").BtvEvent }>("/events/dispatch", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  chatCommands: () => request<ChatCommand[]>("/chat-commands"),

  saveChatCommand: (command: ChatCommand) =>
    request<{ ok: boolean; command: ChatCommand }>(`/chat-commands/${encodeURIComponent(command.id)}`, {
      method: "PUT",
      body: JSON.stringify(command),
    }),

  deleteChatCommand: (id: string) =>
    request<{ ok: boolean }>(`/chat-commands/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  testChatCommand: (id: string) =>
    request<{ ok: boolean; message: string }>(`/chat-commands/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }),

  chatTimers: () => request<ChatTimer[]>("/chat-timers"),

  saveChatTimer: (timer: ChatTimer) =>
    request<{ ok: boolean; timer: ChatTimer }>(`/chat-timers/${encodeURIComponent(timer.id)}`, {
      method: "PUT",
      body: JSON.stringify(timer),
    }),

  deleteChatTimer: (id: string) =>
    request<{ ok: boolean }>(`/chat-timers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  testChatTimer: (id: string) =>
    request<{ ok: boolean; message: string }>(`/chat-timers/${encodeURIComponent(id)}/test`, {
      method: "POST",
    }),

  chatQuotes: () => request<ChatQuote[]>("/chat-quotes"),

  saveChatQuote: (quote: ChatQuote) =>
    request<{ ok: boolean; quote: ChatQuote }>(`/chat-quotes/${encodeURIComponent(quote.id)}`, {
      method: "PUT",
      body: JSON.stringify(quote),
    }),

  deleteChatQuote: (id: string) =>
    request<{ ok: boolean }>(`/chat-quotes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  useChatQuote: (id: string) =>
    request<{ ok: boolean; quote: ChatQuote }>(`/chat-quotes/${encodeURIComponent(id)}/use`, {
      method: "POST",
    }),

  loyaltyViewers: (limit = 100) =>
    request<{ viewers: LoyaltyViewer[] }>(`/loyalty/viewers?limit=${encodeURIComponent(String(limit))}`),

  adjustLoyaltyPoints: (id: string, delta: number) =>
    request<{ ok: boolean; viewer: LoyaltyViewer }>(`/loyalty/viewers/${encodeURIComponent(id)}/points`, {
      method: "POST",
      body: JSON.stringify({ mode: "adjust", delta }),
    }),

  setLoyaltyPoints: (id: string, points: number) =>
    request<{ ok: boolean; viewer: LoyaltyViewer }>(`/loyalty/viewers/${encodeURIComponent(id)}/points`, {
      method: "POST",
      body: JSON.stringify({ mode: "set", points }),
    }),

  viewerQueue: () => request<{ entries: ViewerQueueEntry[] }>("/viewer-queue"),

  addViewerQueueEntry: (entry: { userId?: string; login?: string; displayName: string; note?: string }) =>
    request<{ ok: boolean; entry: ViewerQueueEntry; position: number; alreadyQueued: boolean }>("/viewer-queue", {
      method: "POST",
      body: JSON.stringify(entry),
    }),

  removeViewerQueueEntry: (id: string) =>
    request<{ ok: boolean; entry: ViewerQueueEntry }>(`/viewer-queue/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  popViewerQueueEntry: () =>
    request<{ ok: boolean; entry: ViewerQueueEntry }>("/viewer-queue/next", {
      method: "POST",
    }),

  clearViewerQueue: () =>
    request<{ ok: boolean; cleared: number }>("/viewer-queue/clear", {
      method: "POST",
    }),

  giveaways: () => request<{ giveaways: Giveaway[]; active: Giveaway | null }>("/giveaways"),

  openGiveaway: (data: { name: string; keyword?: string }) =>
    request<{ ok: boolean; giveaway: Giveaway }>("/giveaways/open", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  closeGiveaway: (id: string) =>
    request<{ ok: boolean; giveaway: Giveaway }>(`/giveaways/${encodeURIComponent(id)}/close`, {
      method: "POST",
    }),

  addGiveawayEntry: (id: string, entry: { userId?: string; login?: string; displayName: string }) =>
    request<{ ok: boolean; giveaway: Giveaway; entry: GiveawayEntry; alreadyEntered: boolean; position: number }>(
      `/giveaways/${encodeURIComponent(id)}/entries`,
      {
        method: "POST",
        body: JSON.stringify(entry),
      },
    ),

  removeGiveawayEntry: (entryId: string) =>
    request<{ ok: boolean; entry: GiveawayEntry }>(`/giveaways/entries/${encodeURIComponent(entryId)}`, {
      method: "DELETE",
    }),

  pickGiveawayWinner: (id: string) =>
    request<{ ok: boolean; giveaway: Giveaway; winner: GiveawayEntry }>(`/giveaways/${encodeURIComponent(id)}/pick`, {
      method: "POST",
    }),

  announceGiveawayWinner: (id: string) =>
    request<{ ok: boolean; giveaway: Giveaway; winner: GiveawayEntry }>(`/giveaways/${encodeURIComponent(id)}/announce`, {
      method: "POST",
    }),

  clearGiveawayEntries: (id: string) =>
    request<{ ok: boolean; cleared: number }>(`/giveaways/${encodeURIComponent(id)}/clear`, {
      method: "POST",
    }),

  miniGameRuns: (limit = 25) =>
    request<{ runs: MiniGameRun[] }>(`/mini-games/runs?limit=${encodeURIComponent(String(limit))}`),

  testVisualAlert: async (eventType: string) => {
    const result = await request(`/test/alert/${eventType}`, { method: "POST" });
    emitTestAlertSuccess(eventType);
    return result;
  },

  integrations: () => request<IntegrationsInfo>("/integrations"),

  localCommandSecurity: () => request<LocalCommandSecurityResponse>("/security/local-commands"),

  approveLocalCommand: (command: LocalCommandApprovalInput) =>
    request<{ ok: boolean; approval: LocalCommandApproval }>("/security/local-commands/approve", {
      method: "POST",
      body: JSON.stringify(command),
    }),

  revokeLocalCommand: (id: string) =>
    request<{ ok: boolean }>(`/security/local-commands/${encodeURIComponent(id)}`, { method: "DELETE" }),

  saveOAuthHost: (host: string) =>

    request("/integrations/oauth-host", {

      method: "PUT",

      body: JSON.stringify({ host }),

    }),

  saveTwitchConfig: (clientId: string, clientSecret?: string) =>
    request("/integrations/twitch", {
      method: "PUT",
      body: JSON.stringify({
        clientId,
        ...(clientSecret ? { clientSecret } : {}),
      }),
    }),

  saveSpotifyConfig: (clientId: string, clientSecret?: string) =>
    request("/integrations/spotify", {
      method: "PUT",
      body: JSON.stringify({
        clientId,
        ...(clientSecret ? { clientSecret } : {}),
      }),
    }),

  saveGiphyConfig: (apiKey?: string) =>
    request<{ ok: boolean; configured: boolean }>("/integrations/giphy", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    }),

  saveObsConfig: (host: string, port: number, password?: string) =>
    request("/integrations/obs", {
      method: "PUT",
      body: JSON.stringify({
        host,
        port,
        ...(password ? { password } : {}),
      }),
    }),

  obsScenes: () => request<ObsScenesResponse>("/obs/scenes"),

  obsSceneSources: (sceneName: string) =>
    request<ObsSceneSourcesResponse>(`/obs/scenes/${encodeURIComponent(sceneName)}/sources`),

  setObsScene: (sceneName: string) =>
    request<ActionResponse>("/actions/obs/scene", {
      method: "POST",
      body: JSON.stringify({ sceneName }),
    }),

  setObsSourceVisible: (sceneName: string, sourceName: string, visible: boolean) =>
    request<ActionResponse>("/actions/obs/source-visibility", {
      method: "POST",
      body: JSON.stringify({ sceneName, sourceName, visible }),
    }),

  runObsSourceMotion: (config: ObsSourceMotionConfig) =>
    request<ActionResponse>("/actions/obs/source-motion", {
      method: "POST",
      body: JSON.stringify(config),
    }),

  setObsText: (inputName: string, text: string) =>
    request<ActionResponse>("/actions/obs/text", {
      method: "POST",
      body: JSON.stringify({ inputName, text }),
    }),

  disconnectTwitch: () =>

    request("/integrations/twitch/disconnect", { method: "POST" }),

  disconnectSpotify: () =>

    request("/integrations/spotify/disconnect", { method: "POST" }),

  listSounds: () => request<{ sounds: SoundAssetInfo[] }>("/assets/sounds"),

  uploadSound: (name: string, data: string) =>
    request<{ name: string; url: string }>("/assets/sounds", {
      method: "POST",
      body: JSON.stringify({ name, data }),
    }),

  deleteSound: (name: string) =>
    request(`/assets/sounds/${encodeURIComponent(name)}`, { method: "DELETE" }),

  listMedia: () => request<{ media: MediaAssetInfo[] }>("/assets/media"),

  uploadMedia: (name: string, data: string) =>
    request<{ name: string; url: string; kind: string }>("/assets/media", {
      method: "POST",
      body: JSON.stringify({ name, data }),
    }),

  deleteMedia: (name: string) =>
    request(`/assets/media/${encodeURIComponent(name)}`, { method: "DELETE" }),

  giphySearch: (q: string, type: GiphyAssetType = "gif") =>
    request<{ results: GiphyResult[] }>(`/assets/giphy/search?q=${encodeURIComponent(q)}&limit=12&type=${type}`),

  giphyTrending: (type: GiphyAssetType = "gif") =>
    request<{ results: GiphyResult[] }>(`/assets/giphy/trending?limit=12&type=${type}`),

  importGiphy: (gif: Pick<GiphyResult, "id" | "title" | "originalUrl" | "sourceUrl" | "username" | "type">) =>
    request<{ name: string; url: string; kind: "gif"; size: number; source: string; sourceId: string; sourceType: GiphyAssetType }>("/assets/giphy/import", {
      method: "POST",
      body: JSON.stringify(gif),
    }),

  tournamentScoreboard: () => request<TournamentScoreboardState>("/tournament-scoreboard"),

  saveTournamentScoreboard: (scoreboard: TournamentScoreboardState) =>
    request<TournamentScoreboardState>("/tournament-scoreboard", {
      method: "PUT",
      body: JSON.stringify(scoreboard),
    }),

  resetTournamentScoreboard: () =>
    request<TournamentScoreboardState>("/tournament-scoreboard/reset", { method: "POST" }),

  prediction: () => request<PredictionState>("/predictions"),

  savePrediction: (prediction: PredictionState) =>
    request<PredictionState>("/predictions", {
      method: "PUT",
      body: JSON.stringify(prediction),
    }),

  resetPrediction: () =>
    request<PredictionState>("/predictions/reset", { method: "POST" }),

  votePredictionOption: (optionId: string) =>
    request<PredictionState>(`/predictions/options/${encodeURIComponent(optionId)}/vote`, { method: "POST" }),

  revealPredictionWinner: (optionId: string) =>
    request<PredictionState>(`/predictions/options/${encodeURIComponent(optionId)}/winner`, { method: "POST" }),

  bossFight: () => request<BossFightState>("/boss-fight"),

  saveBossFight: (boss: BossFightState) =>
    request<BossFightState>("/boss-fight", {
      method: "PUT",
      body: JSON.stringify(boss),
    }),

  resetBossFight: () =>
    request<BossFightState>("/boss-fight/reset", { method: "POST" }),

  damageBossFight: (amount: number) =>
    request<BossFightState>("/boss-fight/damage", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  healBossFight: (amount: number) =>
    request<BossFightState>("/boss-fight/heal", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  chatChaos: () => request<ChatChaosState>("/chat-chaos"),

  saveChatChaos: (chaos: ChatChaosState) =>
    request<ChatChaosState>("/chat-chaos", {
      method: "PUT",
      body: JSON.stringify(chaos),
    }),

  resetChatChaos: () =>
    request<ChatChaosState>("/chat-chaos/reset", { method: "POST" }),

  adjustChatChaos: (amount: number) =>
    request<ChatChaosState>("/chat-chaos/adjust", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

};



export interface SoundAssetInfo {
  name: string;
  url: string;
  size: number;
  metadata?: AssetSourceMetadata;
}

export interface MediaAssetInfo {
  name: string;
  url: string;
  size: number;
  kind: "video" | "image" | "gif";
  metadata?: AssetSourceMetadata;
}

export interface OverlayInfo {

  id: string;

  name: string;

  url: string;

  channels: string[];

}



export type WebhookInfo = import("@btv/shared").WebhookHook & {
  url: string;
};

export interface ActionResponse {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  color: string;
  icon: string;
  retryable?: boolean;
  state?: Record<string, unknown>;
}

export interface GiphyResult {
  id: string;
  type: GiphyAssetType;
  title: string;
  url: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  sourceUrl?: string;
  username?: string;
}

export type GiphyAssetType = "gif" | "sticker";

export interface TournamentScoreboardTeam {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface TournamentScoreboardState {
  title: string;
  subtitle: string;
  bestOf: number;
  visible: boolean;
  teams: TournamentScoreboardTeam[];
  updatedAt: string;
}

export interface PredictionOption {
  id: string;
  label: string;
  votes: number;
  color: string;
  isWinner: boolean;
}

export interface PredictionState {
  title: string;
  prompt: string;
  status: "draft" | "open" | "locked" | "revealed";
  visible: boolean;
  options: PredictionOption[];
  updatedAt: string;
}

export interface BossFightState {
  name: string;
  subtitle: string;
  maxHp: number;
  currentHp: number;
  shield: number;
  phase: number;
  visible: boolean;
  enraged: boolean;
  color: string;
  updatedAt: string;
}

export interface ChatChaosState {
  title: string;
  subtitle: string;
  level: number;
  threshold: number;
  decayPerMinute: number;
  visible: boolean;
  color: string;
  updatedAt: string;
  status: "calm" | "building" | "chaotic" | "meltdown";
}

export interface AssetSourceMetadata {
  source?: "upload" | "giphy";
  sourceType?: GiphyAssetType;
  sourceId?: string;
  sourceUrl?: string;
  title?: string;
  username?: string;
  importedAt?: string;
}

export type MacroStep =
  | { type: "wait"; durationMs: number }
  | { type: "obs_scene"; sceneName: string }
  | { type: "obs_source_visibility"; sceneName: string; sourceName: string; visible: boolean }
  | ({ type: "obs_source_motion" } & ObsSourceMotionConfig)
  | { type: "obs_text"; inputName: string; text: string }
  | { type: "obs_stream_start" }
  | { type: "obs_stream_stop" }
  | { type: "obs_record_start" }
  | { type: "obs_record_stop" }
  | { type: "obs_record_pause" }
  | { type: "obs_record_resume" }
  | { type: "obs_replay_buffer_start" }
  | { type: "obs_replay_buffer_stop" }
  | { type: "obs_replay_buffer_save" }
  | { type: "obs_filter"; sourceName: string; filterName: string; enabled: boolean }
  | { type: "twitch_chat"; message: string }
  | { type: "run_command"; command: string; args?: string[]; cwd?: string; timeoutMs?: number; successChatMessage?: string }
  | { type: "effect"; effectId: string }
  | { type: "clear_alerts" }
  | { type: "session_start"; title?: string }
  | { type: "session_stop" };

export interface MacroConfig {
  id: string;
  name: string;
  enabled: boolean;
  steps: MacroStep[];
}

export type AutomationAction = "macro" | "effect" | "source_group" | "command" | "twitch_chat";

export interface AutomationConfig {
  id: string;
  name: string;
  enabled: boolean;
  intervalMs: number;
  action: AutomationAction;
  actionConfig: Record<string, unknown>;
  runOnStart: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  lastStatus?: "ok" | "failed" | "running";
  lastMessage?: string;
}

export type AutomationRule = import("@btv/shared").AutomationRule;
export type AutomationTrigger = import("@btv/shared").AutomationTrigger;
export type AutomationCondition = import("@btv/shared").AutomationCondition;
export type AutomationActionConfig = import("@btv/shared").AutomationActionConfig;

export interface AutomationRun {
  id: string;
  rule_id: string;
  event_id: string | null;
  status: string;
  message: string;
  created_at: string;
}

export interface TestStreamEvent {
  type?: import("@btv/shared").StreamEventType;
  user?: { id?: string; login?: string; displayName?: string };
  message?: string;
  amount?: number;
  payload?: Record<string, unknown>;
}

export interface MacroRunResponse extends ActionResponse {
  steps: Array<{
    index: number;
    type: MacroStep["type"];
    ok: boolean;
    message: string;
  }>;
}

export interface ObsSceneInfo {
  sceneName: string;
  sceneIndex?: number;
}

export interface ObsSourceInfo {
  sourceName: string;
  sceneItemId: number;
  sceneItemEnabled: boolean;
}

export interface ObsScenesResponse {
  ok: boolean;
  currentScene: string | null;
  scenes: ObsSceneInfo[];
}

export interface ObsSceneSourcesResponse {
  ok: boolean;
  sceneName: string;
  sources: ObsSourceInfo[];
}

export interface ObsMotionPoint {
  x: number;
  y: number;
  scale?: number;
}

export interface ObsSourceMotionConfig {
  sceneName: string;
  sourceName: string;
  mode?: "set" | "dvd" | "path";
  durationMs?: number;
  fps?: number;
  visible?: boolean;
  restore?: boolean;
  boundsWidth?: number;
  boundsHeight?: number;
  speedX?: number;
  speedY?: number;
  randomizeStart?: boolean;
  x?: number;
  y?: number;
  scale?: number;
  width?: number;
  height?: number;
  path?: ObsMotionPoint[];
}

export interface SourceGroupSource {
  sourceName: string;
  transform?: Record<string, unknown>;
}

export interface SourceGroup {
  id: string;
  name: string;
  sceneName: string;
  sources: SourceGroupSource[];
  updatedAt: string;
}

export interface StreamDeckSourceGroupsStatus {
  ok: boolean;
  title: string;
  color: string;
  icon: string;
  activeId?: string;
  groups: Array<{
    id: string;
    name: string;
    sceneName: string;
    sourceCount: number;
    active: boolean;
    url: string;
    color: string;
    icon: string;
  }>;
}

export interface SystemLogEntry {
  id: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AlertQueueInfo {
  playing: boolean;
  paused: boolean;
  queued: number;
  current: {
    id: string;
    priority: number;
    channel: string;
    eventType: string;
    user?: string;
    startedAt: string | null;
    durationMs: number;
  } | null;
  next: Array<{
    id: string;
    priority: number;
    channel: string;
    eventType: string;
    user?: string;
  }>;
}

export interface PreflightInfo {
  ok: boolean;
  generatedAt: string;
  checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  overlays: {
    clientCount: number;
    channels: Record<string, number>;
    clients: Array<{
      id: string;
      channels: string[];
      route?: string;
      connectedAt: string;
      lastHeartbeatAt: string;
      status: "connected" | "stale";
    }>;
  };
  expectedOverlays: Array<{
    id: string;
    label: string;
    name: string;
    route: string;
    url: string;
    channels: string[];
    reachable: boolean;
    obsSource?: ObsBrowserSourceStatus;
  }>;
  alertProjects: {
    errors: number;
    warnings: number;
    projects: Array<{
      id: string;
      name: string;
      eventType: string;
      errors: number;
      warnings: number;
      issues: Array<{ level: "error" | "warning"; message: string }>;
    }>;
  };
  emergency: {
    automationsDisabled: boolean;
    channelPointActionsDisabled: boolean;
  };
  alerts: AlertQueueInfo;
  twitch: IntegrationStatus;
  spotify: IntegrationStatus;
  obs: { host: string; port: number; hasPassword: boolean; connected: boolean };
  activity: Array<{ id: string; event: import("@btv/shared").StreamEvent; at: string }>;
  session: StreamSessionSummary;
}

export interface IntegrationStatus {
  configured?: boolean;
  connected?: boolean;
  login?: string;
  displayName?: string;
  eventsubStatus?: string;
  userId?: string;
  scopes?: string[];
  chatSubscribed?: boolean;
  chat?: TwitchChatStatus;
}

export interface TwitchChatStatus {
  status: "offline" | "pending" | "connected" | "error";
  connected: boolean;
  canRead: boolean;
  canWrite: boolean;
  detail: string;
}

export interface ChatCommand {
  id: string;
  command: string;
  aliases: string[];
  permission: "everyone" | "subscriber" | "vip" | "moderator" | "broadcaster";
  enabled: boolean;
  cooldownMs: number;
  response: string;
  responses: string[];
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatTimer {
  id: string;
  name: string;
  enabled: boolean;
  intervalMs: number;
  message: string;
  responses: string[];
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatQuote {
  id: string;
  quoteNumber: number;
  text: string;
  author?: string;
  addedBy?: string;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyViewer {
  id: string;
  login?: string;
  displayName: string;
  points: number;
  lifetimePoints: number;
  chatMessages: number;
  lastEarnedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ViewerQueueEntry {
  id: string;
  userId: string;
  login?: string;
  displayName: string;
  note?: string;
  joinedAt: string;
  updatedAt: string;
}

export interface GiveawayEntry {
  id: string;
  giveawayId: string;
  userId: string;
  login?: string;
  displayName: string;
  enteredAt: string;
}

export interface Giveaway {
  id: string;
  name: string;
  keyword: string;
  status: "open" | "closed";
  winnerEntryId?: string;
  createdAt: string;
  updatedAt: string;
  entries: GiveawayEntry[];
  winner?: GiveawayEntry;
}

export interface MiniGameRun {
  id: string;
  game: string;
  userId: string;
  login?: string;
  displayName: string;
  wager: number;
  outcome: "win" | "lose" | "tie" | "play";
  pointsDelta: number;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface HealthInfo {
  ok: boolean;
  overlayUrl?: string;
  overlayWsUrl?: string;
  twitch: IntegrationStatus;
  spotify?: IntegrationStatus;
  obs?: { host?: string; port?: number; hasPassword?: boolean; connected?: boolean };
}

export interface ObsBrowserSourceStatus {
  id: string;
  label: string;
  route: string;
  expectedUrl: string;
  configured: boolean;
  correctUrl: boolean;
  sourceName?: string;
  currentUrl?: string;
  action?: "created" | "updated" | "linked" | "unchanged" | "failed";
}

export interface OverlayPackSummary {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  counts: {
    alertProjects: number;
    alertRules: number;
    themes: number;
    widgets: number;
    browserSourceLayouts: number;
    overlayTheme: boolean;
  };
}

export interface OverlayPackExport {
  format: "btv.overlay-pack";
  version: 1;
  exportedAt: string;
  pack: {
    id: string;
    name: string;
    description?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    snapshot: unknown;
  };
}

export interface OverlayThemeConfig {
  name: string;
  fontFamily: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  panelBackground: string;
  itemBackground: string;
  borderColor: string;
  borderRadius: number;
  shadow: number;
  glow: number;
  pulse: boolean;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  widgets: Record<OverlayThemeTarget, OverlayThemeWidgetConfig>;
}

export type OverlayThemeTarget = "alerts" | "chat" | "goals" | "ticker" | "eventList" | "nowPlaying";

export interface OverlayThemeWidgetConfig {
  enabled: boolean;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  panelBackground?: string;
  itemBackground?: string;
  borderColor?: string;
  borderRadius?: number;
  shadow?: number;
  glow?: number;
  pulse?: boolean;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
}

export type ObsBrowserSourceShape = "rectangle" | "rounded" | "circle";

export interface ObsBrowserSourceLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: ObsBrowserSourceShape;
  borderRadius: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ObsBrowserSourceCanvas {
  width: number;
  height: number;
}

export interface ObsBrowserSourceLayoutsResponse {
  ok: boolean;
  canvas: ObsBrowserSourceCanvas;
  layouts: ObsBrowserSourceLayout[];
}

export interface ObsBrowserSourceLayoutsApplyResponse extends ObsBrowserSourceLayoutsResponse {
  sceneName: string;
  sources: Array<ObsBrowserSourceStatus & {
    layout?: ObsBrowserSourceLayout;
    layoutApplied?: boolean;
  }>;
}

export interface StreamSession {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
}

export interface StreamSessionSummary {
  session: StreamSession | null;
  durationMs: number;
  totals: {
    events: number;
    follows: number;
    subs: number;
    cheers: number;
    raids: number;
    channelPoints: number;
    chatMessages: number;
  };
  eventsByType: Array<{
    eventType: string;
    count: number;
    amount: number;
  }>;
  sceneSpans: Array<{
    sceneName: string;
    startedAt: string;
    endedAt: string | null;
    durationMs: number;
  }>;
}

export interface SessionEventRow {
  id: string;
  event_type: string;
  source: string;
  user_login: string | null;
  user_display_name: string | null;
  amount: number | null;
  created_at: string;
}

export interface SceneSpanRow {
  id: string;
  scene_name: string;
  started_at: string;
  ended_at: string | null;
}

export interface StreamSessionDetail {
  summary: StreamSessionSummary;
  events: SessionEventRow[];
  sceneSpans: SceneSpanRow[];
}

export interface StreamRecap {
  summary: StreamSessionSummary;
  events: SessionEventRow[];
  sceneSpans: SceneSpanRow[];
  generatedAt: string;
  highlights: string[];
  topEvents: StreamSessionSummary["eventsByType"];
  topScenes: StreamSessionSummary["sceneSpans"];
  supporters: Array<{
    name: string;
    events: number;
    amount: number;
  }>;
  markdown: string;
}

export interface LocalCommandApproval {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  createdAt: string;
  label?: string;
}

export interface LocalCommandRequest extends LocalCommandApproval {
  approved: boolean;
  sourceType: "macro" | "effect";
  sourceId: string;
  sourceName: string;
}

export interface LocalCommandSecurityResponse {
  approvals: LocalCommandApproval[];
  requests: LocalCommandRequest[];
}

export interface LocalCommandApprovalInput {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  label?: string;
}



export interface IntegrationsInfo {

  oauthHost?: string;

  twitch: {

    configured: boolean;

    connected: boolean;

    login?: string;

    displayName?: string;

    clientId?: string;

    redirectUri: string;

    authStartUrl: string;

    hasClientSecret: boolean;

    eventsubStatus?: string;

    chatSubscribed?: boolean;

    scopes?: string[];

    chat?: TwitchChatStatus;

  };

  spotify: {

    configured: boolean;

    connected: boolean;

    clientId?: string;

    hasClientSecret?: boolean;

    redirectUri: string;

    authStartUrl: string;

  };

  obs: { host: string; port: number; hasPassword: boolean; connected: boolean };

  giphy?: { configured: boolean };

}

