import { join } from "node:path";

import { appendEnv } from "#setup/append-env.js";
import { select, text } from "#setup/ask.js";
import type { VercelProjectReference } from "#setup/project-resolution.js";
import { deriveSlackConnectorSlug, normalizeSlackConnectorSlug } from "#setup/scaffold/index.js";
import { writeTextFile } from "#setup/scaffold/files.js";
import { WizardCancelledError } from "#setup/step.js";

import { askPortableCredentials, writePortableEnv } from "../shared/portable-credentials.js";
import {
  defineSetupIntegration,
  type SetupApplyContext,
  type SetupPrepareContext,
} from "../types.js";
import {
  attachLinearConnector,
  findLinearConnector,
  provisionLinearConnector,
  type LinearConnectorRef,
} from "./connect.js";

export interface LinearSetupDeps {
  appendEnv: typeof appendEnv;
  attachConnector: typeof attachLinearConnector;
  deriveConnectorSlug: typeof deriveSlackConnectorSlug;
  findConnector: typeof findLinearConnector;
  provisionConnector: typeof provisionLinearConnector;
  writeTextFile: typeof writeTextFile;
}

const defaultDeps: LinearSetupDeps = {
  appendEnv,
  attachConnector: attachLinearConnector,
  deriveConnectorSlug: deriveSlackConnectorSlug,
  findConnector: findLinearConnector,
  provisionConnector: provisionLinearConnector,
  writeTextFile,
};

export function linearSafeConnectorSlug(slug: string): string {
  const withoutLinear = slug.replaceAll(/linear/gi, "").replace(/[-_]{2,}/g, "-");
  return normalizeSlackConnectorSlug(withoutLinear || "agent");
}

const PORTABLE_TEMPLATE = `import { linearChannel } from "eve/channels/linear";

export default linearChannel();
`;

function connectTemplate(uid: string): string {
  return `import { connectLinearCredentials } from "@vercel/connect/eve";
import { linearChannel } from "eve/channels/linear";

export default linearChannel({
  credentials: connectLinearCredentials(${JSON.stringify(uid)}),
});
`;
}

type ConnectorPlan =
  | { kind: "reuse"; connector: LinearConnectorRef }
  | { kind: "create"; slug: string };

export type LinearSetupPlan =
  | { credentials: "environment" }
  | {
      credentials: "vercel-connect";
      connector: ConnectorPlan;
      project: VercelProjectReference;
    };

export async function prepareLinearSetup(
  context: SetupPrepareContext,
  deps: LinearSetupDeps = defaultDeps,
): Promise<LinearSetupPlan> {
  const credentials = await askPortableCredentials(context, {
    key: "linear-credentials",
    label: "Linear",
    connectHint: "Vercel Connect manages the Linear app and its webhooks",
    portableHint: "Bring your own Linear app and read its credentials from the environment",
  });
  if (credentials === "environment") return { credentials };
  const project = await context.resolveVercelProject("Linear");
  const defaultSlug = linearSafeConnectorSlug(await deps.deriveConnectorSlug(context.appRoot));
  const slug = linearSafeConnectorSlug(
    await context.asker.ask(
      text({
        key: "linear.connector-name",
        message: "Name your Linear agent",
        recommended: defaultSlug,
        validate: (value) =>
          value.trim().length === 0 ? "A Linear agent name is required." : null,
      }),
    ),
  );
  const existing = await deps.findConnector({
    project,
    projectRoot: context.projectRoot,
    slug,
    signal: context.signal,
  });
  if (existing === undefined) return { credentials, project, connector: { kind: "create", slug } };
  const choice = await context.asker.ask(
    select({
      key: "linear.existing-connector",
      message: `A Linear connector named "${slug}" already exists. What would you like to do?`,
      options: [
        { id: "reuse", label: "Reuse existing connector", value: "reuse" as const },
        { id: "new", label: "Create a new connector", value: "new" as const },
        { id: "exit", label: "Exit setup", value: "exit" as const },
      ],
      recommended: "reuse" as const,
    }),
  );
  if (choice === "exit") throw new WizardCancelledError();
  if (choice === "reuse")
    return { credentials, project, connector: { kind: "reuse", connector: existing } };
  const newSlug = linearSafeConnectorSlug(
    await context.asker.ask(
      text({
        key: "linear.new-connector-name",
        message: "Name the new Linear agent",
        recommended: `${slug}-2`,
        validate: (value) =>
          value.trim().length === 0 ? "A Linear agent name is required." : null,
      }),
    ),
  );
  return { credentials, project, connector: { kind: "create", slug: newSlug } };
}

export async function applyLinearSetup(
  plan: LinearSetupPlan,
  context: SetupApplyContext,
  deps: LinearSetupDeps = defaultDeps,
) {
  const channelPath = join(context.appRoot, "agent/channels/linear.ts");
  if (plan.credentials === "environment") {
    await deps.writeTextFile(channelPath, PORTABLE_TEMPLATE, { force: context.force });
    await writePortableEnv(
      {
        environmentRoot: context.projectRoot,
        values: { LINEAR_AGENT_ACCESS_TOKEN: "", LINEAR_WEBHOOK_SECRET: "" },
      },
      { appendEnv: deps.appendEnv },
    );
    context.presenter.nextSteps([
      "Create a Linear app with the app:assignable and app:mentionable scopes, then set LINEAR_AGENT_ACCESS_TOKEN and LINEAR_WEBHOOK_SECRET (listed in .env.example) in your host's environment.",
      "Point the Linear webhook at https://<your-host>/eve/v1/linear with Agent Session events, then delegate an issue to start a conversation.",
    ]);
    return { facts: [], deploymentRequired: true as const };
  }
  const connector =
    plan.connector.kind === "reuse"
      ? (await deps.attachConnector({
          connector: plan.connector.connector,
          log: context.presenter.log,
          project: plan.project,
          projectRoot: context.projectRoot,
          signal: context.signal,
        }),
        plan.connector.connector)
      : await deps.provisionConnector({
          log: context.presenter.log,
          project: plan.project,
          projectRoot: context.projectRoot,
          slug: plan.connector.slug,
          signal: context.signal,
        });
  await deps.writeTextFile(channelPath, connectTemplate(connector.uid), { force: context.force });
  context.presenter.nextSteps([
    "Deploy the agent, then open the Linear app in Vercel Connect and install it in the workspace where you want to delegate issues and comments.",
    "Delegate an issue or mention the agent in an Agent Session to start a conversation.",
  ]);
  return { facts: [], deploymentRequired: true as const };
}

export const LINEAR_SETUP = defineSetupIntegration({
  kind: "linear",
  label: "Linear Agent",
  hint: "Delegate Linear issues and comments",
  prepare: prepareLinearSetup,
  apply: applyLinearSetup,
});
