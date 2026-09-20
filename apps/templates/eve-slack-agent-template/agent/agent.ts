import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

// This template pins eve below 0.57.0, which is where `eve/models/anthropic`
// first shipped, so the provider is constructed here. It calls the Anthropic
// API directly with ANTHROPIC_API_KEY — no gateway in between.
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default defineAgent({
  model: anthropic("claude-sonnet-5"),
});
