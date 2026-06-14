import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "@btv/shared";

const db = vi.hoisted(() => ({
  logActivity: vi.fn(),
  logSessionEvent: vi.fn(),
  getWidgets: vi.fn(() => []),
  awardLoyaltyPoints: vi.fn(() => null),
}));

vi.mock("./db.js", () => ({
  awardLoyaltyPoints: db.awardLoyaltyPoints,
  getAlertProject: vi.fn(),
  getAlertRules: vi.fn(() => []),
  getTheme: vi.fn(),
  getWidgets: db.getWidgets,
  logActivity: db.logActivity,
  logSessionEvent: db.logSessionEvent,
  updateGoal: vi.fn(),
}));
vi.mock("./chat-command-runner.js", () => ({ runChatCommandFromEvent: vi.fn() }));
vi.mock("./alert-template-vars.js", () => ({ withAutomationVariables: (event: StreamEvent) => event }));

import { RulesEngine } from "./rules-engine.js";

describe("RulesEngine", () => {
  const broadcast = vi.fn();
  const publish = vi.fn();
  const publishStreamEvent = vi.fn();
  const handleAutomation = vi.fn();
  let engine: RulesEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new RulesEngine(
      { broadcast } as never,
      { enqueue: vi.fn() } as never,
      { tryTriggerFromEvent: vi.fn() } as never,
      { publish, publishStreamEvent } as never,
      { handleEvent: handleAutomation } as never,
    );
  });

  it("normalizes chat commands and publishes Twitch presentation data", async () => {
    const event: StreamEvent = {
      id: "chat-1",
      source: "twitch",
      type: "chat",
      user: { id: "u1", login: "viewer", displayName: "Viewer" },
      message: "!hello world",
      payload: {
        color: "#12abef",
        badges: [{ setId: "subscriber", id: "12", info: "18" }],
        roles: ["subscriber"],
      },
      at: new Date().toISOString(),
    };

    await engine.handleEvent(event);

    expect(publishStreamEvent).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ isCommand: true, command: "!hello", args: "world" }),
    }));
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.command" }));
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({
      kind: "chat:message",
      message: expect.objectContaining({
        color: "#12abef",
        badges: [{ setId: "subscriber", id: "12", info: "18" }],
      }),
    }), "chat");
    expect(handleAutomation).toHaveBeenCalled();
  });
});
