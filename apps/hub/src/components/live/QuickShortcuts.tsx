import { useEffect, useMemo, useState } from "react";
import type { MacroConfig, SourceGroup } from "../../api";
import { Button, Card, EmptyState } from "../../ui";
import { macroStepLabel } from "./liveUtils";

interface QuickShortcutsProps {
  macros: MacroConfig[];
  sourceGroups: SourceGroup[];
  activeSourceGroupId?: string;
  onRunMacro: (macro: MacroConfig) => void;
  onApplySourceGroup: (group: SourceGroup) => void;
  onEmergencyAction?: (action: string) => void;
}

interface QuickShortcutFavorites {
  macroIds: string[];
  sourceGroupIds: string[];
}

type DeckPage = "pinned" | "macros" | "layouts" | "emergency";

const FAVORITES_STORAGE_KEY = "btv.dashboard.quickShortcuts";
const DEFAULT_FAVORITES: QuickShortcutFavorites = { macroIds: [], sourceGroupIds: [] };
const EMERGENCY_DECK_ACTIONS = [
  { id: "stop-sounds", label: "Stop sounds", detail: "Silence active overlay audio", tone: "warning" },
  { id: "hide-overlays", label: "Hide overlays", detail: "Clear visible overlay clutter", tone: "warning" },
  { id: "reset-overlays", label: "Reset overlays", detail: "Restore temporary overlay state", tone: "info" },
  { id: "all", label: "Stop all", detail: "Full production panic button", tone: "danger" },
] as const;

function readFavorites(): QuickShortcutFavorites {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return DEFAULT_FAVORITES;
    const parsed = JSON.parse(raw) as Partial<QuickShortcutFavorites>;
    return {
      macroIds: Array.isArray(parsed.macroIds) ? parsed.macroIds.filter((id): id is string => typeof id === "string") : [],
      sourceGroupIds: Array.isArray(parsed.sourceGroupIds)
        ? parsed.sourceGroupIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return DEFAULT_FAVORITES;
  }
}

