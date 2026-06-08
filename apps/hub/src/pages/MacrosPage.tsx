import { useEffect, useMemo, useState } from "react";
import { api, type MacroConfig, type MacroStep } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, ButtonLink, EmptyState, FormField, PageHeader, StatusPill } from "../ui";

const emptyMacro = (): MacroConfig => ({
  id: `macro-${Date.now()}`,
  name: "New macro",
  enabled: true,
  steps: [{ type: "clear_alerts" }],
});

function stepLabel(step: MacroStep): string {
  switch (step.type) {
    case "wait":
      return `Wait ${step.durationMs}ms`;
    case "obs_scene":
      return `Scene: ${step.sceneName}`;
    case "obs_source_visibility":
      return `${step.visible ? "Show" : "Hide"} ${step.sourceName}`;
    case "obs_text":
      return `Text: ${step.inputName}`;
    case "obs_stream_start":
      return "Start stream";
    case "obs_stream_stop":
      return "Stop stream";
    case "obs_record_start":
      return "Start recording";
    case "obs_record_stop":
      return "Stop recording";
    case "obs_record_pause":
      return "Pause recording";
    case "obs_record_resume":
      return "Resume recording";
    case "obs_replay_buffer_start":
      return "Start replay buffer";
    case "obs_replay_buffer_stop":
      return "Stop replay buffer";
    case "obs_replay_buffer_save":
      return "Save replay";
    case "obs_filter":
      return `${step.enabled ? "Enable" : "Disable"} filter: ${step.filterName}`;
    case "twitch_chat":
      return "Send Twitch chat";
    case "run_command":
      return `Run command: ${step.command}`;
    case "effect":
      return `Effect: ${step.effectId}`;
    case "clear_alerts":
      return "Clear alerts";
    case "session_start":
      return "Start session";
    case "session_stop":
      return "Stop session";
    default:
      return "Unknown step";
  }
}

