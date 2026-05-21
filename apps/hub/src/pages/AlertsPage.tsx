import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AlertRule, StreamEventType, Theme } from "@btv/shared";
import SoundPicker from "../components/SoundPicker";
import { api } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";

const EVENT_TYPES: StreamEventType[] = [
  "follow",
  "sub",
  "cheer",
  "raid",
  "gift_sub",
  "channel_points",
  "chat",
];

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.alertRules(), api.themes()]).then(([r, t]) => {
      setRules(r);
      setThemes(t);
      setHydrated(true);
    });
  };

  useEffect(() => load(), []);

  const persistRules = useCallback(async (rs: AlertRule[]) => {
    for (const rule of rs) {
      await api.saveAlertRule(rule);
    }
  }, []);

  const saveStatus = useAutoSave(rules, persistRules, { enabled: hydrated });

  const test = async (type: StreamEventType) => {
    try {
      await api.testAlert(type);
      toast(type === "chat" ? "Test chat message sent" : `Test ${type} alert fired`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Test failed");
    }
  };

  return (
    <>
      <h1>Alerts</h1>
      <p className="subtitle">Map Twitch events to themes and sounds.</p>
      <SaveIndicator status={saveStatus} />

      <div className="card">
        <h2>Test alerts</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
          Use <strong>Test chat</strong> to verify OBS chat overlay (
          <code>http://127.0.0.1:4782/o/chat.html</code>).
        </p>
        <div className="actions">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void test(t)}
            >
              {t === "chat" ? "Test chat" : `Test ${t}`}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Alert rules</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Theme</th>
              <th>Cooldown</th>
              <th>Min bits</th>
              <th>Sound</th>
              <th>Priority</th>
              <th>On</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.eventType}</td>
                <td>
                  <select
                    value={rule.themeId}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((r) => (r.id === rule.id ? { ...r, themeId: e.target.value } : r)),
                      )
                    }
                  >
                    {themes.map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.name}
                      </option>
                    ))}
                  </select>
                  <Link
                    to={`/themes?id=${rule.themeId}`}
                    style={{ fontSize: 12, marginLeft: 8 }}
                  >
                    Edit theme
                  </Link>
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 80, margin: 0 }}
                    value={rule.cooldownMs}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((r) =>
                          r.id === rule.id ? { ...r, cooldownMs: Number(e.target.value) } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 70, margin: 0 }}
                    placeholder="—"
                    value={rule.minAmount ?? ""}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((r) =>
                          r.id === rule.id
                            ? {
                                ...r,
                                minAmount: e.target.value ? Number(e.target.value) : undefined,
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </td>
                <td style={{ minWidth: 220 }}>
                  <SoundPicker
                    value={rule.soundAsset ?? ""}
                    onChange={(path) =>
                      setRules((rs) =>
                        rs.map((r) =>
                          r.id === rule.id ? { ...r, soundAsset: path || undefined } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 60, margin: 0 }}
                    value={rule.priority}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((r) =>
                          r.id === rule.id ? { ...r, priority: Number(e.target.value) } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) =>
                      setRules((rs) =>
                        rs.map((r) =>
                          r.id === rule.id ? { ...r, enabled: e.target.checked } : r,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
