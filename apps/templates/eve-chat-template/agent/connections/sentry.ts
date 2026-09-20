import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.sentry.dev/mcp",
  description:
    "Sentry workspace: investigate issues, events, traces, releases, and project health.",
  auth: { getToken: async () => ({ token: process.env.SENTRY_AUTH_TOKEN! }) },
});
