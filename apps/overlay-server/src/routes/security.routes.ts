import type { Effect } from "@btv/shared";
import {
  approveLocalCommand,
  listLocalCommandApprovals,
  localCommandId,
  normalizeCommandConfig,
  revokeLocalCommand,
  type CommandRunConfig,
  type LocalCommandRequest,
} from "../command-runner.js";
import { getEffects, getMacros } from "../db.js";
import type { RouteModule } from "./types.js";

export const registerSecurityRoutes: RouteModule = (app) => {
  app.get("/api/security/local-commands", async () => {
    const approvals = listLocalCommandApprovals();
    return {
      approvals,
      requests: discoverLocalCommandRequests(approvals.map((approval) => approval.id)),
    };
  });

  app.post("/api/security/local-commands/approve", async (req, reply) => {
    const body = req.body as Partial<CommandRunConfig> & { label?: string } | undefined;
    const command = typeof body?.command === "string" ? body.command : "";
    if (!command.trim()) return reply.status(400).send({ error: "Command is required" });
    const approval = approveLocalCommand({
      command,
      args: Array.isArray(body?.args) ? body.args.map(String) : [],
      cwd: typeof body?.cwd === "string" ? body.cwd : undefined,
      timeoutMs: typeof body?.timeoutMs === "number" ? body.timeoutMs : undefined,
    }, typeof body?.label === "string" ? body.label : undefined);
    return { ok: true, approval };
  });

  app.delete("/api/security/local-commands/:id", async (req) => {
    const { id } = req.params as { id: string };
    return { ok: revokeLocalCommand(id) };
  });
};

function discoverLocalCommandRequests(approvedIds: string[]): LocalCommandRequest[] {
  const seen = new Map<string, LocalCommandRequest>();
  for (const macro of getMacros()) {
    for (const step of macro.steps) {
      if (step.type !== "run_command") continue;
      addRequest(seen, approvedIds, step, "macro", macro.id, macro.name);
    }
  }
  for (const effect of getEffects()) {
    if (effect.type !== "run_command") continue;
    addRequest(seen, approvedIds, effectConfigToCommand(effect), "effect", effect.id, effect.name);
  }
  return Array.from(seen.values()).sort((a, b) => a.sourceName.localeCompare(b.sourceName));
}

function addRequest(
  seen: Map<string, LocalCommandRequest>,
  approvedIds: string[],
  config: CommandRunConfig,
  sourceType: LocalCommandRequest["sourceType"],
  sourceId: string,
  sourceName: string,
): void {
  const normalized = normalizeCommandConfig(config);
  if (!normalized.command) return;
  const id = localCommandId(normalized);
  const key = `${id}:${sourceType}:${sourceId}`;
  seen.set(key, {
    id,
    ...normalized,
    createdAt: "",
    approved: approvedIds.includes(id),
    sourceType,
    sourceId,
    sourceName,
    label: sourceName,
  });
}

function effectConfigToCommand(effect: Effect): CommandRunConfig {
  return {
    command: String(effect.effectConfig.command ?? ""),
    args: Array.isArray(effect.effectConfig.args) ? effect.effectConfig.args.map(String) : [],
    cwd: effect.effectConfig.cwd ? String(effect.effectConfig.cwd) : undefined,
    timeoutMs: Number(effect.effectConfig.timeoutMs ?? 10_000),
  };
}
