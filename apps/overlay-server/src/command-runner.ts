import { execFile } from "node:child_process";

const MAX_COMMAND_MS = 60_000;
const MAX_OUTPUT_CHARS = 300;

export interface CommandRunConfig {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}

export function runLocalCommand(config: CommandRunConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = config.command.trim();
    if (!command) {
      reject(new Error("Command is required"));
      return;
    }

    const timeout = Math.max(1, Math.min(Number(config.timeoutMs ?? 10_000), MAX_COMMAND_MS));
    execFile(command, config.args ?? [], {
      cwd: config.cwd,
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
