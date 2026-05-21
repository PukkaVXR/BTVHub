import { HOST, HUB_PORT, OAUTH_HTTPS_PORT, OVERLAY_PORT } from "@btv/shared";
import { deleteSetting, getSetting, setSetting } from "./db.js";

export function getOAuthHost(): string {
  return getSetting("oauth_host") ?? HOST;
}

export function setOAuthHost(host: string): void {
  setSetting("oauth_host", host.replace(/^https?:\/\//, "").split(":")[0] ?? host);
}

/** HTTP origin for overlays, API, webhooks, WebSocket */
export function getOverlayOrigin(): string {
  return `http://${getOAuthHost()}:${OVERLAY_PORT}`;
}

export function getOverlayWsUrl(): string {
  return `ws://${getOAuthHost()}:${OVERLAY_PORT}/ws`;
}

/** HTTPS origin for OAuth redirects (Twitch/Spotify require HTTPS) */
export function getOAuthOrigin(): string {
  return `https://${getOAuthHost()}:${OAUTH_HTTPS_PORT}`;
}

export function getHubOrigin(): string {
  return `http://${HOST}:${HUB_PORT}`;
}

export function getTwitchRedirectUri(): string {
  const override = getSetting("twitch_redirect_uri");
  // Drop overrides from the old single-port layout (HTTP/HTTPS on 4782)
  if (override?.includes(":4782/")) {
    deleteSetting("twitch_redirect_uri");
  } else if (override) {
    return override;
  }
  return `${getOAuthOrigin()}/auth/twitch/callback`;
}

export function getSpotifyRedirectUri(): string {
  const override = getSetting("spotify_redirect_uri");
  if (override?.includes(":4783/")) {
    deleteSetting("spotify_redirect_uri");
  } else if (override) {
    return override;
  }
  return `${getOverlayOrigin()}/auth/spotify/callback`;
}

export function getTwitchAuthStartUrl(): string {
  return `${getOAuthOrigin()}/auth/twitch`;
}

export function getSpotifyAuthStartUrl(): string {
  return `${getOAuthOrigin()}/auth/spotify`;
}
