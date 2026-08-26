import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  findCredentialShapedHexLiterals,
  foldHexStringLiterals,
  isSourceScanIgnoredDirectory,
} from "../tools/secret-policy";

delete Bun.env.OPENAI_API_KEY;
delete Bun.env.PLATFORM_DEPLOY_NONCE;
delete Bun.env.SPOTIFY_CLIENT_ID;
delete Bun.env.SPOTIFY_CLIENT_SECRET;
Bun.env.RUNSETTA_OFFLINE = "1";

const { authorizePaidRoute, handleRequest } = await import("../src/server");
const { appConfig } = await import("../src/config");
const { createSpeech, ServiceConfigurationError } = await import("../src/audio");
const {
  exchangeSpotifyCode,
  refreshSpotifyToken,
  SpotifyConfigurationError,
} = await import("../src/spotify");
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
    expect(body).toEqual({
      environment: appConfig.environment,
      ok: true,
      openaiConfigured: false,
      service: "runsetta",
      spotifyConfigured: false,
    });
  });

  test("echoes the deployment nonce only on /livez when configured", async () => {
    Bun.env.PLATFORM_DEPLOY_NONCE = "test-deployment-nonce";

    try {
      const liveness = await handleRequest(new Request("https://runsetta.test/livez"));
      const health = await handleRequest(new Request("https://runsetta.test/api/health"));

      expect(liveness.status).toBe(200);
      expect(await liveness.json()).toEqual({
        deployment: "test-deployment-nonce",
        ok: true,
      });
      expect(await health.json()).toEqual({
        environment: appConfig.environment,
        ok: true,
        openaiConfigured: false,
        service: "runsetta",
        spotifyConfigured: false,
      });
    } finally {
      delete Bun.env.PLATFORM_DEPLOY_NONCE;
    }
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

  test("fails closed before speech generation when offline or unconfigured", async () => {
    const response = await handleRequest(jsonRequest("/api/audio", { message: "Keep going." }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe(
      appConfig.offlineMode
        ? "Network integrations are disabled in offline mode."
        : "OPENAI_API_KEY is required for speech generation.",
    );
  });

  test("fails closed before Spotify token exchange when offline or unconfigured", async () => {
    const response = await handleRequest(
      jsonRequest("/api/spotify/token", {
        code: "abc",
        redirectUri: "https://runsetta.test/spotify/callback",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe(
      appConfig.offlineMode
        ? "Network integrations are disabled in offline mode."
        : "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required.",
    );
  });

  test("requires provider credentials when online integrations are explicitly enabled", async () => {
    const onlineWithoutCredentials = {
      ...appConfig,
      offlineMode: false,
      openaiApiKey: undefined,
      spotifyClientId: undefined,
      spotifyClientSecret: undefined,
    };

    await expect(
      createSpeech({ format: "mp3", message: "Keep going." }, onlineWithoutCredentials),
    ).rejects.toThrow("OPENAI_API_KEY");
    await expect(
      exchangeSpotifyCode({ code: "code" }, onlineWithoutCredentials),
    ).rejects.toThrow("SPOTIFY_CLIENT_ID");
    await expect(
      refreshSpotifyToken({ refreshToken: "refresh" }, onlineWithoutCredentials),
    ).rejects.toThrow("SPOTIFY_CLIENT_ID");
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

  test("offline mode blocks every external integration even if credentials drift in", async () => {
    const offlineConfig = {
      ...appConfig,
      apiBearerToken: "test-api-token-with-at-least-32-bytes",
      offlineMode: true,
      openaiApiKey: "configured",
      spotifyClientId: "configured",
      spotifyClientSecret: "configured",
    };
    const routeExpectations = new Map<string, number | undefined>([
      ["/api/audio", 503],
      ["/api/coach", undefined],
      ["/api/spotify-transition", undefined],
      ["/api/spotify/token", 503],
      ["/api/spotify/refresh", 503],
    ]);

    for (const [route, expectedStatus] of routeExpectations) {
      const result = authorizePaidRoute(route, jsonRequest(route, {}), offlineConfig);
      expect(result?.status, route).toBe(expectedStatus);
      if (expectedStatus === 503) {
        expect(await result?.json(), route).toEqual({
          error: "Network integrations are disabled in offline mode.",
        });
      }
    }

    await expect(
      createSpeech({ format: "mp3", message: "Keep going." }, offlineConfig),
    ).rejects.toBeInstanceOf(ServiceConfigurationError);
    await expect(
      exchangeSpotifyCode({ code: "code" }, offlineConfig),
    ).rejects.toBeInstanceOf(SpotifyConfigurationError);
    await expect(
      refreshSpotifyToken({ refreshToken: "refresh" }, offlineConfig),
    ).rejects.toBeInstanceOf(SpotifyConfigurationError);
  });

  test("a fresh offline server blocks every network route before fetch", async () => {
    const serverModule = new URL("../src/server.ts", import.meta.url).href;
    const bearer = "test-api-token-with-at-least-32-bytes";
    const probe = `
      Bun.env.RUNSETTA_OFFLINE = "1";
      Bun.env.RUNSETTA_API_TOKEN = ${JSON.stringify(bearer)};
      Bun.env.OPENAI_API_KEY = "configured";
      Bun.env.SPOTIFY_CLIENT_ID = "configured";
      Bun.env.SPOTIFY_CLIENT_SECRET = "configured";
      let fetchCalls = 0;
      globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error("network attempted");
      };
      const { handleRequest } = await import(${JSON.stringify(serverModule)});
      const cases = [
        ["/api/audio", { message: "Keep going." }],
        ["/api/coach", { effort: "hard", runnerName: "Collin", workoutType: "run" }],
        ["/api/spotify-transition", {
          effort: "hard",
          runnerName: "Collin",
          track: { title: "Life" },
          workoutType: "run",
        }],
        ["/api/spotify/token", { code: "code" }],
        ["/api/spotify/refresh", { refreshToken: "refresh" }],
      ];
      const results = [];
      for (const [path, body] of cases) {
        const response = await handleRequest(new Request("https://runsetta.test" + path, {
          body: JSON.stringify(body),
          headers: {
            authorization: "Bearer " + ${JSON.stringify(bearer)},
            "content-type": "application/json",
          },
          method: "POST",
        }));
        results.push({ body: await response.json(), path, status: response.status });
      }
      process.stdout.write(JSON.stringify({ fetchCalls, results }));
    `;
    const child = Bun.spawn([process.execPath, "--no-env-file", "-e", probe], {
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    expect(exitCode, stderr).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      fetchCalls: 0,
      results: [
        {
          body: { error: "Network integrations are disabled in offline mode." },
          path: "/api/audio",
          status: 503,
        },
        {
          body: {
            generatedBy: "local-fallback",
            message: "Collin, stay smooth under pressure, relax your shoulders, and make the next step simple.",
            model: null,
          },
          path: "/api/coach",
          status: 200,
        },
        {
          body: {
            generatedBy: "local-fallback",
            message: "Collin, stay smooth under pressure; let the next song carry the next minute.",
            model: null,
          },
          path: "/api/spotify-transition",
          status: 200,
        },
        {
          body: { error: "Network integrations are disabled in offline mode." },
          path: "/api/spotify/token",
          status: 503,
        },
        {
          body: { error: "Network integrations are disabled in offline mode." },
          path: "/api/spotify/refresh",
          status: 503,
        },
      ],
    });
  });

  test("sets browser hardening headers without wildcard CORS", async () => {
    const response = await handleRequest(new Request("https://runsetta.test/"));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  test("current source tree contains no embedded credential-shaped hexadecimal literal", async () => {
    const files = await walk(root);

    for (const file of files) {
      const relativePath = file.slice(root.length + 1);
      const text = await readFile(file, "utf8").catch(() => "");
      expect(findCredentialShapedHexLiterals(relativePath, text), file).toEqual([]);
    }
  });

  test("source scanning excludes the platform policy checkout injected by CI", () => {
    expect(isSourceScanIgnoredDirectory("_platform_policy")).toBe(true);
    expect(isSourceScanIgnoredDirectory("src")).toBe(false);
  });

  test("secret policy folds split hexadecimal literals before evaluating their length", () => {
    const quote = '"';
    const fixture = `${quote}${"a".repeat(16)}${quote} + ${quote}${"b".repeat(16)}${quote}`;

    expect(foldHexStringLiterals(fixture)).toEqual([`${"a".repeat(16)}${"b".repeat(16)}`]);
    for (let escapeDepth = 0; escapeDepth <= 4; escapeDepth += 1) {
      const slashes = "\\".repeat(escapeDepth);
      expect(foldHexStringLiterals(`${slashes}\"${"c".repeat(32)}${slashes}\"`)).toEqual([
        "c".repeat(32),
      ]);
    }
  });

  test("secret policy scans extensionless and Terraform content but permits reviewed SHA pins", () => {
    const credential = "a".repeat(32);
    const platformSha = "b".repeat(40);
    expect(findCredentialShapedHexLiterals("src/credential-fixture", `token = "${credential}"`)).toEqual([
      credential,
    ]);
    expect(
      findCredentialShapedHexLiterals(
        "infra/terraform/bootstrap/main.tf",
        `api_token = "${credential}"`,
      ),
    ).toEqual([credential]);

    const reviewedBootstrap = `module "bootstrap" {\n  source = "github.com/collinbentley1/platform//terraform/modules/bootstrap?ref=${platformSha}"\n  trusted_platform_workflow_shas = [\n    "${platformSha}",\n  ]\n}\n`;
    expect(
      findCredentialShapedHexLiterals(
        "infra/terraform/bootstrap/main.tf",
        reviewedBootstrap,
      ),
    ).toEqual([]);
    expect(findCredentialShapedHexLiterals("src/config.ts", `token = "${platformSha}"`)).toEqual([
      platformSha,
    ]);
  });

  test("secret policy permits only the twice-checked Bun revision in the pinned Dockerfile", async () => {
    const dockerfile = await readFile(join(root, "Dockerfile"), "utf8");
    const dockerRevision = dockerfile.match(/Bun\.revision !== "([0-9a-f]{40})"/)?.[1];

    expect(dockerRevision).toBeDefined();
    if (dockerRevision === undefined) {
      throw new Error("pinned Dockerfile did not expose its Bun revision check");
    }
    expect(dockerRevision).toMatch(/^34cbb9a40b4bd1bd767d134a7065e66c2432a676$/);

    expect(findCredentialShapedHexLiterals("Dockerfile", dockerfile)).toEqual([]);
    expect(
      findCredentialShapedHexLiterals("src/config.ts", `token = "${dockerRevision}"`),
    ).toEqual([dockerRevision]);
    expect(
      findCredentialShapedHexLiterals(
        "Dockerfile",
        dockerfile.replace(
          "FROM platform.invalid/bun-release AS bun-release",
          "FROM platform.invalid/bun-latest AS bun-release",
        ),
      ),
    ).toEqual([dockerRevision, dockerRevision]);
    expect(
      findCredentialShapedHexLiterals(
        "Dockerfile",
        dockerfile.replace(
          "FROM platform.invalid/bun-release AS bun-release",
          "# FROM platform.invalid/bun-release AS bun-release",
        ),
      ),
    ).toEqual([dockerRevision, dockerRevision]);
    expect(
      findCredentialShapedHexLiterals(
        "Dockerfile",
        dockerfile.replace("RUN bun -e 'if (Bun.version", "# RUN bun -e 'if (Bun.version"),
      ),
    ).toEqual([dockerRevision, dockerRevision]);
    const wrongRevision = `${dockerRevision.slice(0, -1)}${dockerRevision.endsWith("0") ? "1" : "0"}`;
    expect(
      findCredentialShapedHexLiterals(
        "Dockerfile",
        dockerfile.replaceAll(dockerRevision, wrongRevision),
      ),
    ).toEqual([wrongRevision, wrongRevision]);
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
    if (isSourceScanIgnoredDirectory(entry.name)) {
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
