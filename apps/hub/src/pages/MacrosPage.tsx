import { useEffect, useMemo, useState } from "react";
import { api, type MacroConfig, type MacroStep } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, ButtonLink, Callout, EmptyState, FormField, PageHeader, StatusPill } from "../ui";

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

export default function MacrosPage() {
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [editing, setEditing] = useState<MacroConfig | null>(null);
  const [stepsJson, setStepsJson] = useState("[]");
  const [stepTemplateType, setStepTemplateType] = useState<MacroStep["type"]>("wait");
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

      <div className="actions" style={{ marginBottom: 16 }}>
        <Button type="button" variant="primary" size="sm" onClick={() => edit(emptyMacro())}>
          New macro
        </Button>
        <ButtonLink to="/stream-deck" variant="secondary" size="sm">
          Stream Deck trigger URLs
        </ButtonLink>
      </div>

      <div className="macro-workspace">
        <aside className="macro-list" aria-label="Configured macros">
          {macros.map((macro) => (
            <button
              key={macro.id}
              type="button"
              className={editing?.id === macro.id ? "active" : ""}
              onClick={() => edit(macro)}
            >
              <span>{macro.name}</span>
              <small>
                {macro.steps.slice(0, 3).map(stepLabel).join(" -> ")}
                {macro.steps.length > 3 ? " -> ..." : ""}
              </small>
              <StatusPill tone={macro.enabled ? "success" : "neutral"} label={macro.enabled ? "Enabled" : "Disabled"} />
            </button>
          ))}
          {!macros.length && (
            <EmptyState title="No macros yet" description="Create one to chain OBS, Twitch, alert, and session actions." />
          )}
        </aside>

        <main className="macro-detail">
      {editing ? (
        <div className="card macro-editor-card">
          <h2>Edit macro</h2>
          <Callout title="Stream Deck ready">
            Save this macro, then use the Stream Deck page to copy its HTTP trigger URL.
          </Callout>
          <div className="form-row">
            <label>Name</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={editing.enabled}
              onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
            />{" "}
            Enabled
          </label>
          <div className="macro-step-picker">
            <div>
              <label>Add step</label>
              <select value={stepTemplateType} onChange={(e) => setStepTemplateType(e.target.value as MacroStep["type"])}>
                {STEP_TEMPLATES.map((item) => (
                  <option key={item.type} value={item.type}>{item.label}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addTemplate(STEP_TEMPLATES.find((item) => item.type === stepTemplateType)?.template ?? STEP_TEMPLATES[0].template)}
            >
              Add step
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
                  <Button type="button" variant="danger" size="sm" onClick={() => removeStep(index)}>Remove</Button>
                </div>
              </div>
            )) : (
              <EmptyState
                title={parsedSteps.ok ? "No steps yet" : "Step JSON needs attention"}
                description={parsedSteps.ok ? "Add a step to build this macro." : parsedSteps.error}
              />
            )}
          </div>

          <details className="alert-compact-section macro-json-editor">
            <summary>Advanced steps JSON</summary>
            <FormField label="Steps JSON" error={parsedSteps.ok ? undefined : parsedSteps.error}>
              <textarea
                rows={12}
                value={stepsJson}
                onChange={(e) => setStepsJson(e.target.value)}
                style={{ fontFamily: "monospace", lineHeight: 1.5 }}
              />
            </FormField>
          </details>

          {selectedSummary.length ? (
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
              {selectedSummary.join(" -> ")}
              {editing.steps.length > 4 ? " -> ..." : ""}
            </p>
          ) : null}
          <div className="actions" style={{ marginTop: 16 }}>
            <Button type="button" variant="primary" size="sm" onClick={() => void save()}>
              Save
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void runEditing()}>
              Run saved
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => void remove(editing.id)}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState title="Select a macro" description="Choose a macro from the list or create a new one to edit its ordered steps." />
      )}
        </main>
      </div>

      {lastRun.length ? (
        <div className="card">
          <h2>Last run</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Type</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {lastRun.map((step) => (
                <tr key={`${step.index}-${step.type}`}>
                  <td>{step.index + 1}</td>
                  <td>{step.type}</td>
                  <td>{step.ok ? "OK" : "Failed"}</td>
                  <td>{step.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
