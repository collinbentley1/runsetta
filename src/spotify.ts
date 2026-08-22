import { appConfig, type AppConfig } from "./config";
import type { SpotifyRefreshRequest, SpotifyTokenRequest } from "./contracts";

const spotifyTokenUrl = "https://accounts.spotify.com/api/token";

export async function exchangeSpotifyCode(
  input: SpotifyTokenRequest,
  config: AppConfig = appConfig,
): Promise<unknown> {
  const body = new URLSearchParams({
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri ?? config.spotifyRedirectUri ?? "",
  });

  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  return requestSpotifyToken(body, config);
}

export async function refreshSpotifyToken(
  input: SpotifyRefreshRequest,
  config: AppConfig = appConfig,
): Promise<unknown> {
  return requestSpotifyToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
    config,
  );
}

async function requestSpotifyToken(body: URLSearchParams, config: AppConfig): Promise<unknown> {
  if (config.offlineMode) {
    throw new SpotifyConfigurationError("Spotify token exchange is disabled in offline mode.");
  }

  if (!config.spotifyClientId || !config.spotifyClientSecret) {
    throw new SpotifyConfigurationError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required.");
  }

  const response = await fetch(spotifyTokenUrl, {
    body,
    headers: {
      Authorization: `Basic ${btoa(`${config.spotifyClientId}:${config.spotifyClientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SpotifyTokenError(response.status, payload);
  }

  return payload;
}

export class SpotifyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyConfigurationError";
  }
}

export class SpotifyTokenError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super("Spotify token request failed.");
    this.name = "SpotifyTokenError";
  }
}
