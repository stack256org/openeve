/** Token lookup options forwarded to the vendored `@vercel/oidc` reader. */
export interface VercelOidcTokenOptions {
  /** Buffer in milliseconds before token expiry that triggers a refresh. */
  readonly expirationBufferMs?: number;
  /** Project ID (`prj_*`) or slug to use for token refresh. */
  readonly project?: string;
  /** Team ID (`team_*`) or slug to use for token refresh. */
  readonly team?: string;
}

/**
 * Reads a Vercel OIDC token, loading the vendored reader on first use.
 *
 * The import is dynamic so a self-hosted deployment never loads Vercel code:
 * every caller already runs inside an async function, and none of them reach
 * this path unless the agent is actually operated by Vercel.
 */
export async function readVercelOidcToken(options?: VercelOidcTokenOptions): Promise<string> {
  const { getVercelOidcToken } = await import("#compiled/@vercel/oidc/index.js");
  return await getVercelOidcToken(options);
}
