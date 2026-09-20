import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

// eve 0.27.3 predates `eve/models/anthropic`, so the provider is constructed
// here. It calls the Anthropic API directly with ANTHROPIC_API_KEY.
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default defineAgent({
  model: anthropic(process.env.DESIGN_AGENT_MODEL ?? "claude-sonnet-4.6"),
});
