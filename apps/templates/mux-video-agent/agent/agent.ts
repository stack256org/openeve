import { defineAgent } from "eve";

const model = process.env.MUX_VIDEO_AGENT_MODEL?.trim() || "openai/gpt-5.6-luna";

export default defineAgent({
  model,
  reasoning: "medium",
  limits: {
    maxOutputTokensPerSession: 40_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
});
