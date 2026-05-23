import type { FastifyInstance } from "fastify";
import { getAuthorizeUrl } from "@btv/twitch";
import {
  deleteSetting,
  getSetting,
  setEncryptedSetting,
  setSetting,
  logSystem,
} from "../db.js";
import { connectObs, getObsStatus } from "../obs-client.js";
import {
  getHubOrigin,
  getOAuthHost,
  getOverlayOrigin,
  getSpotifyAuthStartUrl,
  getSpotifyRedirectUri,
  getTwitchAuthStartUrl,
  getTwitchRedirectUri,
  setOAuthHost,
} from "../server-urls.js";
import {
  disconnectSpotify,
  getSpotifyAuthUrl,
  getSpotifyStatus,
  handleSpotifyCallback,
  startSpotifyPoller,
} from "../spotify-service.js";
import {
  disconnectTwitch,
  getTwitchConfig,
  getTwitchStatus,
  handleTwitchCallback,
} from "../twitch-service.js";
import type { ServerContext } from "./types.js";

export function registerIntegrationsRoutes(app: FastifyInstance, oauthApp: FastifyInstance, ctx: ServerContext): void {
  app.get("/api/integrations", async (_req, reply) => {
    try {
      return {
        oauthHost: getOAuthHost(),
        twitch: {
          ...getTwitchStatus(),
          clientId: getSetting("twitch_client_id") ?? "",
          redirectUri: getTwitchRedirectUri(),
          authStartUrl: getTwitchAuthStartUrl(),
        },
        spotify: {
          ...getSpotifyStatus(),
          clientId: getSetting("spotify_client_id") ?? "",
          redirectUri: getSpotifyRedirectUri(),
          authStartUrl: getSpotifyAuthStartUrl(),
        },
        obs: getObsStatus(),
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: err instanceof Error ? err.message : "Failed to load integrations" });
    }
  });

  app.put("/api/integrations/oauth-host", async (req) => {
    const body = req.body as { host: string };
    setOAuthHost(body.host);
    return {
      ok: true,
      oauthHost: getOAuthHost(),
      twitchRedirectUri: getTwitchRedirectUri(),
      spotifyRedirectUri: getSpotifyRedirectUri(),
    };
  });

  app.put("/api/integrations/twitch", async (req) => {
    const body = req.body as { clientId: string; clientSecret?: string };
    setSetting("twitch_client_id", body.clientId);
    if (body.clientSecret?.trim()) setEncryptedSetting("twitch_client_secret", body.clientSecret);
    logSystem("twitch", "info", "Twitch credentials saved", { hasClientSecret: Boolean(body.clientSecret?.trim()) });
    return { ok: true, redirectUri: getTwitchRedirectUri() };
  });

  app.put("/api/integrations/spotify", async (req) => {
    const body = req.body as { clientId: string; clientSecret?: string };
    setSetting("spotify_client_id", body.clientId);
    if (body.clientSecret?.trim()) setEncryptedSetting("spotify_client_secret", body.clientSecret);
    logSystem("spotify", "info", "Spotify credentials saved", { hasClientSecret: Boolean(body.clientSecret?.trim()) });
    return { ok: true };
  });

  app.put("/api/integrations/obs", async (req) => {
    const body = req.body as { host: string; port: number; password?: string };
    setSetting("obs_host", body.host);
    setSetting("obs_port", String(body.port));
    if (body.password?.trim()) setEncryptedSetting("obs_password", body.password);
    const ok = await connectObs();
    logSystem("obs", ok ? "info" : "error", ok ? "OBS configuration saved and connected" : "OBS configuration saved but connection failed", {
      host: body.host,
      port: body.port,
      hasPassword: Boolean(body.password?.trim()),
    });
    return { ok };
  });

  app.post("/api/integrations/twitch/disconnect", async () => {
    disconnectTwitch();
    logSystem("twitch", "warn", "Twitch disconnected by user");
    return { ok: true };
  });

  app.post("/api/integrations/spotify/disconnect", async () => {
    disconnectSpotify();
    logSystem("spotify", "warn", "Spotify disconnected by user");
    return { ok: true };
  });

  oauthApp.get("/auth/twitch", async (_req, reply) => {
    const config = getTwitchConfig();
    if (!config) return reply.status(400).send({ error: "Configure Twitch client ID/secret first" });
    const state = crypto.randomUUID();
    setSetting("oauth_state", state);
    logSystem("twitch", "info", "Twitch OAuth flow started", { redirectUri: config.redirectUri });
    app.log.info({ redirectUri: config.redirectUri }, "Twitch OAuth redirect_uri");
    return reply.redirect(getAuthorizeUrl(config, state));
  });

  oauthApp.get("/auth/twitch/callback", async (req, reply) => {
    const query = req.query as { code?: string; state?: string; error?: string; error_description?: string };
    if (query.error) {
      const desc = encodeURIComponent(query.error_description ?? query.error);
      logSystem("twitch", "error", "Twitch OAuth returned an error", { error: query.error, description: query.error_description });
      return reply.redirect(`${getHubOrigin()}/integrations?twitch_error=${query.error}&desc=${desc}`);
    }
    if (!query.code || query.state !== getSetting("oauth_state")) {
      logSystem("twitch", "error", "Twitch OAuth callback failed validation");
      return reply.redirect(`${getHubOrigin()}/integrations?error=oauth`);
    }
    await handleTwitchCallback(query.code);
    logSystem("twitch", "info", "Twitch OAuth connected");
    ctx.bootEventSub();
    return reply.redirect(`${getHubOrigin()}/integrations?twitch=connected`);
  });

  app.get("/auth/spotify", async (_req, reply) => {
    const state = crypto.randomUUID();
    setSetting("spotify_oauth_state", state);
    logSystem("spotify", "info", "Spotify OAuth flow started");
    return reply.redirect(getSpotifyAuthUrl(state));
  });

  app.get("/auth/spotify/callback", async (req, reply) => {
    const query = req.query as { code?: string; state?: string; error?: string };
    if (query.error) {
      logSystem("spotify", "error", "Spotify OAuth returned an error", { error: query.error });
      return reply.redirect(`${getHubOrigin()}/integrations?spotify_error=${encodeURIComponent(query.error)}`);
    }
    if (!query.code || query.state !== getSetting("spotify_oauth_state")) {
      logSystem("spotify", "error", "Spotify OAuth callback failed validation");
      return reply.redirect(`${getHubOrigin()}/integrations?error=oauth`);
    }
    try {
      await handleSpotifyCallback(query.code);
      startSpotifyPoller(ctx.bus);
      logSystem("spotify", "info", "Spotify OAuth connected");
      return reply.redirect(`${getHubOrigin()}/integrations?spotify=connected`);
    } catch (err) {
      const msg = encodeURIComponent(err instanceof Error ? err.message : "Spotify connect failed");
      logSystem("spotify", "error", "Spotify OAuth connection failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return reply.redirect(`${getHubOrigin()}/integrations?spotify_error=${msg}`);
    }
  });

  oauthApp.get("/", async () => ({
    ok: true,
    service: "BTV OAuth (HTTPS) - Twitch only",
    twitchRedirect: getTwitchRedirectUri(),
    spotifyRedirect: getSpotifyRedirectUri(),
    spotifyNote: "Spotify uses HTTP on port 4782",
  }));

  oauthApp.get("/auth/spotify", async (_req, reply) => {
    return reply.redirect(`${getOverlayOrigin()}/auth/spotify`);
  });

  oauthApp.get("/auth/spotify/callback", async (req, reply) => {
    return reply.redirect(`${getOverlayOrigin()}${req.url}`);
  });
}
