/** Which host operates the runtime services for this agent. */
export type HostProviderDefinition = "self" | "vercel";

/**
 * Resolves the active host.
 *
 * The authored `host` in `agent/agent.ts` always wins. The environment is only
 * consulted when nothing is authored, which keeps build-time call sites that
 * cannot reach the compiled manifest behaving correctly.
 */
export function resolveHostProvider(configured?: HostProviderDefinition): HostProviderDefinition {
  if (configured !== undefined) return configured;
  return process.env.VERCEL?.trim() ? "vercel" : "self";
}