export function DashboardButtonDecks({
  macros,
  sourceGroups,
  activeSourceGroupId,
  onRunMacro,
  onApplySourceGroup,
  onEmergencyAction,
}: QuickShortcutsProps) {
  const [favorites, setFavorites] = useState<QuickShortcutFavorites>(() => readFavorites());
  const [activeDeck, setActiveDeck] = useState<DeckPage>("pinned");
  const hasShortcuts = macros.length > 0 || sourceGroups.length > 0;
  const hasFavorites = favorites.macroIds.length > 0 || favorites.sourceGroupIds.length > 0;

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const favoriteMacros = useMemo(
    () => favorites.macroIds.map((id) => macros.find((macro) => macro.id === id)).filter((macro): macro is MacroConfig => Boolean(macro)),
    [favorites.macroIds, macros],
  );

  const favoriteSourceGroups = useMemo(
    () =>
      favorites.sourceGroupIds
        .map((id) => sourceGroups.find((group) => group.id === id))
        .filter((group): group is SourceGroup => Boolean(group)),
    [favorites.sourceGroupIds, sourceGroups],
  );

  const visibleMacros = activeDeck === "pinned" ? favoriteMacros : macros;
  const visibleSourceGroups = activeDeck === "pinned" ? favoriteSourceGroups : sourceGroups;

  const toggleFavorite = (kind: keyof QuickShortcutFavorites, id: string) => {
    setFavorites((current) => {
      const nextIds = current[kind].includes(id)
        ? current[kind].filter((favoriteId) => favoriteId !== id)
        : [...current[kind], id];
      return { ...current, [kind]: nextIds };
    });
  };

  const isFavorite = (kind: keyof QuickShortcutFavorites, id: string) => favorites[kind].includes(id);
  const showPinnedEmpty = activeDeck === "pinned" && !hasFavorites;

  return (
    <Card className="dashboard-deck-card" hideableId="dashboard-button-decks" hideableTitle="Dashboard Button Decks">
      <div className="live-shortcut-title dashboard-deck-title">
        <div>
          <h2>Dashboard Button Decks</h2>
          <p>Large live-production buttons for macros, activity layouts, and emergency controls.</p>
        </div>
        {hasFavorites ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setFavorites(DEFAULT_FAVORITES)}>
            Clear pins
          </Button>
        ) : null}
      </div>

      <div className="dashboard-deck-tabs" role="tablist" aria-label="Dashboard button decks">
        <DeckTab id="pinned" label="Pinned" count={favoriteMacros.length + favoriteSourceGroups.length} activeDeck={activeDeck} onSelect={setActiveDeck} />
        <DeckTab id="macros" label="Macros" count={macros.length} activeDeck={activeDeck} onSelect={setActiveDeck} />
        <DeckTab id="layouts" label="Layouts" count={sourceGroups.length} activeDeck={activeDeck} onSelect={setActiveDeck} />
        <DeckTab id="emergency" label="Emergency" count={EMERGENCY_DECK_ACTIONS.length} activeDeck={activeDeck} onSelect={setActiveDeck} />
      </div>

      {showPinnedEmpty ? (
        <EmptyState title="No pinned deck buttons yet" description="Pin macros or activity layouts below, or switch to a deck tab to run everything." />
      ) : hasShortcuts || activeDeck === "emergency" ? (
        <>
          <div className="live-shortcut-grid">
            {(activeDeck === "pinned" || activeDeck === "macros") && visibleMacros.map((macro) => (
              <div className={`live-shortcut dashboard-deck-button${macro.enabled ? "" : " dashboard-deck-button--disabled"}`} key={macro.id}>
                <div className="live-shortcut__header">
                  <div>
                    <strong>{macro.name}</strong>
                    <p>{macro.enabled ? `${macro.steps.length} step${macro.steps.length === 1 ? "" : "s"}` : "Disabled"}</p>
                  </div>
                  <div className="live-shortcut__actions">
                    <Button
                      type="button"
                      variant={isFavorite("macroIds", macro.id) ? "secondary" : "ghost"}
                      size="sm"
                      aria-pressed={isFavorite("macroIds", macro.id)}
                      onClick={() => toggleFavorite("macroIds", macro.id)}
                    >
                      {isFavorite("macroIds", macro.id) ? "Pinned" : "Pin"}
                    </Button>
                    <Button type="button" variant="primary" size="sm" onClick={() => onRunMacro(macro)} disabled={!macro.enabled}>
                      Run
                    </Button>
                  </div>
                </div>
                {macro.steps.length ? (
                  <p className="live-shortcut__steps">
                    {macro.steps.slice(0, 3).map(macroStepLabel).join(" -> ")}
                    {macro.steps.length > 3 ? " -> ..." : ""}
                  </p>
                ) : null}
              </div>
            ))}
            {(activeDeck === "pinned" || activeDeck === "layouts") && visibleSourceGroups.map((group) => (
              <div
                className={`live-shortcut dashboard-deck-button${group.id === activeSourceGroupId ? " dashboard-deck-button--active" : ""}`}
                key={group.id}
              >
                <div className="live-shortcut__header">
                  <div>
                    <strong>{group.name}</strong>
                    <p>
                      {group.sceneName} - {group.sources.length} source{group.sources.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="live-shortcut__actions">
                    <Button
                      type="button"
                      variant={isFavorite("sourceGroupIds", group.id) ? "secondary" : "ghost"}
                      size="sm"
                      aria-pressed={isFavorite("sourceGroupIds", group.id)}
                      onClick={() => toggleFavorite("sourceGroupIds", group.id)}
                    >
                      {isFavorite("sourceGroupIds", group.id) ? "Pinned" : "Pin"}
                    </Button>
                    <Button type="button" variant="primary" size="sm" onClick={() => onApplySourceGroup(group)}>
                      Apply
                    </Button>
                  </div>
                </div>
                <p className="live-shortcut__steps">
                  {group.id === activeSourceGroupId ? "Active activity layout" : "Activity layout shortcut"}
                </p>
              </div>
            ))}
            {activeDeck === "emergency" && EMERGENCY_DECK_ACTIONS.map((action) => (
              <button
                type="button"
                className={`dashboard-deck-emergency dashboard-deck-emergency--${action.tone}`}
                key={action.id}
                onClick={() => onEmergencyAction?.(action.id)}
                disabled={!onEmergencyAction}
              >
                <strong>{action.label}</strong>
                <span>{action.detail}</span>
              </button>
            ))}
          </div>

          <details className="live-shortcut-picker">
            <summary>Customize shortcuts</summary>
            <div className="live-shortcut-picker__grid">
              <ShortcutPickerGroup
                title="Macros"
                emptyText="No macros yet."
                items={macros.map((macro) => ({
                  id: macro.id,
                  label: macro.name,
                  meta: macro.enabled ? `${macro.steps.length} step${macro.steps.length === 1 ? "" : "s"}` : "Disabled",
                  pinned: isFavorite("macroIds", macro.id),
                  onToggle: () => toggleFavorite("macroIds", macro.id),
                }))}
              />
              <ShortcutPickerGroup
                title="Activity layouts"
                emptyText="No activity layouts yet."
                items={sourceGroups.map((group) => ({
                  id: group.id,
                  label: group.name,
                  meta: `${group.sceneName} - ${group.sources.length} source${group.sources.length === 1 ? "" : "s"}`,
                  pinned: isFavorite("sourceGroupIds", group.id),
                  onToggle: () => toggleFavorite("sourceGroupIds", group.id),
                }))}
              />
            </div>
          </details>
        </>
      ) : (
        <EmptyState title="No deck buttons configured" description="Create a macro or activity layout to make it available here." />
      )}
    </Card>
  );
}

export const QuickShortcuts = DashboardButtonDecks;

function DeckTab({
  id,
  label,
  count,
  activeDeck,
  onSelect,
}: {
  id: DeckPage;
  label: string;
  count: number;
  activeDeck: DeckPage;
  onSelect: (id: DeckPage) => void;
}) {
  return (
    <button
      type="button"
      className={`dashboard-deck-tab${activeDeck === id ? " dashboard-deck-tab--active" : ""}`}
      role="tab"
      aria-selected={activeDeck === id}
      onClick={() => onSelect(id)}
    >
      <span>{label}</span>
      <small>{count}</small>
    </button>
  );
}

function ShortcutPickerGroup({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: Array<{ id: string; label: string; meta: string; pinned: boolean; onToggle: () => void }>;
}) {
  return (
    <div className="live-shortcut-picker__group">
      <h3>{title}</h3>
      {items.length ? (
        items.map((item) => (
          <label className="live-shortcut-picker__item" key={item.id}>
            <input type="checkbox" checked={item.pinned} onChange={item.onToggle} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.meta}</small>
            </span>
          </label>
        ))
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}
