import { appConfig } from "./config";
import type { SpotifyRefreshRequest, SpotifyTokenRequest } from "./contracts";

const spotifyTokenUrl = "https://accounts.spotify.com/api/token";

export async function exchangeSpotifyCode(input: SpotifyTokenRequest): Promise<unknown> {
  const body = new URLSearchParams({
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri ?? appConfig.spotifyRedirectUri ?? "",
  });

  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  return requestSpotifyToken(body);
}

export async function refreshSpotifyToken(input: SpotifyRefreshRequest): Promise<unknown> {
  return requestSpotifyToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
  );
}

async function requestSpotifyToken(body: URLSearchParams): Promise<unknown> {
  if (!appConfig.spotifyClientId || !appConfig.spotifyClientSecret) {
    throw new SpotifyConfigurationError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required.");
  }

  const response = await fetch(spotifyTokenUrl, {
    body,
    headers: {
      Authorization: `Basic ${btoa(`${appConfig.spotifyClientId}:${appConfig.spotifyClientSecret}`)}`,
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
