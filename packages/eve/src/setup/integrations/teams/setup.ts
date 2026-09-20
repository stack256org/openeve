import { join } from "node:path";

import { appendEnv } from "#setup/append-env.js";
import { text } from "#setup/ask.js";
import type { VercelProjectReference } from "#setup/project-resolution.js";
import { runVercel, runVercelCaptureStdout } from "#setup/primitives/run-vercel.js";
import { writeTextFile } from "#setup/scaffold/files.js";

import { provisionTeamsConnector } from "./connect.js";
import { askPortableCredentials, writePortableEnv } from "../shared/portable-credentials.js";
import {
  defineSetupIntegration,
  type SetupApplyContext,
  type SetupPrepareContext,
} from "../types.js";

export interface TeamsSetupDeps {
  appendEnv: typeof appendEnv;
  provisionConnector: typeof provisionTeamsConnector;
  runVercel: typeof runVercel;
  runVercelCaptureStdout: typeof runVercelCaptureStdout;
  writeTextFile: typeof writeTextFile;
}

const defaultDeps: TeamsSetupDeps = {
  appendEnv,
  provisionConnector: provisionTeamsConnector,
  runVercel,
  runVercelCaptureStdout,
  writeTextFile,
};

const PORTABLE_TEMPLATE = `import { teamsChannel } from "eve/channels/teams";

export default teamsChannel();
`;

function connectTemplate(uid: string): string {
  return `import { connectTeamsCredentials } from "@vercel/connect/eve";
import { teamsChannel } from "eve/channels/teams";

export default teamsChannel({
  credentials: connectTeamsCredentials(${JSON.stringify(uid)}),
});
`;
}

export type TeamsSetupPlan =
  | { credentials: "environment" }
  | { credentials: "vercel-connect"; name: string; project: VercelProjectReference };

export async function prepareTeamsSetup(context: SetupPrepareContext): Promise<TeamsSetupPlan> {
  const credentials = await askPortableCredentials(context, {
    key: "teams-credentials",
    label: "Microsoft Teams",
    connectHint: "Vercel Connect manages the Teams app and its installation",
    portableHint: "Bring your own Azure Bot and read its credentials from the environment",
  });
  if (credentials === "environment") return { credentials };
  const name = await context.asker.ask(
    text({
      key: "teams.bot-name",
      message: "Microsoft Teams bot name",
      detected: "eve agent",
      required: true,
      validate: (value) => (value.trim().length === 0 ? "A bot name is required." : null),
    }),
  );
  const project = await context.resolveVercelProject("Microsoft Teams");
  return { credentials, name: name.trim(), project };
}

export async function applyTeamsSetup(
  plan: TeamsSetupPlan,
  context: SetupApplyContext,
  deps: TeamsSetupDeps = defaultDeps,
) {
  const channelPath = join(context.appRoot, "agent/channels/teams.ts");
  if (plan.credentials === "environment") {
    await deps.writeTextFile(channelPath, PORTABLE_TEMPLATE, { force: context.force });
    await writePortableEnv(
      {
        environmentRoot: context.projectRoot,
        values: { MICROSOFT_APP_ID: "", MICROSOFT_APP_PASSWORD: "", MICROSOFT_TENANT_ID: "" },
      },
      { appendEnv: deps.appendEnv },
    );
    context.presenter.log.success("Scaffolded channel: teams");
    context.presenter.nextSteps([
      "Register an Azure Bot, then set MICROSOFT_APP_ID and MICROSOFT_APP_PASSWORD (listed in .env.example) in your host's environment. MICROSOFT_TENANT_ID is only needed for a single-tenant bot.",
      "Point the bot's messaging endpoint at https://<your-host>/eve/v1/teams, then mention the bot in a channel or send it a personal message.",
    ]);
    return { facts: [], deploymentRequired: true as const };
  }
  const connector = await deps.provisionConnector({
    name: plan.name,
    project: plan.project,
    log: context.presenter.log,
    projectRoot: context.projectRoot,
    signal: context.signal,
    deps,
  });
  await deps.writeTextFile(channelPath, connectTemplate(connector.uid), { force: context.force });
  context.presenter.log.success("Scaffolded channel: teams");
  context.presenter.nextSteps([
    "Deploy the agent.",
    "Mention the bot in a channel, or send it a message in a personal chat.",
  ]);
  return { facts: [], deploymentRequired: true as const };
}

export const TEAMS_SETUP = defineSetupIntegration({
  kind: "teams",
  label: "Microsoft Teams",
  hint: "Managed Teams bot with Vercel Connect",
  prepare: prepareTeamsSetup,
  apply: applyTeamsSetup,
});
