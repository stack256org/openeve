/** Which host operates the runtime services for this agent. */
export type HostProviderDefinition = "self" | "vercel";

/** Environment key carrying the authored host from the compiled manifest. */
export const HOST_PROVIDER_ENV = "EVE_HOST_PROVIDER";

/**
 * Publishes the authored host for the whole process.
 *
 * The generated compiled-artifacts bootstrap calls this once at cold start,
 * before any request. Call sites are deep utilities that never see an agent
 * definition, so the value travels through the environment the same way the
 * agent-scoped Workflow queue namespace does.
 */
export function installHostProvider(host: HostProviderDefinition | undefined): void {
  if (host === undefined) return;
  process.env[HOST_PROVIDER_ENV] = host;
}

/**
 * Resolves the active host.
 *
 * An explicit argument always wins, for build-time callers that hold the
 * compiled manifest directly. Next comes the host installed from the manifest
 * at boot. The environment is consulted last, which keeps the resolver correct
 * in processes where no manifest was ever installed — builds, the CLI, and
 * Nitro shutdown among them.
 */
export function resolveHostProvider(configured?: HostProviderDefinition): HostProviderDefinition {
  if (configured !== undefined) return configured;
  const installed = process.env[HOST_PROVIDER_ENV]?.trim();
  if (installed === "self" || installed === "vercel") return installed;
  return process.env.VERCEL?.trim() ? "vercel" : "self";
}
