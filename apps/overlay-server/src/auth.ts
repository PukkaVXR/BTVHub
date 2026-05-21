import type { FastifyReply, FastifyRequest } from "fastify";
import { getEncryptedSetting, setEncryptedSetting } from "./db.js";
import { getHubOrigin, getOAuthOrigin, getOverlayOrigin } from "./server-urls.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function ensureApiToken(): string {
  const existing = getEncryptedSetting("api_token");
  if (existing) return existing;

  const token = crypto.randomUUID().replaceAll("-", "");
  setEncryptedSetting("api_token", token);
  return token;
}

export function getAllowedOrigins(): string[] {
  return [getHubOrigin(), getOverlayOrigin(), getOAuthOrigin()];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}

export async function requireTrustedLocalWrite(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (!MUTATING_METHODS.has(req.method)) return;
  if (!req.url.startsWith("/api/")) return;

  const origin = req.headers.origin;
  if (Array.isArray(origin)) {
    return reply.status(403).send({
      ok: false,
      code: "UNTRUSTED_ORIGIN",
      message: "Cross-origin API writes are not allowed",
    });
  }

  if (origin && !isAllowedOrigin(origin)) {
    return reply.status(403).send({
      ok: false,
      code: "UNTRUSTED_ORIGIN",
      message: "Cross-origin API writes are not allowed",
    });
  }

  const token = req.headers["x-btv-token"];
  if (token && token !== ensureApiToken()) {
    return reply.status(401).send({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid X-BTV-Token",
    });
  }
}
