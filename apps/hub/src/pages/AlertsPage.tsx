import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AlertProject, AlertRule, StreamEventType } from "@btv/shared";
import SoundPicker from "../components/SoundPicker";
import { AlertsSectionTabs } from "../components/alerts/AlertsSectionTabs";
import { api } from "../api";
import { SaveIndicator } from "../hooks/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useToast } from "../hooks/useToast";
import { Button, ButtonLink, Callout, Card, CardHeader, PageHeader, StatusPill } from "../ui";

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
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.alertRules(), api.alertProjects()]).then(([r, p]) => {
      setRules(r);
      setProjects(p);
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
      await api.testVisualAlert(type);
      toast(type === "chat" ? "Test chat message sent" : `Test visual ${type} alert fired`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Test failed");
    }
  };

  const selectedProjectId = (themeId: string) => {
    if (projects.some((project) => project.id === themeId)) return themeId;
    const migrated = `alert-${themeId}`;
    if (projects.some((project) => project.id === migrated)) return migrated;
    return themeId;
  };

  return (
    <>
      <PageHeader
        title="Alert Routing"
        description="Map Twitch events to visual alert projects, sound effects, cooldowns, and priorities."
        action={<ButtonLink variant="primary" size="sm" to="/alerts">Open projects</ButtonLink>}
      />
      <AlertsSectionTabs />
      <SaveIndicator status={saveStatus} label="Alert routing" />

      <div className="alert-routing-layout">
        <Card className="alert-routing-test-card" hideableId="test-alerts" hideableTitle="Test Alerts">
          <CardHeader
            title="Test Alerts"
            description="Fire sample events into OBS without changing your routing rules."
            action={<StatusPill tone="info" label={`${EVENT_TYPES.length} events`} detail="Manual tests" />}
          />
          <Callout tone="info">
            Use <strong>Test chat</strong> to verify the OBS chat overlay at{" "}
            <code>http://127.0.0.1:4782/o/chat.html</code>.
          </Callout>
          <div className="alert-routing-test-grid">
            {EVENT_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                variant={type === "follow" ? "primary" : "secondary"}
                size="sm"
                onClick={() => void test(type)}
              >
                {type === "chat" ? "Test chat" : `Test ${type}`}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="alert-routing-table-card" hideableId="routing-rules" hideableTitle="Routing Rules">
          <CardHeader
            title="Routing Rules"
            description="Each row controls which visual project and sound should respond to a stream event."
            action={<StatusPill tone="neutral" label={`${rules.length} rules`} detail={`${projects.length} projects`} />}
          />
          <div className="alert-routing-table-wrap">
            <table className="table alert-routing-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Visual alert</th>
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
                    <td>
                      <strong>{rule.eventType}</strong>
                    </td>
                    <td>
                      <div className="alert-routing-project-cell">
                        <select
                          value={selectedProjectId(rule.themeId)}
                          onChange={(e) =>
                            setRules((rs) =>
                              rs.map((r) => (r.id === rule.id ? { ...r, themeId: e.target.value } : r)),
                            )
                          }
                        >
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                        <Link to={`/alerts/${encodeURIComponent(selectedProjectId(rule.themeId))}`}>
                          Edit alert
                        </Link>
                      </div>
                    </td>
                    <td>
                      <input
                        className="alert-routing-number-input"
                        type="number"
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
                        className="alert-routing-number-input"
                        type="number"
                        placeholder="-"
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
                    <td className="alert-routing-sound-cell">
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
                        className="alert-routing-priority-input"
                        type="number"
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
                        aria-label={`Enable ${rule.eventType} alert rule`}
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
        </Card>
      </div>
    </>
  );
}
