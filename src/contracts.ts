import { z } from "zod";

export const effortLevels = ["easy", "steady", "hard", "race"] as const;
export const workoutTypes = ["run", "walk", "ride", "strength", "mobility"] as const;
export const audioFormats = ["aac", "mp3", "opus", "wav"] as const;
export const voices = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

const optionalTrimmedString = (maxLength: number) => z.string().trim().min(1).max(maxLength).optional();

export const RunContextSchema = z.object({
  runnerName: optionalTrimmedString(64),
  workoutType: z.enum(workoutTypes).default("run"),
  effort: z.enum(effortLevels).optional(),
  distanceMeters: z.number().finite().nonnegative().max(250_000).optional(),
  elapsedSeconds: z.number().finite().nonnegative().max(172_800).optional(),
  paceSecondsPerKilometer: z.number().finite().positive().max(3_600).optional(),
  heartRateBpm: z.number().finite().int().min(30).max(240).optional(),
});

export const CoachMessageRequestSchema = RunContextSchema.extend({
  cue: optionalTrimmedString(500),
});

export const TrackSchema = z.object({
  title: z.string().trim().min(1).max(160),
  artist: optionalTrimmedString(160),
  album: optionalTrimmedString(160),
});

export const SpotifyTransitionRequestSchema = RunContextSchema.extend({
  track: TrackSchema,
});

export const AudioRequestSchema = z.object({
  message: z.string().trim().min(1).max(1_000),
  format: z.enum(audioFormats).default("aac"),
  voice: z.enum(voices).optional(),
});

export const SpotifyTokenRequestSchema = z.object({
  code: z.string().trim().min(1).max(4_096),
  redirectUri: z.string().trim().url().max(2_048).optional(),
  codeVerifier: z.string().trim().min(43).max(128).optional(),
});

export const SpotifyRefreshRequestSchema = z.object({
  refreshToken: z.string().trim().min(1).max(4_096),
});

export const AgentMessageSchema = z.object({
  message: z.string().trim().min(1).max(280),
});

export type RunContext = z.infer<typeof RunContextSchema>;
export type CoachMessageRequest = z.infer<typeof CoachMessageRequestSchema>;
export type SpotifyTransitionRequest = z.infer<typeof SpotifyTransitionRequestSchema>;
export type AudioRequest = z.infer<typeof AudioRequestSchema>;
export type SpotifyTokenRequest = z.infer<typeof SpotifyTokenRequestSchema>;
export type SpotifyRefreshRequest = z.infer<typeof SpotifyRefreshRequestSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
