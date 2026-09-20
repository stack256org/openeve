import { defineMcpClientConnection } from "eve/connections";

/**
 * Bare Notion MCP tool names whose calls require human approval before running.
 *
 * @remarks
 * Add a tool's bare name here to gate it. eve hands the approval policy the qualified name,
 * `<connection>__<tool>`, where `<tool>` is exactly what the MCP server names it (e.g.
 * `notion__notion-update-pages`; Notion's own tool names carry a `notion-` prefix). Entries
 * are matched as substrings, so they gate the tool regardless of the server's naming.
 */
const APPROVAL_REQUIRED_TOOLS = [
  "notion-move-pages",
  "notion-update-data-source",
  "notion-update-view",
];

/**
 * Notion workspace connection (MCP) exposing search, read, and edit tools to the model.
 *
 * @remarks
 * Authorization is a Notion integration token read from `NOTION_API_KEY`. The token is resolved
 * before every tool call and never exposed to the model. It is workspace-scoped rather than
 * per-user, so every member of the team reaches Notion as the same integration.
 *
 * Tools listed in {@link APPROVAL_REQUIRED_TOOLS} are gated on human approval: a gated call
 * pauses for an approve/deny decision (rendered as a Slack button) before it runs.
 */
export default defineMcpClientConnection({
  approval: ({ toolName }) =>
    APPROVAL_REQUIRED_TOOLS.some((tool) => toolName.includes(tool))
      ? "user-approval"
      : "not-applicable",
  auth: { getToken: async () => ({ token: process.env.NOTION_API_KEY! }) },
  description: "Notion workspace: search, read, and edit pages and databases.",
  url: "https://mcp.notion.com/mcp",
});
