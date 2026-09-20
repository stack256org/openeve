import githubExtension from "@github-tools/eve-extension";

/**
 * Read-only access by default to GitHub, regardless of the scopes attached to the token.
 *
 * The extension reads `GITHUB_TOKEN` from the environment; the preset is what keeps the
 * surface read-only even when the token itself carries write scopes.
 */
export default githubExtension({
  exclude: ["getGist", "listGists", "listGistComments"],
  preset: "repo-explorer",
});
