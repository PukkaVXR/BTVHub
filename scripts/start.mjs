import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commandEnv = createCommandEnv(rootDir);

runNodeScript(resolve(rootDir, "scripts", "free-ports.mjs"));

console.log("Starting BTV Hub at http://127.0.0.1:4781");
console.log("Overlays (HTTP):  http://127.0.0.1:4782");
console.log("OAuth (HTTPS):    https://127.0.0.1:4783");

const pnpmCommand = resolvePnpmCommand(rootDir);
const result = spawnSync(pnpmCommand.command, pnpmCommand.args.concat("dev"), {
  cwd: rootDir,
  env: commandEnv,
  stdio: "inherit",
  shell: pnpmCommand.shell
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: rootDir,
    env: commandEnv,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolvePnpmCommand(currentRoot) {
  const localPnpm = resolve(currentRoot, "pnpm.exe");
  if (process.platform === "win32" && existsSync(localPnpm)) {
    return { command: localPnpm, args: [], shell: false };
  }

  if (process.platform === "win32") {
    return { command: "pnpm.cmd", args: [], shell: true };
  }

  return { command: "pnpm", args: [], shell: false };
}

function createCommandEnv(currentRoot) {
  const tempDir = resolve(currentRoot, ".tmp");
  mkdirSync(tempDir, { recursive: true });
  return {
    ...process.env,
    TEMP: tempDir,
    TMP: tempDir,
  };
}
