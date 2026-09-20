import type { HostProviderDefinition } from "#internal/host/provider.js";

/** Runs this agent's services on Vercel: Workflow, Sandbox, Blob, and Cron. */
export function vercel(): HostProviderDefinition {
  return "vercel";
}
