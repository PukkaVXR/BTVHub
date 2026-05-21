export const HUB_PORT = 4781;
/** HTTP — overlays, API, WebSocket (OBS Browser Sources) */
export const OVERLAY_PORT = 4782;
/** HTTPS — Twitch/Spotify OAuth callbacks only */
export const OAUTH_HTTPS_PORT = 4783;
export const HOST = "127.0.0.1";

export const HUB_URL = `http://${HOST}:${HUB_PORT}`;
export const OVERLAY_URL = `http://${HOST}:${OVERLAY_PORT}`;
export const OVERLAY_WS_URL = `ws://${HOST}:${OVERLAY_PORT}/ws`;
export const OAUTH_URL = `https://${HOST}:${OAUTH_HTTPS_PORT}`;

/** Scopes for EventSub + Helix. Re-connect Twitch after changing scopes. */
export const TWITCH_SCOPES = [
  "channel:read:subscriptions",
  "bits:read",
  "channel:read:redemptions",
  "moderator:read:followers",
  "user:read:email",
  "user:read:chat",
  "user:write:chat",
] as const;
