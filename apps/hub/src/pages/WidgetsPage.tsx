import { useCallback, useEffect, useState } from "react";
import type { WidgetConfig } from "@btv/shared";
import { api } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";

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
