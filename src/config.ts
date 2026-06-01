export const appConfig = {
  appName: "Runsetta",
  environment: Bun.env.NODE_ENV ?? "development",
  port: Number.parseInt(Bun.env.PORT ?? "8080", 10),
  publicDir: Bun.env.PUBLIC_DIR ?? new URL("../public", import.meta.url).pathname,
  maxJsonBytes: Number.parseInt(Bun.env.MAX_JSON_BYTES ?? "16384", 10),
  openaiApiKey: Bun.env.OPENAI_API_KEY,
  messageModel: Bun.env.RUNSETTA_MESSAGE_MODEL,
  ttsModel: Bun.env.RUNSETTA_TTS_MODEL ?? "gpt-4o-mini-tts",
  ttsVoice: Bun.env.RUNSETTA_TTS_VOICE ?? "marin",
  offlineMode: Bun.env.RUNSETTA_OFFLINE === "1",
  spotifyClientId: Bun.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: Bun.env.SPOTIFY_CLIENT_SECRET,
  spotifyRedirectUri: Bun.env.SPOTIFY_REDIRECT_URI,
} as const;

export type AppConfig = typeof appConfig;
