import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";

const SOUND_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".webm"]);
const MEDIA_EXT = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".gif",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

export function getSoundsDir(assetsRoot: string): string {
  const dir = join(assetsRoot, "sounds");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getMediaDir(assetsRoot: string): string {
  const dir = join(assetsRoot, "media");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function inferMediaKind(filename: string): "video" | "image" | "gif" {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (ext === ".gif") return "gif";
  if (VIDEO_EXT.has(ext)) return "video";
  return "image";
}

export function listSoundAssets(assetsRoot: string): Array<{
  name: string;
  url: string;
  size: number;
}> {
  const dir = getSoundsDir(assetsRoot);
  return readdirSync(dir)
    .filter((name) => SOUND_EXT.has(name.slice(name.lastIndexOf(".")).toLowerCase()))
    .map((name) => {
      const full = join(dir, name);
      return {
        name,
        url: `/assets/sounds/${encodeURIComponent(name)}`,
        size: statSync(full).size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listMediaAssets(assetsRoot: string): Array<{
  name: string;
  url: string;
  size: number;
  kind: "video" | "image" | "gif";
}> {
  const dir = getMediaDir(assetsRoot);
  return readdirSync(dir)
    .filter((name) => MEDIA_EXT.has(name.slice(name.lastIndexOf(".")).toLowerCase()))
    .map((name) => {
      const full = join(dir, name);
      return {
        name,
        url: `/assets/media/${encodeURIComponent(name)}`,
        size: statSync(full).size,
        kind: inferMediaKind(name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function saveSoundAsset(
  assetsRoot: string,
  filename: string,
  data: Buffer,
): { name: string; url: string } {
  const safe = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe || !SOUND_EXT.has(safe.slice(safe.lastIndexOf(".")).toLowerCase())) {
    throw new Error("Invalid sound file name or extension");
  }
  const dir = getSoundsDir(assetsRoot);
  const full = join(dir, safe);
  writeFileSync(full, data);
  return { name: safe, url: `/assets/sounds/${encodeURIComponent(safe)}` };
}

export function saveMediaAsset(
  assetsRoot: string,
  filename: string,
  data: Buffer,
): { name: string; url: string; kind: "video" | "image" | "gif" } {
  const safe = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe || !MEDIA_EXT.has(safe.slice(safe.lastIndexOf(".")).toLowerCase())) {
    throw new Error("Invalid media file name or extension");
  }
  const dir = getMediaDir(assetsRoot);
  const full = join(dir, safe);
  writeFileSync(full, data);
  return {
    name: safe,
    url: `/assets/media/${encodeURIComponent(safe)}`,
    kind: inferMediaKind(safe),
  };
}

export function deleteSoundAsset(assetsRoot: string, filename: string): void {
  const safe = basename(filename);
  const full = join(getSoundsDir(assetsRoot), safe);
  if (existsSync(full)) unlinkSync(full);
}

export function deleteMediaAsset(assetsRoot: string, filename: string): void {
  const safe = basename(filename);
  const full = join(getMediaDir(assetsRoot), safe);
  if (existsSync(full)) unlinkSync(full);
}
