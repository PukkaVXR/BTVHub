import { getEncryptedSetting, logSystem } from "./db.js";

const GIPHY_API = "https://api.giphy.com/v1/gifs";

interface GiphyApiImage {
  url?: string;
  width?: string;
  height?: string;
  size?: string;
}

interface GiphyApiGif {
  id?: string;
  title?: string;
  url?: string;
  username?: string;
  images?: {
    original?: GiphyApiImage;
    downsized?: GiphyApiImage;
    fixed_width?: GiphyApiImage;
    preview_gif?: GiphyApiImage;
  };
}

export interface GiphyResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  sourceUrl?: string;
  username?: string;
}

function apiKey(): string {
  const key = getEncryptedSetting("giphy_api_key");
  if (!key) throw new Error("GIPHY API key is not configured");
  return key;
}

function normalizeGif(gif: GiphyApiGif): GiphyResult | null {
  const original = gif.images?.original;
  const downsized = gif.images?.downsized ?? original;
  const preview = gif.images?.fixed_width ?? gif.images?.preview_gif ?? downsized;
  const originalUrl = original?.url ?? downsized?.url;
  const previewUrl = preview?.url ?? originalUrl;
  if (!gif.id || !originalUrl || !previewUrl) return null;
  return {
    id: gif.id,
    title: gif.title || "Untitled GIF",
    url: downsized?.url ?? originalUrl,
    previewUrl,
    originalUrl,
    width: Number(original?.width ?? downsized?.width ?? 0),
    height: Number(original?.height ?? downsized?.height ?? 0),
    sourceUrl: gif.url,
    username: gif.username,
  };
}

async function callGiphy(path: string, params: Record<string, string | number>): Promise<GiphyResult[]> {
  const url = new URL(`${GIPHY_API}/${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) {
    logSystem("giphy", "error", "GIPHY request failed", { status: res.status, path });
    throw new Error(`GIPHY request failed (${res.status})`);
  }
  const json = (await res.json()) as { data?: GiphyApiGif[] };
  return (json.data ?? []).map(normalizeGif).filter((gif): gif is GiphyResult => Boolean(gif));
}

export async function searchGiphy(query: string, limit = 12): Promise<GiphyResult[]> {
  const q = query.trim();
  if (!q) return [];
  return callGiphy("search", {
    q,
    limit: Math.max(1, Math.min(25, limit)),
    rating: "pg-13",
    lang: "en",
  });
}

export async function trendingGiphy(limit = 12): Promise<GiphyResult[]> {
  return callGiphy("trending", {
    limit: Math.max(1, Math.min(25, limit)),
    rating: "pg-13",
  });
}

export async function downloadGiphyGif(url: string): Promise<Buffer> {
  if (!url.startsWith("https://media") && !url.includes("giphy.com")) {
    throw new Error("Only GIPHY media URLs can be imported");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download GIF (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("gif")) throw new Error("Selected GIPHY asset is not a GIF");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 25 * 1024 * 1024) throw new Error("GIF is too large to import (max 25MB)");
  return bytes;
}
