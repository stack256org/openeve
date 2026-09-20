import type { ConnectorDef } from "#shared/types/connector";
import { IntegrationTestError } from "~~/server/utils/errors";
import { fetchLinearIssuesViaGraphql, fetchLinearIssuesViaMcp } from "~~/server/utils/linear-mcp";

export const connectors: ConnectorDef[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Repositories, issues, pull requests, and CI workflows.",
    envVar: "GITHUB_TOKEN",
    connectionName: "github",
    icon: "i-simple-icons-github",
    test: {
      label: "List my repositories",
      run: async (token) => {
        const res = await fetch("https://api.github.com/user/repos?per_page=5", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "personal-agent-template",
          },
        });

        if (!res.ok) {
          throw new IntegrationTestError(`GitHub API error: ${res.status} ${res.statusText}`);
        }

        const repos = (await res.json()) as Array<{ full_name: string }>;
        return repos.map((repo) => repo.full_name);
      },
    },
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues, projects, cycles, and comments in your Linear workspace.",
    envVar: "LINEAR_API_KEY",
    connectionName: "linear",
    icon: "i-simple-icons-linear",
    test: {
      label: "List my issues",
      run: async (token) => {
        const mcpResult = await fetchLinearIssuesViaMcp(token);
        if (mcpResult.ok) {
          return mcpResult.results;
        }

        const graphqlResult = await fetchLinearIssuesViaGraphql(token);
        if (graphqlResult.ok) {
          return graphqlResult.results;
        }

        throw new IntegrationTestError(
          mcpResult.error ?? graphqlResult.error ?? "Linear test failed",
        );
      },
    },
  },
];

export function getConnector(id: string): ConnectorDef {
  const connector = connectors.find((entry) => entry.id === id);

  if (!connector) {
    throw createError({
      statusCode: 404,
      statusMessage: "Connector not found",
    });
  }

  return connector;
}
