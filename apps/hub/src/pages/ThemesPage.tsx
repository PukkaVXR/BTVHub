import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { renderAlert } from "@btv/overlay-sdk";
import type { StreamEventType, Theme, ThemeAnchor } from "@btv/shared";
import { api } from "../api";
import { AlertsSectionTabs } from "../components/alerts/AlertsSectionTabs";
import { useToast } from "../hooks/useToast";
import { buildTheme, mockEvent } from "../theme-builder/buildTheme";
import { parseThemeLayout } from "../theme-builder/parseLayout";
import {
  defaultVisualModel,
  type ThemeLayoutId,
  type ThemeVisualModel,
} from "../theme-builder/types";
import { ButtonLink, Callout, PageHeader } from "../ui";

const PREVIEW_TYPES: StreamEventType[] = ["follow", "sub", "cheer", "raid"];

const ANCHORS: { id: ThemeAnchor; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "center", label: "Center" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

function themeToVisual(theme: Theme): ThemeVisualModel {
  const base = defaultVisualModel();
  const saved = (theme.visual ?? {}) as Partial<ThemeVisualModel>;
  const placement = parseThemeLayout(theme);
  return {
    ...base,
    ...saved,
    placement: {
      ...base.placement,
      ...(saved.placement ?? {}),
      ...placement,
    },
    durationMs: theme.durationMs,
  };
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selected, setSelected] = useState<Theme | null>(null);
  const [pageTab, setPageTab] = useState<"design" | "advanced">("design");
  const [codeTab, setCodeTab] = useState<"html" | "css" | "js">("html");
  const [visual, setVisual] = useState<ThemeVisualModel>(defaultVisualModel());
  const [previewType, setPreviewType] = useState<StreamEventType>("follow");
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewCleanup = useRef<(() => void) | null>(null);
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const load = useCallback(() => {
    return api.themes().then((t) => {
      setThemes(t);
      const id = searchParams.get("id");
      setSelected((prev) => {
        const pick = id ? t.find((x) => x.id === id) : prev;
        const next = pick ?? prev ?? t[0] ?? null;
        if (next) setVisual(themeToVisual(next));
        return next;
      });
    });
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && themes.length) {
      const t = themes.find((x) => x.id === id);
      if (t) {
        setSelected(t);
        setVisual(themeToVisual(t));
      }
    }
  }, [searchParams, themes]);

  const applyVisualToTheme = (model: ThemeVisualModel): Theme | null => {
    if (!selected) return null;
    const built = buildTheme(model);
    return {
      ...selected,
      html: built.html,
      css: built.css,
      js: built.js,
      durationMs: built.durationMs,
      layout: built.layout,
      visual: model as unknown as Record<string, unknown>,
    };
  };

  const onVisualChange = (patch: Partial<ThemeVisualModel>) => {
    const next = { ...visual, ...patch };
    setVisual(next);
    if (pageTab === "design") {
      const updated = applyVisualToTheme(next);
      if (updated) setSelected(updated);
    }
  };

  const onPlacementChange = (patch: Partial<ThemeVisualModel["placement"]>) => {
    onVisualChange({ placement: { ...visual.placement, ...patch } });
  };

  const saveTheme = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      let toSave = selected;
      if (pageTab === "design") {
        const built = applyVisualToTheme(visual);
        if (built) toSave = built;
      }
      await api.saveTheme(toSave);
      toast("Theme saved");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!previewRef.current || !selected) return;
    previewCleanup.current?.();
    previewRef.current.innerHTML = "";
    const event = mockEvent(previewType);
    previewCleanup.current = renderAlert(previewRef.current, {
      id: "preview",
      event,
      themeId: selected.id,
      html: selected.html,
      css: selected.css,
      js: selected.js,
      durationMs: Math.min(selected.durationMs, 8000),
    });
    return () => previewCleanup.current?.();
  }, [selected?.html, selected?.css, selected?.js, selected?.durationMs, previewType, selected?.id]);

  const createNew = () => {
    const built = buildTheme(defaultVisualModel());
    const t: Theme = {
      id: `theme-${Date.now()}`,
      name: "New Theme",
      html: built.html,
      css: built.css,
      js: built.js,
      durationMs: built.durationMs,
      layout: built.layout,
      visual: defaultVisualModel() as unknown as Record<string, unknown>,
    };
    setVisual(defaultVisualModel());
    setSelected(t);
    setThemes((prev) => [...prev, t]);
  };

  const duplicateTheme = () => {
    if (!selected) return;
    const t: Theme = {
      ...selected,
      id: `theme-${Date.now()}`,
      name: `${selected.name} (copy)`,
      visual: selected.visual,
    };
    setSelected(t);
    setThemes((prev) => [...prev, t]);
  };

  const removeTheme = async () => {
    if (!selected || selected.id === "default") {
      toast("Cannot delete default theme");
      return;
    }
    await api.deleteTheme(selected.id);
    toast("Theme deleted");
    setSelected(null);
    await load();
  };

  const editorValue =
    codeTab === "html"
      ? selected?.html ?? ""
      : codeTab === "css"
        ? selected?.css ?? ""
        : selected?.js ?? "";

  const setEditorValue = (v: string) => {
    if (!selected) return;
    setSelected({ ...selected, [codeTab]: v });
  };

  return (
    <>
      <PageHeader
        title="Legacy Theme Editor"
        action={<span className="badge badge-off">Legacy</span>}
        description="Maintain older alert themes and rules. New alert work should use Visual Alert Projects."
      />
      <AlertsSectionTabs />
      <Callout title="Use Visual Alert Projects for new alerts">
        Legacy themes still work for existing alert rules, interactive actions, and old setups. For cinematic alerts,
        layers, timelines, GIPHY media, variations, and OBS testing, create or migrate to a Visual Alert Project.
        <div className="actions themes-legacy-actions">
          <ButtonLink to="/alerts" size="sm" variant="primary">Open Visual Alert Projects</ButtonLink>
          <ButtonLink to="/alerts/routing" size="sm" variant="secondary">Manage routing</ButtonLink>
        </div>
      </Callout>
      <p className="subtitle">
        Migration path: recreate the theme as a Visual Alert Project, test it in OBS, then switch matching routing rules
        from the legacy theme ID to the new project.
      </p>

      <div className="actions" style={{ marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={selected?.id ?? ""}
          onChange={(e) => {
            const t = themes.find((x) => x.id === e.target.value) ?? null;
            setSelected(t);
            if (t) setVisual(themeToVisual(t));
          }}
          style={{ width: 200 }}
        >
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => void saveTheme()} disabled={!selected || saving}>
          {saving ? "Saving…" : "Save theme"}
        </button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={createNew}>
          New theme
        </button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={duplicateTheme} disabled={!selected}>
          Duplicate
        </button>
        <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => void removeTheme()} disabled={!selected}>
          Delete
        </button>
      </div>

      {selected && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Theme name</label>
              <input
                value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })}
              />
            </div>
            <div className="actions" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`ui-button ui-button--sm ${pageTab === "design" ? "ui-button--primary" : "ui-button--secondary"}`}
                onClick={() => setPageTab("design")}
              >
                Design
              </button>
              <button
                type="button"
                className={`ui-button ui-button--sm ${pageTab === "advanced" ? "ui-button--primary" : "ui-button--secondary"}`}
                onClick={() => setPageTab("advanced")}
              >
                Advanced
              </button>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              {pageTab === "design" ? (
                <>
                  <h2>Design</h2>
                  <h3 style={{ fontSize: 14, marginTop: 12, marginBottom: 8 }}>Position & size</h3>
                  <div className="form-row">
                    <label>Screen position</label>
                    <select
                      value={visual.placement.anchor}
                      onChange={(e) =>
                        onPlacementChange({ anchor: e.target.value as ThemeAnchor })
                      }
                    >
                      {ANCHORS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Width ({visual.placement.width}px)</label>
                    <input
                      type="range"
                      min={200}
                      max={900}
                      value={visual.placement.width}
                      onChange={(e) => onPlacementChange({ width: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Offset X ({visual.placement.offsetX}px)</label>
                    <input
                      type="range"
                      min={-200}
                      max={200}
                      value={visual.placement.offsetX}
                      onChange={(e) => onPlacementChange({ offsetX: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Offset Y ({visual.placement.offsetY}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={400}
                      value={visual.placement.offsetY}
                      onChange={(e) => onPlacementChange({ offsetY: Number(e.target.value) })}
                    />
                  </div>

                  <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>Look</h3>
                  <div className="form-row">
                    <label>Animation</label>
                    <select
                      value={visual.animation}
                      onChange={(e) =>
                        onVisualChange({ animation: e.target.value as ThemeLayoutId })
                      }
                    >
                      <option value="slideUp">Slide up</option>
                      <option value="slideLeft">Slide left</option>
                      <option value="pop">Pop</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Primary color</label>
                    <input
                      type="color"
                      value={visual.primaryColor}
                      onChange={(e) => onVisualChange({ primaryColor: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Text color</label>
                    <input
                      type="color"
                      value={visual.accentColor}
                      onChange={(e) => onVisualChange({ accentColor: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Background</label>
                    <input
                      value={visual.backgroundColor}
                      onChange={(e) => onVisualChange({ backgroundColor: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Font</label>
                    <input
                      value={visual.fontFamily}
                      onChange={(e) => onVisualChange({ fontFamily: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Border radius ({visual.borderRadius}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={visual.borderRadius}
                      onChange={(e) => onVisualChange({ borderRadius: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={visual.glow}
                        onChange={(e) => onVisualChange({ glow: e.target.checked })}
                      />{" "}
                      Glow
                    </label>
                  </div>
                  <div className="form-row">
                    <label>Duration (ms)</label>
                    <input
                      type="number"
                      value={visual.durationMs}
                      onChange={(e) => {
                        const durationMs = Number(e.target.value);
                        onVisualChange({ durationMs });
                        setSelected((s) => (s ? { ...s, durationMs } : s));
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h2>Advanced</h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                    Use <code>.btv-alert-slot</code> in CSS for position. Click Save theme after edits.
                  </p>
                  <div className="form-row">
                    <label>Duration (ms)</label>
                    <input
                      type="number"
                      value={selected.durationMs}
                      onChange={(e) =>
                        setSelected({ ...selected, durationMs: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="actions">
                    {(["html", "css", "js"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`ui-button ui-button--sm ${codeTab === t ? "ui-button--primary" : "ui-button--secondary"}`}
                        onClick={() => setCodeTab(t)}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      overflow: "hidden",
                      marginTop: 12,
                    }}
                  >
                    <Editor
                      height="360px"
                      language={codeTab === "html" ? "html" : codeTab === "css" ? "css" : "javascript"}
                      theme="vs-dark"
                      value={editorValue}
                      onChange={(v) => setEditorValue(v ?? "")}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h2>Preview (1920×1080)</h2>
              <div className="actions" style={{ marginBottom: 12 }}>
                {PREVIEW_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ui-button ui-button--sm ${previewType === t ? "ui-button--primary" : "ui-button--secondary"}`}
                    onClick={() => setPreviewType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  background: "#1a1a2e",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  ref={previewRef}
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: "scale(0.5)",
                    transformOrigin: "top left",
                    width: "200%",
                    height: "200%",
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
