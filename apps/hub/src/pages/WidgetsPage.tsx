import { useCallback, useEffect, useState } from "react";
import type { WidgetConfig } from "@btv/shared";
import { api } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";

const TICKER_EVENT_TYPES = ["follow", "sub", "resub", "gift_sub", "cheer", "raid", "channel_points", "goal_milestone"];

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [goals, setGoals] = useState<
    Array<{ id: string; label: string; current_count: number; target_count: number }>
  >([]);
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.widgets(), api.goals()]).then(([w, g]) => {
      setWidgets(w);
      setGoals(g);
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

  const saveGoal = async (id: string, target: number, current: number, label: string) => {
    try {
      await api.saveGoal(id, { target, current, label });
      toast("Goal updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <>
      <h1>Widgets</h1>
      <p className="subtitle">Configure chat, goals, ticker, and now playing widgets.</p>
      <SaveIndicator status={widgetSaveStatus} />

      {widgets.map((w) => (
        <div key={w.id} className="card">
          <h2>{w.id} ({w.type})</h2>
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
              <div className="notice">
                BTTV emotes are checked when the OBS Chat browser source loads. If you add or remove BTTV emotes, refresh the Chat source in OBS to update the emote list.
              </div>
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
                <div className="form-row">
                  <label>Width</label>
                  <input
                    type="number"
                    value={Number(w.config.width ?? 360)}
                    onChange={(e) =>
                      setWidgets((ws) =>
                        ws.map((x) =>
                          x.id === w.id ? { ...x, config: { ...x.config, width: Number(e.target.value) } } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="form-row">
                  <label>Position</label>
                  <select
                    value={String(w.config.position ?? "top-left")}
                    onChange={(e) =>
                      setWidgets((ws) =>
                        ws.map((x) =>
                          x.id === w.id ? { ...x, config: { ...x.config, position: e.target.value } } : x,
                        ),
                      )
                    }
                  >
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                  </select>
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
        </div>
      ))}

      <div className="card">
        <h2>Follower goal</h2>
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void saveGoal(g.id, g.target_count, g.current_count, g.label)}
            >
              Save goal
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
