import { createGithubTools } from "@github-tools/sdk/eve";

/**
 * GitHub tool set for reading and triaging issues.
 *
 * @remarks
 * Registers the GitHub Tools SDK's `maintainer` preset. Authorization is a token read from
 * `GITHUB_TOKEN` — a personal access token or an installation token — resolved lazily inside each
 * tool's execute call, so nothing authenticates at import or build time. Scope the token to the
 * repositories the agent maintains.
 *
 * Issue-conversation writes (comments, issue create/close, labels) run without approval: they are
 * reversible actions on the configured repo, and the email surface cannot render an approval
 * prompt, so a gate there would strand the session. Higher-impact writes (merging PRs, pushing
 * files, repo creation) keep the SDK's approval-by-default.
 */
export default createGithubTools({
  preset: "maintainer",
  requireApproval: {
    addIssueComment: "never",
    addLabels: "never",
    closeIssue: "never",
    createIssue: "never",
    removeLabel: "never",
  },
});
