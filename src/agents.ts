import { Agent, run } from "@openai/agents";
import { appConfig } from "./config";
import {
  AgentMessageSchema,
  type CoachMessageRequest,
  type RunContext,
  type SpotifyTransitionRequest,
} from "./contracts";

type MessageKind = "coach" | "spotify-transition";

export interface GeneratedMessage {
  message: string;
  generatedBy: "openai-agents" | "local-fallback";
  model: string | null;
}

export interface MessageRunner {
  (kind: MessageKind, prompt: string): Promise<string>;
}

const modelConfig = appConfig.messageModel ? { model: appConfig.messageModel } : {};

const coachAgent = new Agent({
  name: "Runsetta coach",
  instructions: [
    "Write compact, useful coaching cues for endurance workouts.",
    "Be direct, grounded, and encouraging without pretending to be a human coach.",
    "Do not mention brands, named coaches, Spotify, medical advice, or unavailable data.",
    "Return one sentence under 24 words.",
  ].join(" "),
  ...modelConfig,
  outputType: AgentMessageSchema,
});

const transitionAgent = new Agent({
  name: "Runsetta transition writer",
  instructions: [
    "Write a one-line workout transition for the next track.",
    "Use the track metadata as inspiration, not quoted lyrics.",
    "Keep it concrete, non-corny, and under 22 words.",
  ].join(" "),
  ...modelConfig,
  outputType: AgentMessageSchema,
});

export async function generateCoachMessage(
  input: CoachMessageRequest,
  runner: MessageRunner = runAgent,
): Promise<GeneratedMessage> {
  return generateMessage("coach", buildCoachPrompt(input), input, runner);
}

export async function generateSpotifyTransition(
  input: SpotifyTransitionRequest,
  runner: MessageRunner = runAgent,
): Promise<GeneratedMessage> {
  return generateMessage("spotify-transition", buildTransitionPrompt(input), input, runner);
}

async function generateMessage(
  kind: MessageKind,
  prompt: string,
  fallbackContext: RunContext,
  runner: MessageRunner,
): Promise<GeneratedMessage> {
  if (runner === runAgent && (!appConfig.openaiApiKey || appConfig.offlineMode)) {
    return {
      generatedBy: "local-fallback",
      message: fallbackMessage(kind, fallbackContext),
      model: null,
    };
  }

  const output = await runner(kind, prompt);

  return {
    generatedBy: "openai-agents",
    message: normalizeMessage(output),
    model: appConfig.messageModel ?? null,
  };
}

async function runAgent(kind: MessageKind, prompt: string): Promise<string> {
  const result = await run(kind === "coach" ? coachAgent : transitionAgent, prompt);
  const output = result.finalOutput;

  if (typeof output === "string") {
    return output;
  }

  return AgentMessageSchema.parse(output).message;
}

function buildCoachPrompt(input: CoachMessageRequest): string {
  return [
    `Context: ${formatRunContext(input)}.`,
    input.cue ? `Requested focus: ${input.cue}.` : "Requested focus: general mid-workout cue.",
    "Write the cue now.",
  ].join("\n");
}

function buildTransitionPrompt(input: SpotifyTransitionRequest): string {
  const artist = input.track.artist ? ` by ${input.track.artist}` : "";
  const album = input.track.album ? ` from ${input.track.album}` : "";

  return [
    `Workout context: ${formatRunContext(input)}.`,
    `Next track: ${input.track.title}${artist}${album}.`,
    "Write the transition now.",
  ].join("\n");
}

function formatRunContext(context: RunContext): string {
  const parts = [
    context.runnerName ? `runner=${context.runnerName}` : null,
    `workout=${context.workoutType}`,
    context.effort ? `effort=${context.effort}` : null,
    typeof context.distanceMeters === "number" ? `distance=${Math.round(context.distanceMeters)}m` : null,
    typeof context.elapsedSeconds === "number" ? `elapsed=${Math.round(context.elapsedSeconds)}s` : null,
    typeof context.paceSecondsPerKilometer === "number"
      ? `pace=${Math.round(context.paceSecondsPerKilometer)}s/km`
      : null,
    typeof context.heartRateBpm === "number" ? `heartRate=${context.heartRateBpm}bpm` : null,
  ].filter(Boolean);

  return parts.join(", ");
}

function normalizeMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 280);
}

function fallbackMessage(kind: MessageKind, context: RunContext): string {
  const name = context.runnerName ? `${context.runnerName}, ` : "";
  const effort = context.effort === "hard" || context.effort === "race" ? "stay smooth under pressure" : "keep the rhythm honest";

  if (kind === "spotify-transition") {
    return `${name}${effort}; let the next song carry the next minute.`;
  }

  return `${name}${effort}, relax your shoulders, and make the next step simple.`;
}
