import { describe, expect, test } from "bun:test";
import { generateCoachMessage, generateSpotifyTransition } from "../src/agents";

describe("agent message generation", () => {
  test("normalizes injected coach runner output", async () => {
    const result = await generateCoachMessage(
      {
        distanceMeters: 3_200,
        effort: "steady",
        runnerName: "Collin",
        workoutType: "run",
      },
      async () => "  Stay tall, keep the cadence quiet, and roll through the next block.  ",
    );

    expect(result).toEqual({
      generatedBy: "openai-agents",
      message: "Stay tall, keep the cadence quiet, and roll through the next block.",
      model: null,
    });
  });

  test("builds a transition through the injected runner", async () => {
    const result = await generateSpotifyTransition(
      {
        effort: "hard",
        track: {
          artist: "Jamie xx",
          title: "Life",
        },
        workoutType: "run",
      },
      async (_kind, prompt) => {
        expect(prompt).toContain("Next track: Life by Jamie xx.");
        return "Hold form, let the beat lift the climb.";
      },
    );

    expect(result.message).toBe("Hold form, let the beat lift the climb.");
  });
});
