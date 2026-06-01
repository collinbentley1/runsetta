const healthEl = document.querySelector<HTMLElement>("[data-health]");

async function refreshHealth(): Promise<void> {
  if (!healthEl) {
    return;
  }

  try {
    const response = await fetch("/api/health");
    const health = (await response.json()) as { ok: boolean; openaiConfigured: boolean; spotifyConfigured: boolean };

    healthEl.textContent = [
      health.ok ? "API online" : "API unavailable",
      health.openaiConfigured ? "OpenAI configured" : "OpenAI fallback mode",
      health.spotifyConfigured ? "Spotify configured" : "Spotify not configured",
    ].join(" · ");
  } catch {
    healthEl.textContent = "API unavailable";
  }
}

await refreshHealth();

export {};