function validateSteps(value: string): { ok: true; steps: MacroStep[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return { ok: false, error: "Steps must be a JSON array" };
    for (const [index, step] of parsed.entries()) {
      if (!step || typeof step !== "object" || typeof step.type !== "string") {
        return { ok: false, error: `Step ${index + 1} needs a type` };
      }
    }
    return { ok: true, steps: parsed as MacroStep[] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

const STEP_TEMPLATES: Array<{ type: MacroStep["type"]; label: string; template: MacroStep }> = [
  { type: "wait", label: "Wait", template: { type: "wait", durationMs: 1000 } },
  { type: "clear_alerts", label: "Clear alerts", template: { type: "clear_alerts" } },
  { type: "session_start", label: "Start session", template: { type: "session_start" } },
  { type: "session_stop", label: "Stop session", template: { type: "session_stop" } },
  { type: "obs_scene", label: "Switch OBS scene", template: { type: "obs_scene", sceneName: "Starting" } },
  { type: "obs_stream_start", label: "Start OBS stream", template: { type: "obs_stream_start" } },
  { type: "obs_stream_stop", label: "Stop OBS stream", template: { type: "obs_stream_stop" } },
  { type: "obs_record_start", label: "Start recording", template: { type: "obs_record_start" } },
  { type: "obs_record_stop", label: "Stop recording", template: { type: "obs_record_stop" } },
  { type: "obs_replay_buffer_save", label: "Save replay buffer", template: { type: "obs_replay_buffer_save" } },
  { type: "twitch_chat", label: "Send Twitch chat", template: { type: "twitch_chat", message: "Going live now!" } },
  { type: "obs_filter", label: "Toggle OBS filter", template: { type: "obs_filter", sourceName: "Camera", filterName: "Blur", enabled: true } },
  {
    type: "run_command",
    label: "Run local command",
    template: {
      type: "run_command",
      command: "powershell.exe",
      args: ["-NoProfile", "-File", "scripts/example.ps1"],
      timeoutMs: 10000,
      successChatMessage: "Command finished successfully!",
    },
  },
];

function cloneStep(step: MacroStep): MacroStep {
  return JSON.parse(JSON.stringify(step)) as MacroStep;
}

function StepQuickFields({
  step,
  onChange,
}: {
  step: MacroStep;
  onChange: (step: MacroStep) => void;
}) {
  switch (step.type) {
    case "wait":
      return (
        <div className="macro-step-fields">
          <label>
            Duration (ms)
            <input
              type="number"
              min={0}
              value={step.durationMs}
              onChange={(event) => onChange({ ...step, durationMs: Number(event.target.value) })}
            />
          </label>
        </div>
      );
    case "obs_scene":
      return (
        <div className="macro-step-fields">
          <label>
            Scene name
            <input value={step.sceneName} onChange={(event) => onChange({ ...step, sceneName: event.target.value })} />
          </label>
        </div>
      );
    case "obs_source_visibility":
      return (
        <div className="macro-step-fields macro-step-fields--three">
          <label>
            Scene
            <input value={step.sceneName} onChange={(event) => onChange({ ...step, sceneName: event.target.value })} />
          </label>
          <label>
            Source
            <input value={step.sourceName} onChange={(event) => onChange({ ...step, sourceName: event.target.value })} />
          </label>
          <label>
            Visibility
            <select value={step.visible ? "show" : "hide"} onChange={(event) => onChange({ ...step, visible: event.target.value === "show" })}>
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
          </label>
        </div>
      );
    case "obs_text":
      return (
        <div className="macro-step-fields">
          <label>
            OBS text input
            <input value={step.inputName} onChange={(event) => onChange({ ...step, inputName: event.target.value })} />
          </label>
          <label>
            Text
            <input value={step.text} onChange={(event) => onChange({ ...step, text: event.target.value })} />
          </label>
        </div>
      );
    case "obs_filter":
      return (
        <div className="macro-step-fields macro-step-fields--three">
          <label>
            Source
            <input value={step.sourceName} onChange={(event) => onChange({ ...step, sourceName: event.target.value })} />
          </label>
          <label>
            Filter
            <input value={step.filterName} onChange={(event) => onChange({ ...step, filterName: event.target.value })} />
          </label>
          <label>
            State
            <select value={step.enabled ? "enable" : "disable"} onChange={(event) => onChange({ ...step, enabled: event.target.value === "enable" })}>
              <option value="enable">Enable</option>
              <option value="disable">Disable</option>
            </select>
          </label>
        </div>
      );
    case "twitch_chat":
      return (
        <div className="macro-step-fields">
          <label>
            Chat message
            <input value={step.message} onChange={(event) => onChange({ ...step, message: event.target.value })} />
          </label>
        </div>
      );
    case "run_command":
      return (
        <div className="macro-step-fields macro-step-fields--command">
          <label>
            Command
            <input value={step.command} onChange={(event) => onChange({ ...step, command: event.target.value })} />
          </label>
          <label>
            Args
            <input
              value={(step.args ?? []).join(" ")}
              onChange={(event) => onChange({ ...step, args: event.target.value.split(" ").filter(Boolean) })}
            />
          </label>
          <label>
            Timeout (ms)
            <input
              type="number"
              min={0}
              value={step.timeoutMs ?? 10000}
              onChange={(event) => onChange({ ...step, timeoutMs: Number(event.target.value) })}
            />
          </label>
        </div>
      );
    case "effect":
      return (
        <div className="macro-step-fields">
          <label>
            Effect ID
            <input value={step.effectId} onChange={(event) => onChange({ ...step, effectId: event.target.value })} />
          </label>
        </div>
      );
    case "session_start":
      return (
        <div className="macro-step-fields">
          <label>
            Session title
            <input value={step.title ?? ""} onChange={(event) => onChange({ ...step, title: event.target.value || undefined })} />
          </label>
        </div>
      );
    default:
      return null;
  }
}

export default function MacrosPage() {
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [editing, setEditing] = useState<MacroConfig | null>(null);
  const [stepsJson, setStepsJson] = useState("[]");
  const [stepTemplateType, setStepTemplateType] = useState<MacroStep["type"]>("wait");
  const [macroSearch, setMacroSearch] = useState("");
  const [macroFilter, setMacroFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [lastRun, setLastRun] = useState<Array<{ index: number; type: string; ok: boolean; message: string }>>([]);
  const toast = useToast();

  const load = () => {
    void api.macros().then(setMacros);
  };

  useEffect(() => load(), []);

  const selectedSummary = useMemo(() => {
    if (!editing) return [];
    return editing.steps.slice(0, 4).map(stepLabel);
  }, [editing]);

  const parsedSteps = useMemo(() => validateSteps(stepsJson), [stepsJson]);

  const visibleMacros = useMemo(() => {
    const query = macroSearch.trim().toLowerCase();
    return macros.filter((macro) => {
      if (macroFilter === "enabled" && !macro.enabled) return false;
      if (macroFilter === "disabled" && macro.enabled) return false;
      if (!query) return true;
      return [
        macro.name,
        macro.id,
        ...macro.steps.map((step) => `${step.type} ${stepLabel(step)}`),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [macroFilter, macroSearch, macros]);

  const edit = (macro: MacroConfig) => {
    setEditing(macro);
    setStepsJson(JSON.stringify(macro.steps, null, 2));
    setLastRun([]);
  };

  const save = async () => {
    if (!editing) return;
    const parsed = validateSteps(stepsJson);
    if (!parsed.ok) {
      toast(parsed.error);
      return;
    }
    await api.saveMacro({ ...editing, steps: parsed.steps });
    toast("Saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    await api.deleteMacro(id);
    toast("Deleted");
    if (editing?.id === id) setEditing(null);
    load();
  };

  const toggleMacroEnabled = async (macro: MacroConfig) => {
    const next = { ...macro, enabled: !macro.enabled };
    await api.saveMacro(next);
    toast(next.enabled ? "Macro enabled" : "Macro disabled");
    if (editing?.id === macro.id) edit(next);
    load();
  };

  const duplicateMacro = async (macro: MacroConfig) => {
    const copy: MacroConfig = {
      ...macro,
      id: `macro-${Date.now()}`,
      name: `${macro.name} copy`,
      steps: macro.steps.map(cloneStep),
    };
    await api.saveMacro(copy);
    toast("Macro duplicated");
    edit(copy);
    load();
  };

  const run = async (macro: MacroConfig) => {
    try {
      const res = await api.runMacro(macro.id);
      setLastRun(res.steps);
      toast(res.ok ? res.title : res.message);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Macro failed");
    }
  };

  const runEditing = async () => {
    if (!editing) return;
    const parsed = validateSteps(stepsJson);
    await run({ ...editing, steps: parsed.ok ? parsed.steps : editing.steps });
  };

  const setSteps = (steps: MacroStep[]) => {
    setStepsJson(JSON.stringify(steps, null, 2));
    if (editing) setEditing({ ...editing, steps });
  };

  const addTemplate = (step: MacroStep) => {
    const steps = parsedSteps.ok ? parsedSteps.steps : [];
    setSteps([...steps, cloneStep(step)]);
  };

  const removeStep = (index: number) => {
    if (!parsedSteps.ok) return;
    setSteps(parsedSteps.steps.filter((_, itemIndex) => itemIndex !== index));
  };

  const duplicateStep = (index: number) => {
    if (!parsedSteps.ok) return;
    const step = parsedSteps.steps[index];
    if (!step) return;
    const steps = [...parsedSteps.steps];
    steps.splice(index + 1, 0, cloneStep(step));
    setSteps(steps);
  };

  const updateStep = (index: number, step: MacroStep) => {
    if (!parsedSteps.ok) return;
    const steps = [...parsedSteps.steps];
    steps[index] = step;
    setSteps(steps);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    if (!parsedSteps.ok) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= parsedSteps.steps.length) return;
    const steps = [...parsedSteps.steps];
    const [step] = steps.splice(index, 1);
    steps.splice(nextIndex, 0, step);
    setSteps(steps);
  };

  return (
    <>
      <PageHeader title="Macros" description="Create ordered stream actions for Stream Deck keys and dashboard controls." />

      <div className="macro-page-actions">
        <div>
          <strong>{macros.length} macro{macros.length === 1 ? "" : "s"}</strong>
          <span>{macros.filter((macro) => macro.enabled).length} enabled for dashboards and Stream Deck actions</span>
        </div>
        <div className="actions">
          <Button type="button" variant="primary" size="sm" onClick={() => edit(emptyMacro())}>
            New macro
          </Button>
          <ButtonLink to="/stream-deck" variant="secondary" size="sm">
            Stream Deck builder
          </ButtonLink>
        </div>
      </div>

      <div className="macro-workspace">
        <aside className="macro-list" aria-label="Configured macros">
          <div className="macro-list-tools">
            <input
              value={macroSearch}
              onChange={(event) => setMacroSearch(event.target.value)}
              placeholder="Search macros or steps"
              aria-label="Search macros"
            />
            <div className="macro-filter-tabs" role="tablist" aria-label="Filter macros">
              {(["all", "enabled", "disabled"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={macroFilter === filter ? "active" : ""}
                  onClick={() => setMacroFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          {visibleMacros.map((macro) => (
            <div
              key={macro.id}
              role="button"
              tabIndex={0}
              className={`macro-list-card${editing?.id === macro.id ? " active" : ""}`}
              onClick={() => edit(macro)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  edit(macro);
                }
              }}
            >
              <span>{macro.name}</span>
              <small>
                {macro.steps.slice(0, 3).map(stepLabel).join(" -> ")}
                {macro.steps.length > 3 ? " -> ..." : ""}
              </small>
              <span className="macro-list-meta">
                <StatusPill tone={macro.enabled ? "success" : "neutral"} label={macro.enabled ? "Enabled" : "Disabled"} />
                <em>{macro.steps.length} step{macro.steps.length === 1 ? "" : "s"}</em>
              </span>
              <span className="macro-list-actions">
                <Button type="button" variant="primary" size="sm" onClick={(event) => { event.stopPropagation(); void run(macro); }} disabled={!macro.enabled}>
                  Run
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); void toggleMacroEnabled(macro); }}>
                  {macro.enabled ? "Disable" : "Enable"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); void duplicateMacro(macro); }}>
                  Copy
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={(event) => { event.stopPropagation(); void remove(macro.id); }}>
                  Delete
                </Button>
              </span>
            </div>
          ))}
          {!macros.length ? (
            <EmptyState title="No macros yet" description="Create one to chain OBS, Twitch, alert, and session actions." />
          ) : null}
          {macros.length && !visibleMacros.length ? (
            <EmptyState title="No matching macros" description="Try another search or switch the filter back to all." />
          ) : null}
          {visibleMacros.length ? (
            <span className="macro-list-count">
              Showing {visibleMacros.length} of {macros.length}
            </span>
          ) : null}
        </aside>

        <main className="macro-detail">
          {editing ? (
            <div className="card macro-editor-card">
              <div className="macro-editor-header">
                <div>
                  <span>Macro editor</span>
                  <h2>{editing.name || "Untitled macro"}</h2>
                </div>
                <div className="actions">
                  <Button type="button" variant="primary" size="sm" onClick={() => void save()}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void runEditing()}>
                    Run
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="macro-editor-shell">
                <section className="macro-settings-panel">
                  <FormField label="Name">
                    <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </FormField>
                  <label className="macro-enabled-toggle">
                    <input
                      type="checkbox"
                      checked={editing.enabled}
                      onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                    />
                    <span>
                      <strong>{editing.enabled ? "Enabled" : "Disabled"}</strong>
                      <small>Enabled macros appear as runnable controls.</small>
                    </span>
                  </label>

                  <div className="macro-step-picker">
                    <label>
                      Add step
                      <select value={stepTemplateType} onChange={(e) => setStepTemplateType(e.target.value as MacroStep["type"])}>
                        {STEP_TEMPLATES.map((item) => (
                          <option key={item.type} value={item.type}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addTemplate(STEP_TEMPLATES.find((item) => item.type === stepTemplateType)?.template ?? STEP_TEMPLATES[0].template)}
                    >
                      Add step
                    </Button>
                  </div>

                  {selectedSummary.length ? (
                    <div className="macro-summary-strip">
                      {selectedSummary.join(" -> ")}
                      {editing.steps.length > 4 ? " -> ..." : ""}
                    </div>
                  ) : null}

                  <details className="alert-compact-section macro-json-editor">
                    <summary>Advanced steps JSON</summary>
                    <FormField label="Steps JSON" error={parsedSteps.ok ? undefined : parsedSteps.error}>
                      <textarea
                        rows={10}
                        value={stepsJson}
                        onChange={(e) => setStepsJson(e.target.value)}
                        style={{ fontFamily: "monospace", lineHeight: 1.5 }}
                      />
                    </FormField>
                  </details>
                </section>

                <section className="macro-steps-panel">
                  <div className="macro-steps-header">
                    <div>
                      <strong>Steps</strong>
                      <span>{parsedSteps.ok ? `${parsedSteps.steps.length} configured` : parsedSteps.error}</span>
                    </div>
                    <Button type="button" variant="danger" size="sm" onClick={() => void remove(editing.id)}>
                      Delete macro
                    </Button>
                  </div>

                  <div className="macro-step-list">
                    {parsedSteps.ok && parsedSteps.steps.length ? parsedSteps.steps.map((step, index) => (
                      <div key={`${step.type}-${index}`} className="macro-step-card">
                        <div>
                          <span>{index + 1}</span>
                          <strong>{stepLabel(step)}</strong>
                          <small>{step.type}</small>
                        </div>
                        <div className="actions">
                          <Button type="button" variant="secondary" size="sm" onClick={() => moveStep(index, -1)} disabled={index === 0}>Up</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => moveStep(index, 1)} disabled={index === parsedSteps.steps.length - 1}>Down</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => duplicateStep(index)}>Duplicate</Button>
                          <Button type="button" variant="danger" size="sm" onClick={() => removeStep(index)}>Remove</Button>
                        </div>
                        <StepQuickFields step={step} onChange={(nextStep) => updateStep(index, nextStep)} />
                      </div>
                    )) : (
                      <EmptyState
                        title={parsedSteps.ok ? "No steps yet" : "Step JSON needs attention"}
                        description={parsedSteps.ok ? "Add a step to build this macro." : parsedSteps.error}
                      />
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <EmptyState title="Select a macro" description="Choose a macro from the list or create a new one to edit its ordered steps." />
          )}
        </main>
      </div>

      {lastRun.length ? (
        <div className="card macro-last-run-card">
          <div className="macro-last-run-header">
            <div>
              <span>Last run</span>
              <h2>{lastRun.filter((step) => step.ok).length}/{lastRun.length} steps completed</h2>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setLastRun([])}>
              Clear
            </Button>
          </div>
          <div className="macro-run-grid">
            {lastRun.map((step) => (
              <div className={`macro-run-result ${step.ok ? "macro-run-result--ok" : "macro-run-result--bad"}`} key={`${step.index}-${step.type}`}>
                <span>{step.index + 1}</span>
                <strong>{step.type}</strong>
                <small>{step.message}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
