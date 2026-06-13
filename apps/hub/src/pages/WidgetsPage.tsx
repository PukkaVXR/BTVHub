import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { WidgetConfig } from "@btv/shared";
import { api, type OverlayThemeConfig, type OverlayThemeTarget, type OverlayThemeWidgetConfig } from "../api";
import MediaPicker from "../components/MediaPicker";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";
import { resolveOverlayOrigin } from "../lib/serverUrls";
import { Button, ButtonAnchor, Callout, Card, CardHeader, PageHeader, StatusPill } from "../ui";

const TICKER_EVENT_TYPES = ["follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points", "chat", "goal_milestone"];
const DEFAULT_OVERLAY_THEME: OverlayThemeConfig = {
  name: "BTV Default",
  fontFamily: '"Segoe UI", system-ui, sans-serif',
  textColor: "#ffffff",
  mutedColor: "rgba(255,255,255,0.72)",
  accentColor: "#9147ff",
  panelBackground: "rgba(0,0,0,0.6)",
  itemBackground: "rgba(255,255,255,0.07)",
  borderColor: "rgba(255,255,255,0.12)",
  borderRadius: 12,
  shadow: 35,
  glow: 0,
  pulse: false,
  backgroundImage: "",
  backgroundOpacity: 0.18,
  backgroundBlur: 0,
  widgets: {
    alerts: { enabled: true },
    chat: { enabled: true },
    goals: { enabled: true },
    ticker: { enabled: true },
    eventList: { enabled: true },
    nowPlaying: { enabled: true },
  },
};
type ParsedColor = { color: string; alpha: number };

const THEME_TARGETS: Array<{ id: OverlayThemeTarget; label: string }> = [
  { id: "alerts", label: "Alerts" },
  { id: "chat", label: "Chat" },
  { id: "goals", label: "Goals" },
  { id: "ticker", label: "Ticker" },
  { id: "eventList", label: "Event list" },
  { id: "nowPlaying", label: "Now playing" },
];
const THEME_PRESETS: Array<{ name: string; description: string; theme: OverlayThemeConfig }> = [
  {
    name: "Neon Arcade",
    description: "Electric purple glow with high contrast panels.",
    theme: {
      ...DEFAULT_OVERLAY_THEME,
      name: "Neon Arcade",
      accentColor: "#8b5cf6",
      panelBackground: "rgba(8, 10, 24, 0.78)",
      itemBackground: "rgba(139, 92, 246, 0.16)",
      borderColor: "rgba(139, 92, 246, 0.5)",
      glow: 26,
      pulse: true,
    },
  },
  {
    name: "Clean Broadcast",
    description: "Readable, restrained, and production-friendly.",
    theme: {
      ...DEFAULT_OVERLAY_THEME,
      name: "Clean Broadcast",
      accentColor: "#5b8cff",
      panelBackground: "rgba(8, 12, 18, 0.72)",
      itemBackground: "rgba(255, 255, 255, 0.08)",
      borderColor: "rgba(255, 255, 255, 0.14)",
      borderRadius: 8,
      shadow: 28,
      glow: 0,
      pulse: false,
    },
  },
  {
    name: "Cozy Soft",
    description: "Warm muted cards for relaxed streams.",
    theme: {
      ...DEFAULT_OVERLAY_THEME,
      name: "Cozy Soft",
      accentColor: "#f59e0b",
      textColor: "#fff8ed",
      mutedColor: "rgba(255, 238, 210, 0.72)",
      panelBackground: "rgba(42, 30, 22, 0.72)",
      itemBackground: "rgba(255, 210, 150, 0.13)",
      borderColor: "rgba(255, 210, 150, 0.25)",
      borderRadius: 18,
      shadow: 30,
      glow: 8,
    },
  },
  {
    name: "Horror Signal",
    description: "Dark red, sharp, and glitch-friendly.",
    theme: {
      ...DEFAULT_OVERLAY_THEME,
      name: "Horror Signal",
      accentColor: "#ff304f",
      mutedColor: "rgba(255, 190, 198, 0.68)",
      panelBackground: "rgba(8, 2, 6, 0.82)",
      itemBackground: "rgba(255, 48, 79, 0.13)",
      borderColor: "rgba(255, 48, 79, 0.42)",
      borderRadius: 4,
      shadow: 58,
      glow: 18,
      pulse: true,
    },
  },
];

