import type { StreamEvent } from "@btv/shared";
import { getAutomationStateSnapshot } from "./db.js";

export function withAutomationVariables(event: StreamEvent): StreamEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      variables: {
        ...getAutomationStateSnapshot(),
        ...(isRecord(event.payload.variables) ? event.payload.variables : {}),
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
