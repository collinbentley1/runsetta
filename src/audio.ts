import OpenAI from "openai";
import { appConfig } from "./config";
import type { AudioRequest } from "./contracts";

const contentTypes: Record<AudioRequest["format"], string> = {
  aac: "audio/aac",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  wav: "audio/wav",
};

export interface SpeechResult {
  body: ArrayBuffer;
  contentType: string;
}

export async function createSpeech(input: AudioRequest): Promise<SpeechResult> {
  if (!appConfig.openaiApiKey) {
    throw new ServiceConfigurationError("OPENAI_API_KEY is required for speech generation.");
  }

  const client = new OpenAI({ apiKey: appConfig.openaiApiKey });
  const response = await client.audio.speech.create({
    input: input.message,
    instructions: "Use clear synthetic coaching audio. Do not imitate a specific person.",
    model: appConfig.ttsModel,
    response_format: input.format,
    voice: (input.voice ?? appConfig.ttsVoice) as string,
  });

  return {
    body: await response.arrayBuffer(),
    contentType: contentTypes[input.format],
  };
}

export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}
