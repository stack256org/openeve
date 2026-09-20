import { join } from "node:path";

import { appendEnv } from "#setup/append-env.js";
import { text } from "#setup/ask.js";
import type { VercelProjectReference } from "#setup/project-resolution.js";
import { deriveSlackConnectorSlug } from "#setup/scaffold/index.js";
import { writeTextFile } from "#setup/scaffold/files.js";

import { askPortableCredentials, writePortableEnv } from "../shared/portable-credentials.js";
import {
  defineSetupIntegration,
  type SetupApplyContext,
  type SetupPrepareContext,
} from "../types.js";
import {
  configureDiscordInteractionsEndpoint,
  registerDiscordCommand,
  resolveDiscordApplication,
} from "./api.js";
import { provisionDiscordConnector } from "./connect.js";

export interface DiscordSetupDeps {
  appendEnv: typeof appendEnv;
  configureEndpoint: typeof configureDiscordInteractionsEndpoint;
  deriveConnectorSlug: typeof deriveSlackConnectorSlug;
  provisionConnector: typeof provisionDiscordConnector;
  registerCommand: typeof registerDiscordCommand;
  resolveApplication: typeof resolveDiscordApplication;
  writeTextFile: typeof writeTextFile;
}

const defaultDeps: DiscordSetupDeps = {
  appendEnv,
  configureEndpoint: configureDiscordInteractionsEndpoint,
  deriveConnectorSlug: deriveSlackConnectorSlug,
  provisionConnector: provisionDiscordConnector,
  registerCommand: registerDiscordCommand,
  resolveApplication: resolveDiscordApplication,
  writeTextFile,
};

function validateCommandName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Command name is required.";
  if (name.length > 32) return "Command name must be 32 characters or fewer.";
  return /^[a-z0-9_-]+$/.test(name)
    ? null
    : "Use lowercase letters, numbers, hyphens, or underscores.";
}

const PORTABLE_TEMPLATE = `import { discordChannel } from "eve/channels/discord";

export default discordChannel();
`;

function connectTemplate(uid: string): string {
  return `import { connectDiscordCredentials } from "@vercel/connect/eve";
import { discordChannel } from "eve/channels/discord";

export default discordChannel({
  credentials: connectDiscordCredentials(${JSON.stringify(uid)}),
});
`;
}

export type DiscordSetupPlan = {
  botToken: string;
  commandName: string;
  commandDescription: string;
} & (
  | { credentials: "environment" }
  | { credentials: "vercel-connect"; project: VercelProjectReference; slug: string }
);

export async function prepareDiscordSetup(
  context: SetupPrepareContext,
  deps: DiscordSetupDeps = defaultDeps,
): Promise<DiscordSetupPlan> {
  const credentials = await askPortableCredentials(context, {
    key: "discord-credentials",
    label: "Discord",
    connectHint: "Use a linked Vercel project",
    portableHint: "Read the Discord bot token from environment variables",
  });
  context.presenter.log.info(
    "Create a Discord application or open an existing one, then go to Bot → Reset Token and copy the new bot token.\nCreate: https://discord.com/developers/applications?new_application=true\nExisting applications: https://discord.com/developers/applications",
  );
  const botToken = (
    await context.asker.ask(
      text({
        key: "discord-bot-token",
        message: "Discord bot token",
        required: true,
        sensitive: true,
        environment: "DISCORD_BOT_TOKEN",
      }),
    )
  ).trim();
  const commandName = await context.asker.ask(
    text({
      key: "discord-command-name",
      message: "Discord command name",
      detected: "ask",
      required: true,
      validate: validateCommandName,
    }),
  );
  const commandDescription = await context.asker.ask(
    text({
      key: "discord-command-description",
      message: "Discord command description",
      detected: "Ask the eve agent",
      required: true,
      validate: (value) =>
        value.trim().length === 0
          ? "Command description is required."
          : value.trim().length > 100
            ? "Command description must be 100 characters or fewer."
            : null,
    }),
  );
  const command = {
    botToken,
    commandName: commandName.trim(),
    commandDescription: commandDescription.trim(),
  };
  if (credentials === "environment") return { ...command, credentials };
  const project = await context.resolveVercelProject("Discord");
  return {
    ...command,
    credentials,
    project,
    slug: await deps.deriveConnectorSlug(context.appRoot),
  };
}

export async function applyDiscordSetup(
  plan: DiscordSetupPlan,
  context: SetupApplyContext,
  deps: DiscordSetupDeps = defaultDeps,
) {
  const application = await deps.resolveApplication(plan.botToken);
  const channelPath = join(context.appRoot, "agent/channels/discord.ts");
  const installUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(application.id)}&scope=${encodeURIComponent("bot applications.commands")}&permissions=3072`;
  const tryItStep = `Install the Discord application, then try /${plan.commandName}: ${installUrl}`;
  const command = { name: plan.commandName, description: plan.commandDescription };
  if (plan.credentials === "environment") {
    await deps.registerCommand(application.id, plan.botToken, command);
    await deps.writeTextFile(channelPath, PORTABLE_TEMPLATE, { force: context.force });
    await writePortableEnv(
      {
        environmentRoot: context.projectRoot,
        values: {
          DISCORD_APPLICATION_ID: application.id,
          DISCORD_BOT_TOKEN: plan.botToken,
          DISCORD_PUBLIC_KEY: application.publicKey,
        },
      },
      { appendEnv: deps.appendEnv },
    );
    context.presenter.nextSteps([
      "Deploy the agent, then set the Discord application's Interactions Endpoint URL to https://<your-host>/eve/v1/discord.",
      tryItStep,
    ]);
  } else {
    const connector = await deps.provisionConnector({
      botToken: plan.botToken,
      log: context.presenter.log,
      project: plan.project,
      projectRoot: context.projectRoot,
      slug: plan.slug,
      signal: context.signal,
    });
    await deps.registerCommand(application.id, plan.botToken, command);
    await deps.configureEndpoint(plan.botToken, connector.id);
    await deps.writeTextFile(channelPath, connectTemplate(connector.uid), { force: context.force });
    context.presenter.nextSteps([tryItStep]);
  }
  return {
    deploymentRequired: true as const,
    facts: [
      {
        label: "Discord application dashboard",
        value: `https://discord.com/developers/applications/${application.id}/information`,
        kind: "url" as const,
      },
    ],
  };
}

export const DISCORD_SETUP = defineSetupIntegration({
  kind: "discord",
  label: "Discord",
  hint: "Slash commands and interactions",
  prepare: prepareDiscordSetup,
  apply: applyDiscordSetup,
});
