import { createStreamEvent, type AlertProject, type StreamEventType } from "@btv/shared";
import type { OverlayBus } from "./bus.js";
import { getAlertProject, getAlertProjects } from "./db.js";
import { resolveAlertProjectVariation } from "./alert-variations.js";
import { withAutomationVariables } from "./alert-template-vars.js";

export interface VisualAlertTestPayload {
  user?: string;
  login?: string;
  message?: string;
  amount?: number;
  payload?: Record<string, unknown>;
}

export function findTestAlertProject(eventType: StreamEventType): AlertProject | null {
  const projects = getAlertProjects();
  return projects.find((project) => project.eventType === eventType)
    ?? getAlertProject("alert-default")
    ?? projects[0]
    ?? null;
}

export function broadcastVisualAlertTest(
  bus: OverlayBus,
  project: AlertProject,
  eventType: StreamEventType = project.eventType,
  testPayload: VisualAlertTestPayload = {},
  variationId?: string,
): ReturnType<typeof createStreamEvent> {
  const event = withAutomationVariables(createStreamEvent({
    source: "manual",
    type: eventType,
    user: {
      id: "test",
      displayName: testPayload.user ?? "TestUser",
      login: testPayload.login ?? "testuser",
    },
    message: testPayload.message ?? "Test visual alert from hub",
    amount: testPayload.amount ?? (eventType === "cheer" ? 100 : eventType === "raid" ? 25 : undefined),
    payload: {
      ...(testPayload.payload ?? {}),
      alertProjectId: project.id,
      test: true,
    },
  }));
  const resolved = resolveAlertProjectVariation(project, event, variationId);

  bus.broadcast(
    {
      kind: "alert:play",
      alert: {
        id: crypto.randomUUID(),
        event,
        themeId: resolved.project.id,
        html: "",
        css: "",
        js: "",
        durationMs: resolved.project.durationMs,
        visualProject: resolved.project,
      },
    },
    "alerts",
  );

  return event;
}
