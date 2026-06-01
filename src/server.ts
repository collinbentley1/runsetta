import { extname, join, normalize } from "node:path";
import { appConfig } from "./config";
import {
  AudioRequestSchema,
  CoachMessageRequestSchema,
  SpotifyRefreshRequestSchema,
  SpotifyTokenRequestSchema,
  SpotifyTransitionRequestSchema,
} from "./contracts";
import { generateCoachMessage, generateSpotifyTransition } from "./agents";
import { createSpeech, ServiceConfigurationError } from "./audio";
import {
  exchangeSpotifyCode,
  refreshSpotifyToken,
  SpotifyConfigurationError,
  SpotifyTokenError,
} from "./spotify";

type Handler = (request: Request) => Promise<Response> | Response;

const routes: Record<string, Handler> = {
  "GET /healthz": handleHealth,
  "POST /api/coach": async (request) => jsonResponse(await generateCoachMessage(await parseJson(request, CoachMessageRequestSchema))),
  "POST /api/spotify-transition": async (request) =>
    jsonResponse(await generateSpotifyTransition(await parseJson(request, SpotifyTransitionRequestSchema))),
  "POST /api/audio": handleAudio,
  "POST /api/spotify/token": async (request) =>
    jsonResponse(await exchangeSpotifyCode(await parseJson(request, SpotifyTokenRequestSchema))),
  "POST /api/spotify/refresh": async (request) =>
    jsonResponse(await refreshSpotifyToken(await parseJson(request, SpotifyRefreshRequestSchema))),
};

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: securityHeaders(), status: 204 });
  }

  const handler = routes[`${request.method} ${url.pathname}`];

  try {
    if (handler) {
      return await handler(request);
    }

    if (request.method === "GET" || request.method === "HEAD") {
      return await serveStatic(url.pathname, request.method);
    }

    return jsonError(405, "Method not allowed.");
  } catch (error) {
    return handleError(error);
  }
}

function handleHealth(): Response {
  return jsonResponse({
    ok: true,
    service: "runsetta",
    environment: appConfig.environment,
    openaiConfigured: Boolean(appConfig.openaiApiKey),
    spotifyConfigured: Boolean(appConfig.spotifyClientId && appConfig.spotifyClientSecret),
  });
}

async function handleAudio(request: Request): Promise<Response> {
  const speech = await createSpeech(await parseJson(request, AudioRequestSchema));

  return new Response(speech.body, {
    headers: securityHeaders({
      "Cache-Control": "no-store",
      "Content-Type": speech.contentType,
    }),
  });
}

async function parseJson<T>(request: Request, schema: { parse(value: unknown): T }): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "Expected application/json.");
  }

  const body = await request.text();

  if (body.length > appConfig.maxJsonBytes) {
    throw new HttpError(413, "Request body is too large.");
  }

  try {
    return schema.parse(JSON.parse(body));
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

async function serveStatic(pathname: string, method: string): Promise<Response> {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(decodeURIComponent(cleanPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(appConfig.publicDir, normalized);

  if (!filePath.startsWith(appConfig.publicDir)) {
    return jsonError(404, "Not found.");
  }

  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return jsonError(404, "Not found.");
  }

  return new Response(method === "HEAD" ? null : file, {
    headers: securityHeaders({
      "Cache-Control": "public, max-age=300",
      "Content-Type": contentTypeFor(filePath),
    }),
  });
}

function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonError(error.status, error.message);
  }

  if (error instanceof ServiceConfigurationError || error instanceof SpotifyConfigurationError) {
    return jsonError(503, error.message);
  }

  if (error instanceof SpotifyTokenError) {
    return jsonResponse(error.payload, error.status);
  }

  console.error(error);
  return jsonError(500, "Internal server error.");
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: securityHeaders({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    }),
    status,
  });
}

function jsonError(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

function securityHeaders(extra: HeadersInit = {}): Headers {
  return new Headers({
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
}

function contentTypeFor(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

if (import.meta.main) {
  Bun.serve({
    fetch: handleRequest,
    port: appConfig.port,
  });

  console.log(`Runsetta API listening on :${appConfig.port}`);
}
