/**
 * The token the factory's GitHub surfaces authenticate with.
 *
 * @remarks
 * One token serves every GitHub surface that needs to act as the factory: the
 * `github` extension's tools and the git credential the station sandboxes
 * clone, fetch, and push with. A GitHub App installation token or a
 * fine-grained personal access token both work; it needs contents and pull
 * request write access on {@link FACTORY_REPO}, and issue write access for
 * triage.
 *
 * The channel is separate: it verifies webhooks and replies as the GitHub App
 * itself, so eve reads `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
 * `GITHUB_APP_SLUG`, and `GITHUB_WEBHOOK_SECRET` for that.
 *
 * Resolved per use and never exposed to the model; the git helpers inject it
 * at the sandbox firewall (see `agent/lib/github/git-remote.ts`), so it never
 * enters the sandbox either.
 */
export function githubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set.");
  }
  return token;
}
