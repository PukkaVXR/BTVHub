import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getMacro: vi.fn() }));
vi.mock("./db.js", () => ({ getMacro: db.getMacro }));

import { MacroRunner } from "./macro-runner.js";

describe("MacroRunner", () => {
  const execute = vi.fn();
  const fireManual = vi.fn();
  let runner: MacroRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new MacroRunner({ execute } as never, { fireManual } as never);
  });

  it("runs steps sequentially and maps legacy stream actions", async () => {
    db.getMacro.mockReturnValue({
      id: "go-live",
      name: "Go live",
      enabled: true,
      steps: [
        { type: "session_start" },
        { type: "obs_stream_start" },
        { type: "wait", durationMs: 300_000 },
      ],
    });
    execute.mockResolvedValue({ ok: true, message: "done" });

    const result = await runner.run("go-live");

    expect(result.ok).toBe(true);
    expect(execute.mock.calls.map(([action]) => action)).toEqual([
      { type: "session_start" },
      { type: "obs_streaming", action: "start" },
      { type: "wait", durationMs: 300_000 },
    ]);
  });

  it("stops immediately when a step fails", async () => {
    db.getMacro.mockReturnValue({
      id: "broken",
      name: "Broken macro",
      enabled: true,
      steps: [
        { type: "obs_scene", sceneName: "Starting" },
        { type: "wait", durationMs: 1000 },
      ],
    });
    execute.mockResolvedValueOnce({ ok: false, message: "OBS unavailable" });

    const result = await runner.run("broken");

    expect(result).toMatchObject({ ok: false, code: "MACRO_STEP_FAILED", retryable: true });
    expect(result.steps).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejects missing and disabled macros without executing actions", async () => {
    db.getMacro.mockReturnValueOnce(undefined).mockReturnValueOnce({ name: "Off", enabled: false, steps: [] });

    await expect(runner.run("missing")).resolves.toMatchObject({ ok: false, code: "MACRO_NOT_FOUND" });
    await expect(runner.run("disabled")).resolves.toMatchObject({ ok: false, code: "MACRO_DISABLED" });
    expect(execute).not.toHaveBeenCalled();
  });
});
