import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const targetArg = process.argv[2];

if (!targetArg) {
  console.error("Usage: node scripts/clean-dist.mjs <relative-output-dir>");
  process.exit(1);
}

const rootDir = resolve(import.meta.dirname, "..");
const targetDir = resolve(rootDir, "apps", "overlay-server", targetArg);
const staleRoot = resolve(rootDir, ".tmp", "build-stale");
const staleName = `overlay-server-${targetArg.replace(/[\\/]/g, "-")}-${Date.now()}`;
const staleDir = resolve(staleRoot, staleName);

if (existsSync(targetDir)) {
  await mkdir(staleRoot, { recursive: true });
  await rename(targetDir, staleDir);
}

await mkdir(targetDir, { recursive: true });

for (const entry of await readdir(staleRoot, { withFileTypes: true }).catch(() => [])) {
  if (!entry.isDirectory() || !entry.name.startsWith(`overlay-server-${targetArg.replace(/[\\/]/g, "-")}-`) || entry.name === staleName) continue;
  try {
    await rm(resolve(staleRoot, entry.name), { recursive: true, force: true });
  } catch {
    // Ignore Windows file-lock cleanup failures; the next build can rotate again.
  }
}