type WidgetPanel = "theme" | "overrides" | "goals" | `widget:${string}`;

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [overlayTheme, setOverlayTheme] = useState<OverlayThemeConfig>(DEFAULT_OVERLAY_THEME);
  const [goals, setGoals] = useState<
    Array<{ id: string; label: string; current_count: number; target_count: number }>
  >([]);
  const [selectedPanel, setSelectedPanel] = useState<WidgetPanel>("theme");
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.widgets(), api.goals(), api.overlayTheme()]).then(([w, g, theme]) => {
      setWidgets(w);
      setGoals(g);
      setOverlayTheme(theme);
      setHydrated(true);
    });
  };

  useEffect(() => load(), []);

  const persistWidgets = useCallback(async (ws: WidgetConfig[]) => {
    for (const w of ws) {
      await api.saveWidget(w);
    }
  }, []);

  const widgetSaveStatus = useAutoSave(widgets, persistWidgets, { enabled: hydrated });
  const persistOverlayTheme = useCallback(async (theme: OverlayThemeConfig) => {
    await api.saveOverlayTheme(theme);
  }, []);
  const themeSaveStatus = useAutoSave(overlayTheme, persistOverlayTheme, { enabled: hydrated });

  const updateTheme = (patch: Partial<OverlayThemeConfig>) => {
    setOverlayTheme((current) => ({ ...current, ...patch }));
  };

  const applyPreset = (preset: OverlayThemeConfig) => {
    setOverlayTheme((current) => ({
      ...preset,
      backgroundImage: current.backgroundImage,
      widgets: mergeWidgetThemes(preset.widgets, current.widgets),
    }));
  };

  const updateWidgetTheme = (target: OverlayThemeTarget, patch: Partial<OverlayThemeWidgetConfig>) => {
    setOverlayTheme((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        [target]: { ...(current.widgets[target] ?? { enabled: true }), ...patch },
      },
    }));
  };

  const saveGoal = async (id: string, target: number, current: number, label: string) => {
    try {
      await api.saveGoal(id, { target, current, label });
      toast("Goal updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed");
    }
  };

  const overlayOrigin = resolveOverlayOrigin();

  return (
    <>
      <PageHeader title="Widgets" description="Configure chat, goals, ticker, and now playing widgets." />
      <SaveIndicator status={widgetSaveStatus} label="Widgets" />
      <SaveIndicator status={themeSaveStatus} label="Widget theme" />

      <div className="widgets-workspace">
        <aside className="widgets-sidebar" aria-label="Widget sections">
          <button type="button" className={selectedPanel === "theme" ? "active" : ""} onClick={() => setSelectedPanel("theme")}>
            <span>Theme pack</span>
            <small>Global style</small>
          </button>
          <button type="button" className={selectedPanel === "overrides" ? "active" : ""} onClick={() => setSelectedPanel("overrides")}>
            <span>Overrides</span>
            <small>Per widget style</small>
          </button>
          {widgets.map((widget) => (
            <button
              key={widget.id}
              type="button"
              className={selectedPanel === `widget:${widget.id}` ? "active" : ""}
              onClick={() => setSelectedPanel(`widget:${widget.id}`)}
            >
              <span>{formatWidgetLabel(widget)}</span>
              <small>{widget.enabled ? "Enabled" : "Disabled"}</small>
            </button>
          ))}
          <button type="button" className={selectedPanel === "goals" ? "active" : ""} onClick={() => setSelectedPanel("goals")}>
            <span>Follower goal</span>
            <small>{goals.length} goal{goals.length === 1 ? "" : "s"}</small>
          </button>
        </aside>

        <main className="widgets-detail">
      {(selectedPanel === "theme" || selectedPanel === "overrides") && (
      <Card
        className="overlay-theme-editor"
        hideableId={selectedPanel === "theme" ? "overlay-theme-pack" : "overlay-theme-overrides"}
        hideableTitle={selectedPanel === "theme" ? "Overlay Theme Pack" : "Individual Overlay Theme Overrides"}
      >
        <CardHeader
          title={selectedPanel === "theme" ? "Overlay Theme Pack" : "Individual Overlay Theme Overrides"}
          description={selectedPanel === "theme"
            ? "Customise the shared look of chat, goals, ticker, event list, and now-playing overlays."
            : "Tune individual widget styles without changing the OBS source position or size."}
        />
        {selectedPanel === "theme" && (
          <>
        <div className="theme-preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="theme-preset-card"
              onClick={() => applyPreset(preset.theme)}
              style={themePreviewStyle(preset.theme)}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div className="form-row">
            <label>Theme name</label>
            <input value={overlayTheme.name} onChange={(e) => updateTheme({ name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Font family</label>
            <input value={overlayTheme.fontFamily} onChange={(e) => updateTheme({ fontFamily: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Text</label>
            <ColorAlphaControl label="Text" value={overlayTheme.textColor} fallback="#ffffff" onChange={(textColor) => updateTheme({ textColor })} />
          </div>
          <div className="form-row">
            <label>Accent</label>
            <ColorAlphaControl label="Accent" value={overlayTheme.accentColor} fallback="#9147ff" onChange={(accentColor) => updateTheme({ accentColor })} />
          </div>
          <div className="form-row">
            <label>Muted text</label>
            <ColorAlphaControl label="Muted text" value={overlayTheme.mutedColor} fallback="#ffffff" onChange={(mutedColor) => updateTheme({ mutedColor })} />
          </div>
          <div className="form-row">
            <label>Panel background</label>
            <ColorAlphaControl label="Panel background" value={overlayTheme.panelBackground} fallback="#000000" onChange={(panelBackground) => updateTheme({ panelBackground })} />
          </div>
          <div className="form-row">
            <label>Item background</label>
            <ColorAlphaControl label="Item background" value={overlayTheme.itemBackground} fallback="#ffffff" onChange={(itemBackground) => updateTheme({ itemBackground })} />
          </div>
          <div className="form-row">
            <label>Border colour</label>
            <ColorAlphaControl label="Border colour" value={overlayTheme.borderColor} fallback="#ffffff" onChange={(borderColor) => updateTheme({ borderColor })} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div className="form-row">
            <label>Corner radius ({overlayTheme.borderRadius}px)</label>
            <input type="range" min={0} max={48} value={overlayTheme.borderRadius} onChange={(e) => updateTheme({ borderRadius: Number(e.target.value) })} />
          </div>
          <div className="form-row">
            <label>Drop shadow ({overlayTheme.shadow}%)</label>
            <input type="range" min={0} max={90} value={overlayTheme.shadow} onChange={(e) => updateTheme({ shadow: Number(e.target.value) })} />
          </div>
          <div className="form-row">
            <label>Border glow ({overlayTheme.glow}px)</label>
            <input type="range" min={0} max={90} value={overlayTheme.glow} onChange={(e) => updateTheme({ glow: Number(e.target.value) })} />
          </div>
          <div className="form-row">
            <label>Background opacity ({Math.round(overlayTheme.backgroundOpacity * 100)}%)</label>
            <input type="range" min={0} max={1} step={0.05} value={overlayTheme.backgroundOpacity} onChange={(e) => updateTheme({ backgroundOpacity: Number(e.target.value) })} />
          </div>
          <div className="form-row">
            <label>Background blur ({overlayTheme.backgroundBlur}px)</label>
            <input type="range" min={0} max={40} value={overlayTheme.backgroundBlur} onChange={(e) => updateTheme({ backgroundBlur: Number(e.target.value) })} />
          </div>
          <label style={{ alignSelf: "center", marginTop: 16 }}>
            <input type="checkbox" checked={overlayTheme.pulse} onChange={(e) => updateTheme({ pulse: e.target.checked })} />{" "}
            Subtle pulse animation
          </label>
        </div>

        <div className="form-row">
          <label>Overlay background image</label>
          <MediaPicker value={overlayTheme.backgroundImage.replace(/^\/assets\//, "")} onChange={(path) => updateTheme({ backgroundImage: path ? `/assets/${path}` : "" })} />
          {overlayTheme.backgroundImage && (
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => updateTheme({ backgroundImage: "" })}>
              Remove background image
            </button>
          )}
        </div>

        <div className="overlay-theme-preview" style={themePreviewStyle(overlayTheme)}>
          <div>
            <strong>Preview: {overlayTheme.name || "Overlay theme"}</strong>
            <span>Chat, goals, ticker, event list, and now-playing will inherit this style.</span>
          </div>
          <div className="overlay-theme-preview-pill">Accent</div>
        </div>

        <div className="actions">
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setOverlayTheme(DEFAULT_OVERLAY_THEME)}>
            Reset theme
          </button>
        </div>
          </>
        )}

        {selectedPanel === "overrides" && (
        <details className="alert-compact-section" open>
          <summary>Individual Overlay Theme Overrides</summary>
          <div className="overlay-widget-theme-grid">
            {THEME_TARGETS.map((target) => {
              const item = overlayTheme.widgets[target.id] ?? { enabled: true };
              const canCustomizeText = target.id !== "chat";
              return (
                <Card
                  key={target.id}
                  className="overlay-widget-theme-card"
                  hideableId={`theme-override-${target.id}`}
                  hideableTitle={`Theme ${target.label}`}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={item.enabled !== false}
                      onChange={(e) => updateWidgetTheme(target.id, { enabled: e.target.checked })}
                    />{" "}
                    Theme {target.label}
                  </label>
                  {!canCustomizeText && (
                    <p className="theme-card-note">
                      Chat names use Twitch colours and badges, so text colour overrides are disabled for chat.
                    </p>
                  )}
                  <div className="overlay-widget-theme-fields">
                    {canCustomizeText && (
                      <div className="form-row">
                        <label>Text</label>
                        <ColorAlphaControl
                          label="Text"
                          value={item.textColor ?? overlayTheme.textColor}
                          fallback="#ffffff"
                          onChange={(textColor) => updateWidgetTheme(target.id, { textColor })}
                        />
                      </div>
                    )}
                    <div className="form-row">
                      <label>Accent</label>
                      <ColorAlphaControl
                        label="Accent"
                        value={item.accentColor ?? overlayTheme.accentColor}
                        fallback="#9147ff"
                        onChange={(accentColor) => updateWidgetTheme(target.id, { accentColor })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Panel</label>
                      <ColorAlphaControl
                        label="Panel"
                        value={item.panelBackground ?? overlayTheme.panelBackground}
                        fallback="#000000"
                        onChange={(panelBackground) => updateWidgetTheme(target.id, { panelBackground })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Item</label>
                      <ColorAlphaControl
                        label="Item"
                        value={item.itemBackground ?? overlayTheme.itemBackground}
                        fallback="#ffffff"
                        onChange={(itemBackground) => updateWidgetTheme(target.id, { itemBackground })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Border</label>
                      <ColorAlphaControl
                        label="Border"
                        value={item.borderColor ?? overlayTheme.borderColor}
                        fallback="#ffffff"
                        onChange={(borderColor) => updateWidgetTheme(target.id, { borderColor })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Glow ({item.glow ?? overlayTheme.glow}px)</label>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={item.glow ?? overlayTheme.glow}
                        onChange={(e) => updateWidgetTheme(target.id, { glow: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Drop shadow ({item.shadow ?? overlayTheme.shadow}%)</label>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        value={item.shadow ?? overlayTheme.shadow}
                        onChange={(e) => updateWidgetTheme(target.id, { shadow: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Corner radius ({item.borderRadius ?? overlayTheme.borderRadius}px)</label>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        value={item.borderRadius ?? overlayTheme.borderRadius}
                        onChange={(e) => updateWidgetTheme(target.id, { borderRadius: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Background opacity ({Math.round((item.backgroundOpacity ?? overlayTheme.backgroundOpacity) * 100)}%)</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={item.backgroundOpacity ?? overlayTheme.backgroundOpacity}
                        onChange={(e) => updateWidgetTheme(target.id, { backgroundOpacity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-row">
                      <label>Background blur ({item.backgroundBlur ?? overlayTheme.backgroundBlur}px)</label>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        value={item.backgroundBlur ?? overlayTheme.backgroundBlur}
                        onChange={(e) => updateWidgetTheme(target.id, { backgroundBlur: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.pulse ?? false}
                        onChange={(e) => updateWidgetTheme(target.id, { pulse: e.target.checked })}
                      />{" "}
                      Pulse this overlay
                    </label>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      onClick={() => updateWidgetTheme(target.id, {
                        accentColor: undefined,
                        textColor: undefined,
                        mutedColor: undefined,
                        panelBackground: undefined,
                        itemBackground: undefined,
                        borderColor: undefined,
                        borderRadius: undefined,
                        shadow: undefined,
                        glow: undefined,
                        pulse: undefined,
                        backgroundImage: undefined,
                        backgroundOpacity: undefined,
                        backgroundBlur: undefined,
                      })}
                    >
                      Clear overrides
                    </button>
                  </div>
                  <div className="form-row overlay-widget-theme-background">
                    <label>Background image</label>
                    <MediaPicker
                      value={(item.backgroundImage ?? "").replace(/^\/assets\//, "")}
                      onChange={(path) => updateWidgetTheme(target.id, { backgroundImage: path ? `/assets/${path}` : undefined })}
                    />
                    {item.backgroundImage && (
                      <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => updateWidgetTheme(target.id, { backgroundImage: undefined })}>
                        Remove background image
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </details>
        )}
      </Card>
      )}

      {widgets.filter((w) => selectedPanel === `widget:${w.id}`).map((w) => (
        <Card key={w.id} className="widget-config-card" hideableId={`widget-${w.id}`} hideableTitle={formatWidgetLabel(w)}>
          <CardHeader
            title={`${formatWidgetLabel(w)} (${w.type})`}
            description="Widget behaviour lives here. Visual styling is handled in Theme Pack and Overrides."
            action={
              <div className="widget-config-actions">
                <StatusPill tone={w.enabled ? "success" : "neutral"} label={w.enabled ? "Enabled" : "Disabled"} />
                <ButtonAnchor href={`${overlayOrigin}${widgetPreviewRoute(w)}`} target="_blank" rel="noreferrer" size="sm">
                  Preview
                </ButtonAnchor>
              </div>
            }
          />
          <label>
            <input
              type="checkbox"
              checked={w.enabled}
              onChange={(e) =>
                setWidgets((ws) =>
                  ws.map((x) => (x.id === w.id ? { ...x, enabled: e.target.checked } : x)),
                )
              }
            />{" "}
            Enabled
          </label>
          {w.type === "chat" && (
            <>
              <Callout title="BTTV refresh note">
                BTTV emotes are checked when the OBS Chat browser source loads. If you add or remove BTTV emotes, refresh the Chat source in OBS to update the emote list.
              </Callout>
              <div className="form-row">
                <label>Max messages</label>
                <input
                  type="number"
                  value={Number(w.config.maxMessages ?? 20)}
                  onChange={(e) =>
                    setWidgets((ws) =>
                      ws.map((x) =>
                        x.id === w.id
                          ? { ...x, config: { ...x.config, maxMessages: Number(e.target.value) } }
                          : x,
                      ),
                    )
                  }
                />
              </div>
              <div className="form-row">
                <label>Fade time (ms)</label>
                <input
                  type="number"
                  value={Number(w.config.fadeMs ?? 8000)}
                  onChange={(e) =>
                    setWidgets((ws) =>
                      ws.map((x) =>
                        x.id === w.id
                          ? { ...x, config: { ...x.config, fadeMs: Number(e.target.value) } }
                          : x,
                      ),
                    )
                  }
                />
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={w.config.showStats !== false}
                  onChange={(e) =>
                    setWidgets((ws) =>
                      ws.map((x) =>
                        x.id === w.id
                          ? { ...x, config: { ...x.config, showStats: e.target.checked } }
                          : x,
                      ),
                    )
                  }
                />{" "}
                Show live chat activity stats
              </label>
            </>
          )}
          {w.type === "ticker" && (
            <>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div className="form-row">
                  <label>Ticker title</label>
                  <input
                    value={String(w.config.title ?? "Recent Events")}
                    onChange={(e) =>
                      setWidgets((ws) =>
                        ws.map((x) =>
                          x.id === w.id ? { ...x, config: { ...x.config, title: e.target.value } } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="form-row">
                  <label>Max events in ticker</label>
                  <input
                    type="number"
                    value={Number(w.config.maxEvents ?? 10)}
                    onChange={(e) =>
                      setWidgets((ws) =>
                        ws.map((x) =>
                          x.id === w.id
                            ? { ...x, config: { ...x.config, maxEvents: Number(e.target.value) } }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
              </div>
              <div className="actions" style={{ marginBottom: 12 }}>
                <label><input type="checkbox" checked={w.config.compact === true} onChange={(e) => setWidgets((ws) => ws.map((x) => x.id === w.id ? { ...x, config: { ...x.config, compact: e.target.checked } } : x))} /> Compact mode</label>
                <label><input type="checkbox" checked={w.config.showUser !== false} onChange={(e) => setWidgets((ws) => ws.map((x) => x.id === w.id ? { ...x, config: { ...x.config, showUser: e.target.checked } } : x))} /> Show user</label>
                <label><input type="checkbox" checked={w.config.showAmount === true} onChange={(e) => setWidgets((ws) => ws.map((x) => x.id === w.id ? { ...x, config: { ...x.config, showAmount: e.target.checked } } : x))} /> Show amount</label>
              </div>
              <label>Included event types</label>
              <div className="actions" style={{ marginTop: 0 }}>
                {TICKER_EVENT_TYPES.map((type) => {
                  const selected = Array.isArray(w.config.eventTypes) ? (w.config.eventTypes as unknown[]).includes(type) : false;
                  return (
                    <label key={type}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) =>
                          setWidgets((ws) =>
                            ws.map((x) => {
                              if (x.id !== w.id) return x;
                              const current = Array.isArray(x.config.eventTypes) ? (x.config.eventTypes as string[]) : [];
                              const eventTypes = e.target.checked ? [...new Set([...current, type])] : current.filter((item) => item !== type);
                              return { ...x, config: { ...x.config, eventTypes } };
                            }),
                          )
                        }
                      />{" "}
                      {type}
                    </label>
                  );
                })}
              </div>
              <p className="subtitle">Leave all event type boxes unchecked to show every event.</p>
            </>
          )}
          {w.type === "eventList" && (
            <>
              <div className="form-row">
                <label>Max events in event list</label>
                <input
                  type="number"
                  value={Number(w.config.maxEvents ?? 8)}
                  onChange={(e) =>
                    setWidgets((ws) =>
                      ws.map((x) =>
                        x.id === w.id
                          ? { ...x, config: { ...x.config, maxEvents: Number(e.target.value) } }
                          : x,
                      ),
                    )
                  }
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={w.config.showAmount !== false}
                  onChange={(e) =>
                    setWidgets((ws) =>
                      ws.map((x) =>
                        x.id === w.id
                          ? { ...x, config: { ...x.config, showAmount: e.target.checked } }
                          : x,
                      ),
                    )
                  }
                />{" "}
                Show amount
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={w.config.showMessage !== false}
                  onChange={(e) =>
                    setWidgets((ws) =>
                      ws.map((x) =>
                        x.id === w.id
                          ? { ...x, config: { ...x.config, showMessage: e.target.checked } }
                          : x,
                      ),
                    )
                  }
                />{" "}
                Show message
              </label>
            </>
          )}
        </Card>
      ))}

      {selectedPanel === "goals" && (
      <Card className="widget-config-card" hideableId="follower-goal" hideableTitle="Follower Goal">
        <CardHeader title="Follower goal" description="Configure goal values shown by the goals browser source." />
        {goals.map((g) => (
          <div key={g.id} style={{ display: "flex", gap: 12, alignItems: "end", marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <label>Label</label>
              <input
                value={g.label}
                onChange={(e) =>
                  setGoals((gs) =>
                    gs.map((x) => (x.id === g.id ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
            </div>
            <div>
              <label>Current</label>
              <input
                type="number"
                value={g.current_count}
                onChange={(e) =>
                  setGoals((gs) =>
                    gs.map((x) =>
                      x.id === g.id ? { ...x, current_count: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </div>
            <div>
              <label>Target</label>
              <input
                type="number"
                value={g.target_count}
                onChange={(e) =>
                  setGoals((gs) =>
                    gs.map((x) =>
                      x.id === g.id ? { ...x, target_count: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void saveGoal(g.id, g.target_count, g.current_count, g.label)}
            >
              Save goal
            </Button>
          </div>
        ))}
      </Card>
      )}
        </main>
      </div>
    </>
  );
}

function themePreviewStyle(theme: OverlayThemeConfig): CSSProperties {
  return {
    color: theme.textColor,
    backgroundColor: theme.panelBackground,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadius,
    boxShadow: `0 18px 50px rgba(0,0,0,${theme.shadow / 100}), 0 0 ${theme.glow}px ${theme.accentColor}`,
    fontFamily: theme.fontFamily,
    backgroundImage: theme.backgroundImage ? `linear-gradient(${theme.panelBackground}, ${theme.panelBackground}), url("${theme.backgroundImage}")` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

function formatWidgetLabel(widget: WidgetConfig): string {
  const raw = widget.id || widget.type;
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function widgetPreviewRoute(widget: WidgetConfig): string {
  switch (widget.type) {
    case "chat":
      return "/o/chat.html";
    case "ticker":
      return "/o/ticker.html";
    case "eventList":
      return "/o/event-list.html";
    case "nowPlaying":
      return "/o/now-playing.html";
    case "goal":
      return "/o/goals.html";
    default:
      return `/o/${widget.id}.html`;
  }
}

function ColorAlphaControl({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const parsed = parseCssColor(value, fallback);
  return (
    <div className="color-alpha-control">
      <input
        aria-label={`${label} colour`}
        type="color"
        value={parsed.color}
        onChange={(e) => onChange(formatRgba(e.target.value, parsed.alpha))}
      />
      <input
        aria-label={`${label} opacity`}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={parsed.alpha}
        onChange={(e) => onChange(formatRgba(parsed.color, Number(e.target.value)))}
      />
      <span>{Math.round(parsed.alpha * 100)}%</span>
    </div>
  );
}

function parseCssColor(value: string | undefined, fallback: string): ParsedColor {
  const raw = (value || fallback).trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return { color: raw, alpha: 1 };
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const [, r, g, b] = raw;
    return { color: `#${r}${r}${g}${g}${b}${b}`, alpha: 1 };
  }
  const rgba = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const r = clampColor(Number(rgba[1]));
    const g = clampColor(Number(rgba[2]));
    const b = clampColor(Number(rgba[3]));
    const alpha = Math.max(0, Math.min(1, Number(rgba[4] ?? 1)));
    return { color: rgbToHex(r, g, b), alpha };
  }
  return parseCssColor(fallback, "#ffffff");
}

function formatRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nextAlpha = Math.max(0, Math.min(1, alpha));
  if (nextAlpha >= 1) return rgbToHex(r, g, b);
  return `rgba(${r}, ${g}, ${b}, ${Number(nextAlpha.toFixed(2))})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "ffffff";
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => clampColor(value).toString(16).padStart(2, "0")).join("")}`;
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(value) ? value : 0)));
}

function mergeWidgetThemes(
  preset: OverlayThemeConfig["widgets"],
  current: OverlayThemeConfig["widgets"],
): OverlayThemeConfig["widgets"] {
  return Object.fromEntries(THEME_TARGETS.map((target) => [
    target.id,
    {
      ...(preset[target.id] ?? { enabled: true }),
      enabled: current[target.id]?.enabled ?? preset[target.id]?.enabled ?? true,
      backgroundImage: current[target.id]?.backgroundImage,
    },
  ])) as OverlayThemeConfig["widgets"];
}
