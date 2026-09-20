import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  // Each case creates a real Mux Robots job, so keep execution serial.
  maxConcurrency: 1,
  timeoutMs: 8 * 60 * 1_000,
});
