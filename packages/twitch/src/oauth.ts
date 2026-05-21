import { TWITCH_SCOPES } from "@btv/shared";

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";

export interface TwitchOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TwitchTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
}

export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
}

export function getAuthorizeUrl(config: TwitchOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: TWITCH_SCOPES.join(" "),
    state,
  });
  return `${TWITCH_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(
  config: TwitchOAuthConfig,
  code: string,
): Promise<TwitchTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(TWITCH_TOKEN_URL, { method: "POST", body });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

export async function refreshAccessToken(
  config: TwitchOAuthConfig,
  refreshToken: string,
): Promise<TwitchTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(TWITCH_TOKEN_URL, { method: "POST", body });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

export async function validateToken(accessToken: string): Promise<{
  clientId: string;
  userId: string;
  login: string;
  scopes: string[];
}> {
  const res = await fetch(TWITCH_VALIDATE_URL, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) throw new Error("Invalid token");
  const data = (await res.json()) as {
    client_id: string;
    user_id: string;
    login: string;
    scopes: string[];
  };
  return {
    clientId: data.client_id,
    userId: data.user_id,
    login: data.login,
    scopes: data.scopes,
  };
}

export async function getBroadcaster(
  accessToken: string,
  clientId: string,
  userId: string,
): Promise<TwitchUser> {
  const res = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch user");
  const data = (await res.json()) as {
    data: Array<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
    }>;
  };
  const u = data.data[0];
  if (!u) throw new Error("User not found");
  return {
    id: u.id,
    login: u.login,
    displayName: u.display_name,
    profileImageUrl: u.profile_image_url,
  };
}
