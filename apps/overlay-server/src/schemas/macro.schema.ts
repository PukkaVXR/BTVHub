import type { MacroConfig } from "../db.js";

export function macroFromBody(id: string, body: Partial<MacroConfig>): MacroConfig {
  return {
    id,
    name: body.name?.trim() || "Untitled macro",
    enabled: body.enabled ?? true,
    steps: Array.isArray(body.steps) ? body.steps : [],
  };
}
