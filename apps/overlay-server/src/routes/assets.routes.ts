import {
  deleteMediaAsset,
  deleteSoundAsset,
  listMediaAssets,
  listSoundAssets,
  saveMediaAsset,
  saveSoundAsset,
} from "../assets.js";
import type { FastifyReply } from "fastify";
import { downloadGiphyGif, searchGiphy, trendingGiphy, type GiphyAssetType } from "../giphy-service.js";
import type { RouteModule } from "./types.js";

type RateLimitBucket = { resetAt: number; count: number };
type CachedGiphyResponse = { expiresAt: number; results: Awaited<ReturnType<typeof searchGiphy>> };

const GIPHY_SEARCH_LIMIT = { max: 45, windowMs: 60_000 };
const GIPHY_IMPORT_LIMIT = { max: 20, windowMs: 60_000 };
const GIPHY_CACHE_MS = 60_000;
const giphyRateLimits = new Map<string, RateLimitBucket>();
const giphyCache = new Map<string, CachedGiphyResponse>();

export const registerAssetsRoutes: RouteModule = (app, ctx) => {
  const giphyType = (value?: string): GiphyAssetType => value === "sticker" ? "sticker" : "gif";

  const checkGiphyRateLimit = (
    key: string,
    limit: { max: number; windowMs: number },
  ): { ok: true } | { ok: false; retryAfterSeconds: number } => {
    const now = Date.now();
    const bucket = giphyRateLimits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      giphyRateLimits.set(key, { count: 1, resetAt: now + limit.windowMs });
      return { ok: true };
    }
    if (bucket.count >= limit.max) {
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    bucket.count += 1;
    return { ok: true };
  };

  const cachedGiphy = async (
    cacheKey: string,
    loader: () => Promise<Awaited<ReturnType<typeof searchGiphy>>>,
  ) => {
    const now = Date.now();
    const cached = giphyCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.results;
    const results = await loader();
    giphyCache.set(cacheKey, { expiresAt: now + GIPHY_CACHE_MS, results });
    return results;
  };

  const rateLimitReply = (reply: FastifyReply, retryAfterSeconds: number) => {
    reply.header("Retry-After", String(retryAfterSeconds));
    return reply.status(429).send({ error: `Too many GIPHY requests. Try again in ${retryAfterSeconds}s.` });
  };

  app.get("/api/assets/sounds", async () => ({ sounds: listSoundAssets(ctx.assetsDir) }));
  app.post("/api/assets/sounds", async (req, reply) => {
    const body = req.body as { name?: string; data?: string };
    if (!body?.name || !body?.data) return reply.status(400).send({ error: "name and data (base64) required" });
    try {
      const buf = Buffer.from(body.data, "base64");
      if (buf.length > 15 * 1024 * 1024) return reply.status(400).send({ error: "File too large (max 15MB)" });
      return saveSoundAsset(ctx.assetsDir, body.name, buf, { source: "upload", importedAt: new Date().toISOString() });
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });
  app.delete("/api/assets/sounds/:name", async (req) => {
    deleteSoundAsset(ctx.assetsDir, (req.params as { name: string }).name);
    return { ok: true };
  });

  app.get("/api/assets/media", async () => ({ media: listMediaAssets(ctx.assetsDir) }));
  app.post("/api/assets/media", async (req, reply) => {
    const body = req.body as { name?: string; data?: string };
    if (!body?.name || !body?.data) return reply.status(400).send({ error: "name and data (base64) required" });
    try {
      const buf = Buffer.from(body.data, "base64");
      if (buf.length > 50 * 1024 * 1024) return reply.status(400).send({ error: "File too large (max 50MB)" });
      return saveMediaAsset(ctx.assetsDir, body.name, buf, { source: "upload", importedAt: new Date().toISOString() });
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });
  app.delete("/api/assets/media/:name", async (req) => {
    deleteMediaAsset(ctx.assetsDir, (req.params as { name: string }).name);
    return { ok: true };
  });

  app.get("/api/assets/giphy/search", async (req, reply) => {
    const query = req.query as { q?: string; limit?: string; type?: string };
    const limited = checkGiphyRateLimit(`search:${req.ip}`, GIPHY_SEARCH_LIMIT);
    if (!limited.ok) return rateLimitReply(reply, limited.retryAfterSeconds);
    try {
      const q = (query.q ?? "").trim();
      const limit = Number(query.limit ?? 12);
      const type = giphyType(query.type);
      return {
        results: await cachedGiphy(`search:${type}:${limit}:${q.toLowerCase()}`, () => searchGiphy(q, limit, type)),
      };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "GIPHY search failed" });
    }
  });

  app.get("/api/assets/giphy/trending", async (req, reply) => {
    const query = req.query as { limit?: string; type?: string };
    const limited = checkGiphyRateLimit(`trending:${req.ip}`, GIPHY_SEARCH_LIMIT);
    if (!limited.ok) return rateLimitReply(reply, limited.retryAfterSeconds);
    try {
      const limit = Number(query.limit ?? 12);
      const type = giphyType(query.type);
      return {
        results: await cachedGiphy(`trending:${type}:${limit}`, () => trendingGiphy(limit, type)),
      };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "GIPHY trending failed" });
    }
  });

  app.post("/api/assets/giphy/import", async (req, reply) => {
    const limited = checkGiphyRateLimit(`import:${req.ip}`, GIPHY_IMPORT_LIMIT);
    if (!limited.ok) return rateLimitReply(reply, limited.retryAfterSeconds);
    const body = req.body as {
      id?: string;
      title?: string;
      originalUrl?: string;
      sourceUrl?: string;
      username?: string;
      type?: GiphyAssetType;
    };
    if (!body.originalUrl || !body.id) return reply.status(400).send({ error: "GIPHY id and originalUrl are required" });
    try {
      const data = await downloadGiphyGif(body.originalUrl);
      const safeTitle = (body.title ?? "giphy").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48) || "giphy";
      const prefix = body.type === "sticker" ? "giphy-sticker" : "giphy";
      const sourceType = body.type === "sticker" ? "sticker" : "gif";
      const saved = saveMediaAsset(ctx.assetsDir, `${prefix}-${body.id}-${safeTitle}.gif`, data, {
        source: "giphy",
        sourceType,
        sourceId: body.id,
        sourceUrl: body.sourceUrl,
        title: body.title,
        username: body.username,
        importedAt: new Date().toISOString(),
      });
      return { ...saved, size: data.length, source: "giphy", sourceId: body.id, sourceType };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "GIPHY import failed" });
    }
  });
};
