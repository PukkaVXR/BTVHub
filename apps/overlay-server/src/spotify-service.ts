import {
  deleteSetting,
  getEncryptedSetting,
  getSetting,
  setEncryptedSetting,
  setSetting,
} from "./db.js";
import { getSpotifyRedirectUri } from "./server-urls.js";
import type { OverlayBus } from "./bus.js";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_NOW_PLAYING = "https://api.spotify.com/v1/me/player/currently-playing";

let pollTimer: ReturnType<typeof setInterval> | null = null;

function spotifyBasicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function spotifyTokenError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; error_description?: string };
    return body.error_description ?? body.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export function getSpotifyConfig() {
  const clientId = getSetting("spotify_client_id");
  const clientSecret = getEncryptedSetting("spotify_client_secret");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: getSpotifyRedirectUri(),
  };
}

export function getSpotifyAuthUrl(state: string): string {
  const config = getSpotifyConfig();
  if (!config) throw new Error("Spotify not configured");
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: "user-read-currently-playing user-read-playback-state",
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleSpotifyCallback(code: string): Promise<void> {
  const config = getSpotifyConfig();
  if (!config) throw new Error("Spotify not configured");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: spotifyBasicAuth(config.clientId, config.clientSecret),
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${await spotifyTokenError(res)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    throw new Error("Spotify did not return a refresh token — revoke app access at spotify.com/account/apps and try again");
  }

  setEncryptedSetting(
    "spotify_tokens",
    JSON.stringify({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }),
  );
}

async function getSpotifyAccessToken(): Promise<string | null> {
  const config = getSpotifyConfig();
  const stored = getEncryptedSetting("spotify_tokens");
  if (!config || !stored) return null;

  let tokens = JSON.parse(stored) as {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };

  if (Date.now() < tokens.expiresAt - 60_000) return tokens.accessToken;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: spotifyBasicAuth(config.clientId, config.clientSecret),
    },
    body,
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokens = {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  setEncryptedSetting("spotify_tokens", JSON.stringify(tokens));
  return tokens.accessToken;
}

export function startSpotifyPoller(bus: OverlayBus): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollNowPlaying(bus).catch(() => {
      bus.broadcast({ kind: "widget:nowPlaying", track: null }, "nowPlaying");
    });
  }, 5000);
  void pollNowPlaying(bus).catch(() => {
    bus.broadcast({ kind: "widget:nowPlaying", track: null }, "nowPlaying");
  });
}

export function stopSpotifyPoller(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function pollNowPlaying(bus: OverlayBus): Promise<void> {
  const token = await getSpotifyAccessToken();
  if (!token) return;

  const res = await fetch(SPOTIFY_NOW_PLAYING, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || !res.ok) {
    bus.broadcast({ kind: "widget:nowPlaying", track: null }, "nowPlaying");
    return;
  }

  const data = (await res.json()) as {
    is_playing: boolean;
    progress_ms: number;
    item: {
      name: string;
      duration_ms: number;
      album: { images: Array<{ url: string }> };
      artists: Array<{ name: string }>;
    };
  };

  bus.broadcast(
    {
      kind: "widget:nowPlaying",
      track: {
        title: data.item.name,
        artist: data.item.artists.map((a) => a.name).join(", "),
        albumArtUrl: data.item.album.images[0]?.url,
        progressMs: data.progress_ms,
        durationMs: data.item.duration_ms,
        isPlaying: data.is_playing,
      },
    },
    "nowPlaying",
  );
}

export function disconnectSpotify(): void {
  stopSpotifyPoller();
  deleteSetting("spotify_tokens");
}

export function getSpotifyStatus() {
  return {
    configured: Boolean(getSpotifyConfig()),
    connected: Boolean(getEncryptedSetting("spotify_tokens")),
    hasClientSecret: Boolean(getEncryptedSetting("spotify_client_secret")),
  };
}
