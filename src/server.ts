import { createHash, timingSafeEqual } from "node:crypto";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { appConfig, type AppConfig } from "./config";
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
  "GET /api/health": handleHealth,
  "GET /livez": handleLiveness,
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
      const authFailure = authorizePaidRoute(url.pathname, request);
      if (authFailure) {
        return authFailure;
      }
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
  return jsonResponse(healthPayload());
}

function handleLiveness(): Response {
  const deployment = Bun.env.PLATFORM_DEPLOY_NONCE;
  return jsonResponse(deployment ? { ok: true, deployment } : healthPayload());
}

function healthPayload(): Record<string, boolean | string> {
  return {
    ok: true,
    service: "runsetta",
    environment: appConfig.environment,
    openaiConfigured: Boolean(appConfig.openaiApiKey),
    spotifyConfigured: Boolean(appConfig.spotifyClientId && appConfig.spotifyClientSecret),
  };
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
  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();

  if (contentType !== "application/json") {
    throw new HttpError(415, "Expected application/json.");
  }

  const body = await readBoundedText(request, appConfig.maxJsonBytes);
  if (body === undefined) {
    throw new HttpError(413, "Request body is too large.");
  }

  try {
    return schema.parse(JSON.parse(body));
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

async function serveStatic(pathname: string, method: string): Promise<Response> {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    return jsonError(400, "Malformed path.");
  }

  if (/[\u0000-\u001f\u007f]/.test(decodedPath)) {
    return jsonError(400, "Malformed path.");
  }

  const publicRoot = resolve(appConfig.publicDir);
  const filePath = resolve(publicRoot, decodedPath.replace(/^[/\\]+/, ""));
  const relativePath = relative(publicRoot, filePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
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

  console.error("request failed", error instanceof Error ? error.name : "unknown error");
  return jsonError(500, "Internal server error.");
}

function jsonResponse(payload: unknown, status = 200, extraHeaders: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(payload), {
    headers: securityHeaders({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
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
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extra,
  });
}

export function authorizePaidRoute(
  pathname: string,
  request: Request,
  config: AppConfig = appConfig,
): Response | undefined {
  let integrationEnabled: boolean;
  switch (pathname) {
    case "/api/health":
    case "/livez":
      return undefined;
    case "/api/audio":
      if (config.offlineMode) {
        return jsonError(503, "Network integrations are disabled in offline mode.");
      }
      integrationEnabled = Boolean(config.openaiApiKey);
      break;
    case "/api/coach":
    case "/api/spotify-transition":
      integrationEnabled = Boolean(config.openaiApiKey) && !config.offlineMode;
      break;
    case "/api/spotify/token":
    case "/api/spotify/refresh":
      if (config.offlineMode) {
        return jsonError(503, "Network integrations are disabled in offline mode.");
      }
      integrationEnabled = Boolean(config.spotifyClientId && config.spotifyClientSecret);
      break;
    default:
      return jsonError(503, "Route authentication policy is not configured.");
  }

  if (!integrationEnabled) {
    return undefined;
  }

  if (!config.apiBearerToken || new TextEncoder().encode(config.apiBearerToken).byteLength < 32) {
    return jsonError(503, "Paid integrations are disabled until API authentication is configured.");
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!tokensEqual(suppliedToken, config.apiBearerToken)) {
    return jsonResponse(
      { error: "Missing or invalid bearer token." },
      401,
      { "WWW-Authenticate": 'Bearer realm="runsetta-api"' },
    );
  }

  return undefined;
}

function tokensEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

async function readBoundedText(request: Request, maxBytes: number): Promise<string | undefined> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes) {
      return undefined;
    }
  }

  if (!request.body) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
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
    maxRequestBodySize: appConfig.maxJsonBytes,
    port: appConfig.port,
  });

  console.log(`Runsetta API listening on :${appConfig.port}`);
}
