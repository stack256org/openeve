import { defineMcpClientConnection } from "eve/connections";

/**
 * Bare Sanity MCP tool names whose calls require human approval before running.
 *
 * @remarks
 * Add a tool's bare name here to gate it. eve hands the approval policy the qualified name,
 * `<connection>__<tool>`, where `<tool>` is exactly what the MCP server names it (e.g.
 * `sanity__patch_documents`). Entries are matched as substrings, so they gate the tool
 * regardless of the server's naming.
 */
const APPROVAL_REQUIRED_TOOLS = [
  "patch_documents",
  "publish_documents",
  "unpublish_documents",
  "discard_drafts",
  "version_discard",
  "update_dataset",
  "deploy_schema",
  "deploy_studio",
];

/**
 * Sanity connection (MCP) exposing search, read, and edit tools to the model.
 *
 * @remarks
 * Authorization is a Sanity API token read from `SANITY_API_TOKEN`. The token is resolved before
 * every tool call and never exposed to the model. It is project-scoped rather than per-user, so
 * every Slack user reaches Sanity with the same permissions: mint the token with the narrowest
 * role the agent needs.
 *
 * Tools listed in {@link APPROVAL_REQUIRED_TOOLS} are gated on human approval: a gated call
 * pauses for an approve/deny decision (rendered as a Slack button) before it runs.
 */
export default defineMcpClientConnection({
  approval: ({ toolName }) =>
    APPROVAL_REQUIRED_TOOLS.some((tool) => toolName.includes(tool))
      ? "user-approval"
      : "not-applicable",
  auth: { getToken: async () => ({ token: process.env.SANITY_API_TOKEN! }) },
  description:
    "Sanity CMS: query documents with GROQ, inspect schemas, create/edit drafts, manage releases, generate media.",
  url: "https://mcp.sanity.io",
});
