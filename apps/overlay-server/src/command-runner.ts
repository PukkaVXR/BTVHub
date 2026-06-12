import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { getSetting, logSystem, setSetting } from "./db.js";

const MAX_COMMAND_MS = 60_000;
const MAX_OUTPUT_CHARS = 300;
const LOCAL_COMMAND_ALLOWLIST_KEY = "security.local_command_allowlist";

export interface CommandRunConfig {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}

export interface LocalCommandApproval {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  createdAt: string;
  label?: string;
}

export interface LocalCommandRequest extends LocalCommandApproval {
  approved: boolean;
  sourceType: "macro" | "effect";
  sourceId: string;
  sourceName: string;
}

export function runLocalCommand(config: CommandRunConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const normalized = normalizeCommandConfig(config);
    const command = normalized.command;
    if (!command) {
      reject(new Error("Command is required"));
      return;
    }
    if (!isLocalCommandAllowed(normalized)) {
      const id = localCommandId(normalized);
      logSystem("security", "warn", "Blocked local command that is not allowlisted", {
        command,
        id,
      });
      reject(new Error(`Local command is not allowlisted. Approve command ${id} in Setup first.`));
      return;
    }

    const timeout = Math.max(1, Math.min(Number(config.timeoutMs ?? 10_000), MAX_COMMAND_MS));
    execFile(command, normalized.args, {
      cwd: normalized.cwd,
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 128,
    }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message));
        return;
      }
      resolve((stdout.trim() || stderr.trim() || "Command complete").slice(0, MAX_OUTPUT_CHARS));
    });
  });
}

export function normalizeCommandConfig(config: CommandRunConfig): Omit<LocalCommandApproval, "id" | "createdAt"> {
  return {
    command: String(config.command ?? "").trim(),
    args: Array.isArray(config.args) ? config.args.map(String) : [],
    cwd: config.cwd ? String(config.cwd).trim() : undefined,
  };
}

export function localCommandId(config: CommandRunConfig): string {
  const normalized = normalizeCommandConfig(config);
  return createHash("sha256")
    .update(JSON.stringify({
      command: normalized.command,
      args: normalized.args,
      cwd: normalized.cwd ?? "",
    }))
    .digest("hex")
    .slice(0, 16);
}

export function listLocalCommandApprovals(): LocalCommandApproval[] {
  const raw = getSetting(LOCAL_COMMAND_ALLOWLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => normalizeApproval(item));
  } catch {
    return [];
  }
}

export function approveLocalCommand(config: CommandRunConfig, label?: string): LocalCommandApproval {
  const normalized = normalizeCommandConfig(config);
  const id = localCommandId(normalized);
  const existing = listLocalCommandApprovals().filter((approval) => approval.id !== id);
  const approval: LocalCommandApproval = {
    id,
    ...normalized,
    createdAt: new Date().toISOString(),
    label,
  };
  setSetting(LOCAL_COMMAND_ALLOWLIST_KEY, JSON.stringify([approval, ...existing]));
  logSystem("security", "info", "Local command allowlisted", { id, command: approval.command });
  return approval;
}

export function revokeLocalCommand(id: string): boolean {
  const approvals = listLocalCommandApprovals();
  const next = approvals.filter((approval) => approval.id !== id);
  setSetting(LOCAL_COMMAND_ALLOWLIST_KEY, JSON.stringify(next));
  if (next.length !== approvals.length) {
    logSystem("security", "warn", "Local command approval revoked", { id });
    return true;
  }
  return false;
}

export function isLocalCommandAllowed(config: CommandRunConfig): boolean {
  const id = localCommandId(config);
  return listLocalCommandApprovals().some((approval) => approval.id === id);
}

function normalizeApproval(item: unknown): LocalCommandApproval[] {
  if (!item || typeof item !== "object") return [];
  const raw = item as Partial<LocalCommandApproval>;
  if (!raw.command || typeof raw.command !== "string") return [];
  const normalized = normalizeCommandConfig({
    command: raw.command,
    args: Array.isArray(raw.args) ? raw.args.map(String) : [],
    cwd: raw.cwd,
  });
  return [{
    id: typeof raw.id === "string" ? raw.id : localCommandId(normalized),
    ...normalized,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    label: typeof raw.label === "string" ? raw.label : undefined,
  }];
}
