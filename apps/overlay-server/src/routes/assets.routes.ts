import {
  deleteMediaAsset,
  deleteSoundAsset,
  listMediaAssets,
  listSoundAssets,
  saveMediaAsset,
  saveSoundAsset,
} from "../assets.js";
import { downloadGiphyGif, searchGiphy, trendingGiphy } from "../giphy-service.js";
import type { RouteModule } from "./types.js";

export const registerAssetsRoutes: RouteModule = (app, ctx) => {
  app.get("/api/assets/sounds", async () => ({ sounds: listSoundAssets(ctx.assetsDir) }));
  app.post("/api/assets/sounds", async (req, reply) => {
    const body = req.body as { name?: string; data?: string };
    if (!body?.name || !body?.data) return reply.status(400).send({ error: "name and data (base64) required" });
    try {
      const buf = Buffer.from(body.data, "base64");
      if (buf.length > 15 * 1024 * 1024) return reply.status(400).send({ error: "File too large (max 15MB)" });
      return saveSoundAsset(ctx.assetsDir, body.name, buf);
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
      return saveMediaAsset(ctx.assetsDir, body.name, buf);
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });
  app.delete("/api/assets/media/:name", async (req) => {
    deleteMediaAsset(ctx.assetsDir, (req.params as { name: string }).name);
    return { ok: true };
  });

  app.get("/api/assets/giphy/search", async (req, reply) => {
    const query = req.query as { q?: string; limit?: string };
    try {
      return { results: await searchGiphy(query.q ?? "", Number(query.limit ?? 12)) };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "GIPHY search failed" });
    }
  });

  app.get("/api/assets/giphy/trending", async (req, reply) => {
    const query = req.query as { limit?: string };
    try {
      return { results: await trendingGiphy(Number(query.limit ?? 12)) };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "GIPHY trending failed" });
    }
  });

  app.post("/api/assets/giphy/import", async (req, reply) => {
    const body = req.body as { id?: string; title?: string; originalUrl?: string };
    if (!body.originalUrl || !body.id) return reply.status(400).send({ error: "GIPHY id and originalUrl are required" });
    try {
      const data = await downloadGiphyGif(body.originalUrl);
      const safeTitle = (body.title ?? "giphy").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48) || "giphy";
      const saved = saveMediaAsset(ctx.assetsDir, `giphy-${body.id}-${safeTitle}.gif`, data);
      return { ...saved, source: "giphy", sourceId: body.id };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "GIPHY import failed" });
    }
  });
};
