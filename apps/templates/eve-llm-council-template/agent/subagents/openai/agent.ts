import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default defineAgent({
  description: "Independently answer the user's prompt with OpenAI GPT-5.6 Sol.",
  model: openai.responses("gpt-5.6-sol"),
});
