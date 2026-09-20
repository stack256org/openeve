import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// One place to change every agent's model. Each provider is called directly with its own API
// key, so there is no gateway in the request path. Each agent.ts reads its entry here
// (model: MODELS.<agent>) instead of building a model itself.
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const MODELS = {
  analyst: openai.responses("gpt-5.6-terra-fast"),
  classifier: openai.responses("gpt-5.6-terra-fast"),
  implementer: anthropic("claude-fable-5"), // the station that writes the code gets the strongest coding model
  orchestrator: openai.responses("gpt-5.6-terra-fast"),
  researcher: openai.responses("gpt-5.6-terra-fast"),
  reviewer: openai.responses("gpt-5.6-terra-fast"), // different vendor than implementer on purpose: independent review
} as const satisfies Record<string, LanguageModel>;

export type FactoryAgent = keyof typeof MODELS;
