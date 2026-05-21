import { useEffect, useMemo, useState } from "react";
import { api, type MacroConfig, type MacroStep } from "../api";
import { useToast } from "../hooks/useToast";

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

export default function MacrosPage() {
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [editing, setEditing] = useState<MacroConfig | null>(null);
  const [stepsJson, setStepsJson] = useState("[]");
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

  const addTemplate = (step: MacroStep) => {
    const parsed = validateSteps(stepsJson);
    const steps = parsed.ok ? parsed.steps : [];
    setStepsJson(JSON.stringify([...steps, step], null, 2));
  };

  return (
    <>
      <h1>Macros</h1>
      <p className="subtitle">Create ordered stream actions for Stream Deck keys and dashboard controls.</p>

      <div className="actions" style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => edit(emptyMacro())}>
          New macro
        </button>
      </div>

      {editing && (
        <div className="card">
          <h2>Edit macro</h2>
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
          <div className="form-row">
            <label>Steps JSON</label>
            <textarea
              rows={12}
              value={stepsJson}
              onChange={(e) => setStepsJson(e.target.value)}
              style={{ fontFamily: "monospace", lineHeight: 1.5 }}
            />
          </div>
          <div className="actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "wait", durationMs: 1000 })}>
              Add wait
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "clear_alerts" })}>
              Add clear
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "session_start" })}>
              Add session start
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "obs_scene", sceneName: "Starting" })}>
              Add scene
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "obs_stream_start" })}>
              Add stream start
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "obs_stream_stop" })}>
              Add stream stop
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "obs_record_start" })}>
              Add record start
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "obs_replay_buffer_save" })}>
              Add save replay
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTemplate({ type: "twitch_chat", message: "Going live now!" })}>
              Add Twitch chat
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addTemplate({ type: "obs_filter", sourceName: "Camera", filterName: "Blur", enabled: true })}
            >
              Add filter
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addTemplate({
                type: "run_command",
                command: "powershell.exe",
                args: ["-NoProfile", "-File", "scripts/example.ps1"],
                timeoutMs: 10000,
                successChatMessage: "Command finished successfully!",
              })}
            >
              Add command
            </button>
          </div>
          {selectedSummary.length ? (
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
              {selectedSummary.join(" -> ")}
              {editing.steps.length > 4 ? " -> ..." : ""}
            </p>
          ) : null}
          <div className="actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void runEditing()}>
              Run saved
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Configured macros</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Steps</th>
              <th>On</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {macros.map((macro) => (
              <tr key={macro.id}>
                <td>{macro.name}</td>
                <td style={{ fontSize: 13 }}>
                  {macro.steps.slice(0, 3).map(stepLabel).join(" -> ")}
                  {macro.steps.length > 3 ? " -> ..." : ""}
                </td>
                <td>{macro.enabled ? "Yes" : "No"}</td>
                <td>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void run(macro)}>
                    Run
                  </button>{" "}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => edit(macro)}>
                    Edit
                  </button>{" "}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(macro.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
