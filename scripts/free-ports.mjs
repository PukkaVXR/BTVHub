import { execFileSync } from "node:child_process";

const PORTS = [4781, 4782, 4783];

for (const port of PORTS) {
  freePort(port);
}

function freePort(port) {
  const pids = process.platform === "win32" ? getWindowsPids(port) : getPosixPids(port);

  if (!pids.length) {
    console.log(`Port ${port} is already free.`);
    return;
  }

  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.log(`Stopped process ${pid} on port ${port}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to stop process ${pid} on port ${port}: ${message}`);
    }
  }
}

function getWindowsPids(port) {
  const output = execFileSafe("netstat", ["-ano", "-p", "tcp"]);
  if (!output) return [];

  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    if (!parts[1]?.endsWith(`:${port}`)) continue;
    const pid = Number(parts[4]);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }

  return [...pids];
}

function getPosixPids(port) {
  const output = execFileSafe("lsof", ["-ti", `tcp:${port}`]);
  if (!output) return [];

  return [...new Set(output.split(/\r?\n/).map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0))];
}

function execFileSafe(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
