import {
  deleteMediaAsset,
  deleteSoundAsset,
  listMediaAssets,
  listSoundAssets,
  saveMediaAsset,
  saveSoundAsset,
} from "../assets.js";
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
};
