/**
 * Reads a required environment variable, throwing if it is unset so
 * misconfiguration fails fast instead of surfacing mid-request.
 *
 * @remarks
 * Call it at module load when the value is needed for discovery (channel
 * credentials, schedule targets), or inside a handler when a missing value
 * should not prevent the rest of the agent from loading.
 *
 * @param name - The environment variable name.
 * @param example - An example value, included in the error message.
 * @returns The environment variable's value.
 */
export function requireEnv(name: string, example: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set (e.g. '${example}').`);
  }
  return value;
}

/**
 * Shared Linear authorization.
 *
 * Single source of truth for the Linear credential so every consumer — the
 * Linear MCP connection and any tool calling the GraphQL API directly —
 * shares one installation and one set of scopes.
 *
 * @remarks
 * - The token comes from `LINEAR_AGENT_ACCESS_TOKEN`, the same variable the
 *   Linear channel reads, so the agent acts as one Linear identity everywhere.
 * - It is app-scoped: no per-user consent flow is required, and the scopes are
 *   whatever the token was minted with (`read`, `write`, `issues:create`, and
 *   `comments:create` cover what this agent does).
 * - It is resolved per call and never exposed to the model, and the module
 *   only throws once something actually asks for it.
 */
export const linearAuth = {
  getToken: () =>
    Promise.resolve({ token: requireEnv("LINEAR_AGENT_ACCESS_TOKEN", "lin_oauth_123") }),
};
