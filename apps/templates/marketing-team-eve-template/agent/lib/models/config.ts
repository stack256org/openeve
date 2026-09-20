import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * One place to change any agent's model.
 *
 * @remarks
 * Every provider is called directly with its own API key, so no gateway sits in the request path.
 * Each `agent.ts` reads its entry here rather than building a model itself, which keeps the whole
 * team's model choice visible in one file: a specialist that should run cheaper, or on a different
 * vendor than the agent reviewing its work, is a one-line change.
 */

/** Anthropic, reading `ANTHROPIC_API_KEY`. */
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * The model each agent runs on, keyed by the agent's directory name (`lead` for the root).
 */
export const MODELS = {
  "content-marketer": anthropic("claude-opus-5"),
  email: anthropic("claude-opus-5"),
  lead: anthropic("claude-opus-5"),
  "product-marketer": anthropic("claude-opus-5"),
  seo: anthropic("claude-opus-5"),
  "social-media-coordinator": anthropic("claude-opus-5"),
} as const satisfies Record<string, LanguageModel>;
