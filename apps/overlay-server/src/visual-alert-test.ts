import { createStreamEvent, type AlertProject, type StreamEventType } from "@btv/shared";
import type { OverlayBus } from "./bus.js";
import { getAlertProject, getAlertProjects } from "./db.js";

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
): ReturnType<typeof createStreamEvent> {
  const event = createStreamEvent({
    source: "manual",
    type: eventType,
    user: {
      id: "test",
      displayName: "TestUser",
      login: "testuser",
    },
    message: "Test visual alert from hub",
    amount: eventType === "cheer" ? 100 : eventType === "raid" ? 25 : undefined,
    payload: {
      alertProjectId: project.id,
      test: true,
    },
  });

  bus.broadcast(
    {
      kind: "alert:play",
      alert: {
        id: crypto.randomUUID(),
        event,
        themeId: project.id,
        html: "",
        css: "",
        js: "",
        durationMs: project.durationMs,
        visualProject: project,
      },
    },
    "alerts",
  );

  return event;
}
