import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationRule, StreamEvent } from "@btv/shared";

const db = vi.hoisted(() => ({
  rules: [] as AutomationRule[],
  runs: [] as Array<[string, string, string, string]>,
  getAutomationRules: vi.fn(() => db.rules),
  getSetting: vi.fn(() => undefined),
  getAutomationStateValue: vi.fn(),
  recordAutomationRuleRun: vi.fn((...args: [string, string, string, string]) => db.runs.push(args)),
}));

vi.mock("./db.js", () => ({
  deleteAutomationStateValue: vi.fn(),
  getAutomationRules: db.getAutomationRules,
  getAutomationStateValue: db.getAutomationStateValue,
  getAlertProject: vi.fn(),
  getSetting: db.getSetting,
  getTheme: vi.fn(),
  recordAutomationRuleRun: db.recordAutomationRuleRun,
  setAutomationStateValue: vi.fn(),
  updateWidgetText: vi.fn(),
}));

import { EventAutomationEngine } from "./event-automation-engine.js";

function event(overrides: Partial<StreamEvent> = {}): StreamEvent {
  return {
    id: "event-1",
    source: "manual",
    type: "cheer",
    amount: 100,
    message: "big hype",
    payload: { roles: ["subscriber"] },
    at: new Date().toISOString(),
    ...overrides,
  };
}

function rule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule-1",
    name: "Cheer response",
    enabled: true,
    trigger: { type: "stream_event", eventType: "cheer" },
    conditions: [],
    actions: [{ type: "twitch_chat", message: "Thanks {user}" }],
    cooldownMs: 0,
    runCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("EventAutomationEngine", () => {
  const execute = vi.fn();
  let engine: EventAutomationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    db.rules = [];
    db.runs = [];
    execute.mockResolvedValue({ ok: true, message: "sent" });
    engine = new EventAutomationEngine(
      { execute } as never,
      { run: vi.fn() } as never,
      { fireManual: vi.fn() } as never,
      { broadcast: vi.fn() } as never,
      { enqueue: vi.fn(), clear: vi.fn() } as never,
    );
  });

  it("runs matching rules when all conditions pass", async () => {
    db.rules = [rule({
      conditions: [
        { type: "min_amount", amount: 50 },
        { type: "message_includes", text: "hype" },
        { type: "user_role", role: "subscriber" },
      ],
    })];

    await engine.handleEvent(event({ user: { id: "u1", login: "viewer", displayName: "Viewer" } }));

    expect(execute).toHaveBeenCalledWith({ type: "twitch_chat", message: "Thanks Viewer" }, expect.any(Object));
    expect(db.runs.at(-1)?.[2]).toBe("ok");
  });

  it("records skipped rules when a condition fails", async () => {
    db.rules = [rule({ conditions: [{ type: "min_amount", amount: 500 }] })];

    await engine.handleEvent(event());

    expect(execute).not.toHaveBeenCalled();
    expect(db.runs.at(-1)).toEqual(["rule-1", "event-1", "skipped", "Condition not met: min_amount"]);
  });

  it("enforces cooldowns for live events but permits explicit tests", async () => {
    db.rules = [rule({ cooldownMs: 60_000 })];

    await engine.handleEvent(event());
    await engine.handleEvent(event({ id: "event-2" }));
    const testResult = await engine.runTest("rule-1", event({ id: "event-test" }));

    expect(execute).toHaveBeenCalledTimes(2);
    expect(db.runs.some((run) => run[1] === "event-2" && run[2] === "skipped")).toBe(true);
    expect(testResult.ok).toBe(true);
  });
});
