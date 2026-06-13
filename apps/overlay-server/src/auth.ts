import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { HUB_PORT, OAUTH_HTTPS_PORT, OVERLAY_PORT } from "@btv/shared";
import { getEncryptedSetting, setEncryptedSetting } from "./db.js";
import { getHubOrigin, getOAuthOrigin, getOverlayOrigin } from "./server-urls.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/overlay-theme",
  "/api/widgets/chat-config",
  "/api/widgets/chat-badges",
  "/api/widgets/event-list-config",
  "/api/widgets/ticker-config",
  "/api/boss-fight",
  "/api/chat-chaos",
  "/api/predictions",
  "/api/tournament-scoreboard",
]);

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

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isLocalOrigin(origin: string, protocol: "http:" | "https:", port: number): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === protocol && Number(url.port) === port && isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin) ||
    isLocalOrigin(origin, "http:", HUB_PORT) ||
    isLocalOrigin(origin, "http:", OVERLAY_PORT) ||
    isLocalOrigin(origin, "https:", OAUTH_HTTPS_PORT);
}

export function isTrustedHubOrigin(origin: string | undefined): boolean {
  return typeof origin === "string" &&
    (origin === getHubOrigin() || isLocalOrigin(origin, "http:", HUB_PORT));
}

export function isValidApiToken(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const expected = ensureApiToken();
  const receivedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function isPublicApiPath(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return PUBLIC_API_PATHS.has(path);
}

export async function issueApiTokenToTrustedHub(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const origin = req.headers.origin;
  if (Array.isArray(origin) || !isTrustedHubOrigin(origin)) {
    return reply.status(403).send({
      ok: false,
      code: "UNTRUSTED_ORIGIN",
      message: "API token bootstrap is only available to the local Hub",
    });
  }
  return { token: ensureApiToken() };
}

export async function requireTrustedLocalWrite(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (!req.url.startsWith("/api/")) return;
  if (req.method === "OPTIONS") return;
  if (req.url.startsWith("/api/auth/token")) return;
  if (!MUTATING_METHODS.has(req.method) && isPublicApiPath(req.url)) return;

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

  if (origin && !isTrustedHubOrigin(origin)) {
    return reply.status(403).send({
      ok: false,
      code: "ADMIN_WRITE_ORIGIN_REQUIRED",
      message: "Admin API writes must come from the local Hub",
    });
  }

  const token = req.headers["x-btv-token"];
  if (Array.isArray(token) || !isValidApiToken(token)) {
    return reply.status(401).send({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Missing or invalid X-BTV-Token",
    });
  }
}
