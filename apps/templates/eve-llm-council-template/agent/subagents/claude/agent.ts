import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default defineAgent({
  description: "Independently answer the user's prompt with Anthropic Claude Opus 5.",
  model: anthropic("claude-opus-5"),
});
