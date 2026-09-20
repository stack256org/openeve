import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { defineAgent } from "eve";

// OPENAI_API_KEY, called directly. The Responses API is what carries the
// reasoning and verbosity options below.
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Terra is a good balance of speed, efficiency, and intelligence. A large context window is
 * used because looping through a large number of tool calls can eat a lot of context.
 *
 * `textVerbosity: "low"` is really wonderful and significantly "de-slops" the output from
 * the model, making important evidence easier to scan and understand.
 */
export default defineAgent({
  compaction: {
    thresholdPercent: 0.7,
  },
  model: openai.responses("gpt-5.6-terra"),
  modelContextWindowTokens: 1_000_000,
  modelOptions: {
    providerOptions: {
      openai: {
        reasoningEffort: "xhigh",
        textVerbosity: "low",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
});
