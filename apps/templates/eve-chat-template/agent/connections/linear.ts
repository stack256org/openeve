import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description:
    "Linear workspace: search and update issues, projects, cycles, comments, and planning work.",
  auth: { getToken: async () => ({ token: process.env.LINEAR_API_KEY! }) },
});
