import { createOpenAI } from "@ai-sdk/openai";
import { defineEvalConfig } from "eve/evals";

// Google serves an OpenAI-compatible chat-completions API, so the OpenAI provider talks to
// Gemini directly. `.chat()` is deliberate: the provider's callable default is the Responses
// API, which this endpoint does not serve.
const google = createOpenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  // Without `name`, the provider id stays `openai` and eve builds the catalogue
  // slug as `openai/<model>`, which has no context-window metadata.
  name: "google",
});

/**
 * Run-wide eval configuration.
 *
 * @remarks
 * The judge model scores `t.judge.*` assertions only; it never changes the
 * agent under test. A small, cheap model is enough for the yes/no grading the
 * suite uses. Run the default loop with `pnpm eval --tag fast`; see the
 * README's evals section for the full matrix.
 */
export default defineEvalConfig({
  judge: { model: google.chat("gemini-3.6-flash") },
});
