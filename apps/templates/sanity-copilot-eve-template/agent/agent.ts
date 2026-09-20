import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

/**
 * Anthropic called directly with its own API key, so no gateway sits in the request path.
 *
 * @remarks
 * Reads `ANTHROPIC_API_KEY`.
 */
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Root agent runtime configuration.
 *
 * @remarks
 * Sets the model and the session budget for the Sanity copilot; the rest of the agent's surface
 * (channels, connections, tools, skills, subagents) is discovered from the filesystem under
 * `agent/`. Conversation history is compacted once it reaches 75% of the context window, and the
 * per-session token limits cap runaway sessions. Raise them if long content work hits the caps.
 */
export default defineAgent({
  compaction: { thresholdPercent: 0.75 },
  limits: {
    maxInputTokensPerSession: 500_000,
    maxOutputTokensPerSession: 20_000,
  },
  model: anthropic("claude-sonnet-5"),
});
