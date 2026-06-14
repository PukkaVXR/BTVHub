import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  runLocalCommand: vi.fn(),
  sendTwitchChatMessage: vi.fn(),
  startStreamSession: vi.fn(),
  stopCurrentStreamSession: vi.fn(),
}));

vi.mock("./command-runner.js", () => ({ runLocalCommand: dependencies.runLocalCommand }));
vi.mock("./twitch-service.js", () => ({ sendTwitchChatMessage: dependencies.sendTwitchChatMessage }));
vi.mock("./db.js", () => ({
  startStreamSession: dependencies.startStreamSession,
  stopCurrentStreamSession: dependencies.stopCurrentStreamSession,
}));
vi.mock("./obs-client.js", () => ({
  pauseObsRecording: vi.fn(),
  resumeObsRecording: vi.fn(),
  runObsSourceMotion: vi.fn(),
  saveObsReplayBuffer: vi.fn(),
  setObsInputMuted: vi.fn(),
  setObsScene: vi.fn(),
  setObsSourceFilterEnabled: vi.fn(),
  setObsSourceVisible: vi.fn(),
  setObsText: vi.fn(),
  startObsRecording: vi.fn(),
  startObsReplayBuffer: vi.fn(),
  startObsStream: vi.fn(),
  stopObsRecording: vi.fn(),
  stopObsReplayBuffer: vi.fn(),
  stopObsStream: vi.fn(),
}));

import { ActionExecutor } from "./action-executor.js";

describe("ActionExecutor", () => {
  const alertQueue = { clear: vi.fn() };
  const applySourceGroup = vi.fn();
  let executor: ActionExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ActionExecutor(alertQueue as never, applySourceGroup);
  });

  it("waits for the full requested duration instead of truncating at 30 seconds", async () => {
    vi.useFakeTimers();
    const run = executor.execute({ type: "wait", durationMs: 300_000 });

    await vi.advanceTimersByTimeAsync(299_999);
    let settled = false;
    void run.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(run).resolves.toMatchObject({ ok: true, value: 300_000 });
    vi.useRealTimers();
  });

  it("caps waits at one hour", async () => {
    vi.useFakeTimers();
    const run = executor.execute({ type: "wait", durationMs: 9_000_000 });
    await vi.advanceTimersByTimeAsync(3_600_000);
    await expect(run).resolves.toMatchObject({ ok: true, value: 3_600_000 });
    vi.useRealTimers();
  });

  it("delegates source groups and reports cleared alerts", async () => {
    applySourceGroup.mockResolvedValue({ ok: true, message: "Applied live" });
    alertQueue.clear.mockReturnValue(4);

    await expect(executor.execute({ type: "source_group", sourceGroupId: "live" }))
      .resolves.toEqual({ ok: true, message: "Applied live" });
    await expect(executor.execute({ type: "clear_alerts" }))
      .resolves.toEqual({ ok: true, message: "Cleared 4 queued alert(s)", value: 4 });
  });

  it("requires explicit hooks for nested effects and macros", async () => {
    await expect(executor.execute({ type: "effect", effectId: "fx" }))
      .resolves.toMatchObject({ ok: false, message: "Effect executor unavailable" });
    await expect(executor.execute({ type: "macro", macroId: "nested" }))
      .resolves.toMatchObject({ ok: false, message: "Macro executor unavailable" });
  });
});
