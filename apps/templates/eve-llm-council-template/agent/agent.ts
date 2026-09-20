import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default defineAgent({
  model: anthropic("claude-opus-5"),
  limits: {
    maxOutputTokensPerSession: 4_000,
  },
});
