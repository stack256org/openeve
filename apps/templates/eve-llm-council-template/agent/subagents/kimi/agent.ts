import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

// Moonshot AI serves an OpenAI-compatible chat-completions API, so the OpenAI provider talks to
// it directly. `.chat()` is deliberate: the provider's callable default is the Responses API,
// which this endpoint does not serve.
const moonshot = createOpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
});

export default defineAgent({
  description: "Independently answer the user's prompt with Moonshot AI Kimi K3.",
  model: moonshot.chat("kimi-k3"),
});
