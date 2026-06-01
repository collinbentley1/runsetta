import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

delete Bun.env.OPENAI_API_KEY;
delete Bun.env.SPOTIFY_CLIENT_ID;
delete Bun.env.SPOTIFY_CLIENT_SECRET;
Bun.env.RUNSETTA_OFFLINE = "1";

const { handleRequest } = await import("../src/server");
const root = join(import.meta.dir, "..");

describe("Runsetta API", () => {
  test("reports health without secrets", async () => {
    const response = await handleRequest(new Request("https://runsetta.test/healthz"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      openaiConfigured: false,
      spotifyConfigured: false,
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

  test("current source tree does not contain the old Spotify client secret", async () => {
    const files = await walk(root);
    const oldSecret = "0dbd08f496bc430f" + "9bb8e31353c12d4b";

    for (const file of files) {
      const text = await readFile(file, "utf8").catch(() => "");
      expect(text.includes(oldSecret), file).toBe(false);
    }
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
    if (entry.name === ".git" || entry.name === "dist" || entry.name === "node_modules") {
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
