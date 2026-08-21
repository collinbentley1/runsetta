import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { foldHexStringLiterals } from "../tools/secret-policy";

delete Bun.env.OPENAI_API_KEY;
delete Bun.env.SPOTIFY_CLIENT_ID;
delete Bun.env.SPOTIFY_CLIENT_SECRET;
Bun.env.RUNSETTA_OFFLINE = "1";

const { authorizePaidRoute, handleRequest } = await import("../src/server");
const { appConfig } = await import("../src/config");
const root = join(import.meta.dir, "..");

describe("Runsetta API", () => {
  test("reports health without secrets", async () => {
    const response = await handleRequest(new Request("https://runsetta.test/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      openaiConfigured: false,
      spotifyConfigured: false,
    });
  });

  test("answers the platform-standard /livez path with health JSON", async () => {
    const response = await handleRequest(new Request("https://runsetta.test/livez"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "runsetta",
    });
  });

  test("returns a local fallback coach cue in offline mode", async () => {
    const response = await handleRequest(
      jsonRequest("/api/coach", {
        effort: "hard",
        runnerName: "Collin",
        workoutType: "run",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("local-fallback");
    expect(body.message).toContain("Collin");
  });

  test("rejects invalid JSON bodies", async () => {
    const response = await handleRequest(
      new Request("https://runsetta.test/api/coach", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
  });

  test("requires OpenAI configuration for speech", async () => {
    const response = await handleRequest(jsonRequest("/api/audio", { message: "Keep going." }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("OPENAI_API_KEY");
  });

  test("requires server-side Spotify credentials for token exchange", async () => {
    const response = await handleRequest(
      jsonRequest("/api/spotify/token", {
        code: "abc",
        redirectUri: "https://runsetta.test/spotify/callback",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("SPOTIFY_CLIENT_ID");
  });

  test("blocks traversal outside the public directory", async () => {
    const response = await handleRequest(new Request("https://runsetta.test/%2e%2e/package.json"));

    expect(response.status).toBe(404);
  });

  test("rejects malformed percent-encoded paths without leaking an unhandled error", async () => {
    for (const path of ["/%E0%A4%A", "/%00"]) {
      const response = await handleRequest(new Request(`https://runsetta.test${path}`));

      expect(response.status, path).toBe(400);
      expect(response.headers.get("X-Content-Type-Options"), path).toBe("nosniff");
      expect(await response.json(), path).toEqual({ error: "Malformed path." });
    }
  });

  test("rejects oversized streamed JSON before buffering it", async () => {
    const response = await handleRequest(
      new Request("https://runsetta.test/api/coach", {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`{"cue":"${"x".repeat(17_000)}`));
            controller.enqueue(new TextEncoder().encode('"}'));
            controller.close();
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(413);
  });

  test("protects enabled paid integrations with a bearer token", async () => {
    const paidConfig = {
      ...appConfig,
      apiBearerToken: "test-api-token-with-at-least-32-bytes",
      offlineMode: false,
      openaiApiKey: "configured",
      spotifyClientId: "configured",
      spotifyClientSecret: "configured",
    };
    const paidRoutes = [
      "/api/audio",
      "/api/coach",
      "/api/spotify-transition",
      "/api/spotify/token",
      "/api/spotify/refresh",
    ];
    for (const route of paidRoutes) {
      const missing = authorizePaidRoute(route, jsonRequest(route, {}), paidConfig);
      expect(missing?.status, route).toBe(401);
      expect(missing?.headers.get("WWW-Authenticate"), route).toBe('Bearer realm="runsetta-api"');
    }

    const valid = authorizePaidRoute(
      "/api/audio",
      new Request("https://runsetta.test/api/audio", {
        headers: { Authorization: "Bearer test-api-token-with-at-least-32-bytes" },
      }),
      paidConfig,
    );

    expect(valid).toBeUndefined();
    expect(authorizePaidRoute("/api/health", new Request("https://runsetta.test/api/health"), paidConfig)).toBeUndefined();
    expect(authorizePaidRoute("/livez", new Request("https://runsetta.test/livez"), paidConfig)).toBeUndefined();
    expect(authorizePaidRoute("/api/coach", jsonRequest("/api/coach", {}), { ...paidConfig, offlineMode: true })).toBeUndefined();
    expect(
      authorizePaidRoute("/api/audio", jsonRequest("/api/audio", {}), {
        ...paidConfig,
        apiBearerToken: "too-short",
      })?.status,
    ).toBe(503);
    expect(authorizePaidRoute("/api/future-paid-route", jsonRequest("/api/future-paid-route", {}), paidConfig)?.status).toBe(503);
  });

  test("sets browser hardening headers without wildcard CORS", async () => {
    const response = await handleRequest(new Request("https://runsetta.test/"));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  test("current source tree contains no embedded 32-character hexadecimal credential", async () => {
    const files = await walk(root);

    for (const file of files) {
      const text = await readFile(file, "utf8").catch(() => "");
      expect(text.match(/["'][0-9a-f]{32}["']/i), file).toBeNull();

      for (const match of text.matchAll(/["']([0-9a-f]{8,})["']\s*\+\s*["']([0-9a-f]{8,})["']/gi)) {
        expect(`${match[1]}${match[2]}`.length, file).toBeLessThan(32);
      }
    }
  });

  test("secret policy folds split hexadecimal literals before evaluating their length", () => {
    const quote = '"';
    const fixture = `${quote}${"a".repeat(16)}${quote} + ${quote}${"b".repeat(16)}${quote}`;

    expect(foldHexStringLiterals(fixture)).toEqual([`${"a".repeat(16)}${"b".repeat(16)}`]);
  });
});

function jsonRequest(pathname: string, body: unknown): Request {
  return new Request(`https://runsetta.test${pathname}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if ([".build", ".git", ".swiftpm", "dist", "node_modules"].includes(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}
