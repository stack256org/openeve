import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

// xAI serves an OpenAI-compatible chat-completions API, so the OpenAI provider talks to it
// directly. `.chat()` is deliberate: the provider's callable default is the Responses API,
// which this endpoint does not serve. `name` is what eve reads to look up the model's context
// window, so without it the model resolves as "openai/grok-4.5" and compaction fails to compile.
const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
  name: "xai",
});

export default defineAgent({
  description: "Independently answer the user's prompt with xAI Grok 4.5.",
  model: xai.chat("grok-4.5"),
});
