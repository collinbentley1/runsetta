const healthEl = document.querySelector<HTMLElement>("[data-health]");
const cueEl = document.querySelector<HTMLElement>("[data-cue]");
const noteEl = document.querySelector<HTMLElement>("[data-note]");
const cueForm = document.querySelector<HTMLFormElement>("[data-cue-form]");

async function refreshHealth(): Promise<void> {
  if (!healthEl) {
    return;
  }

  try {
    const response = await fetch("/api/health");
    const health = (await response.json()) as { ok: boolean; openaiConfigured: boolean; spotifyConfigured: boolean };

    healthEl.textContent = health.ok ? "Live demo" : "Demo resting";
  } catch {
    healthEl.textContent = "Demo resting";
  }
}

cueForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = cueForm.querySelector<HTMLButtonElement>("button");
  const formData = new FormData(cueForm);
  const runnerName = String(formData.get("runnerName") ?? "").trim();
  const cue = String(formData.get("cue") ?? "").trim();

  button?.setAttribute("disabled", "");
  setNote("Finding the next line.");

  try {
    const response = await fetch("/api/coach", {
      body: JSON.stringify({
        cue: cue || undefined,
        effort: formData.get("effort"),
        runnerName: runnerName || undefined,
        workoutType: "run",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Cue request failed.");
    }

    const payload = (await response.json()) as { message?: string };
    cueEl!.textContent = payload.message ?? "Keep the rhythm honest and make the next step simple.";
    setNote("Short enough for mid-stride.");
  } catch {
    setNote("That cue missed. Try again.");
  } finally {
    button?.removeAttribute("disabled");
  }
});

function setNote(message: string): void {
  if (noteEl) {
    noteEl.textContent = message;
  }
}

await refreshHealth();

export {};
