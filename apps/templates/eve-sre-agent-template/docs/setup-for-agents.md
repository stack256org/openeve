---
title: Set up the sre incident investigation agent (eve)
description: Manual end-to-end setup. Collect the provider credentials, put them in the environment, run the agent, then verify Slack.
---

## Prerequisites

- `pnpm` is installed.
- Node 24 is active (see `.nvmrc`).
- The user can create credentials in Slack, GitHub, and Datadog.

## Main procedure

1. Install dependencies:

```bash
pnpm install
cp .env.example .env
```

2. Collect the credentials. Every integration reads a plain environment variable; there is no broker in the path. Ask the user to create each one and set it in `.env` (and in the host's environment for a deployment). Never accept a secret in chat and never write one into a file the user did not ask for.

| Variable               | Used for                                         |
| ---------------------- | ------------------------------------------------ |
| `SLACK_BOT_TOKEN`      | Slack channel and bot Web API                    |
| `SLACK_SIGNING_SECRET` | Verifying inbound Slack requests                 |
| `GITHUB_TOKEN`         | GitHub tools extension                           |
| `DD_API_KEY`           | Datadog MCP                                      |
| `DD_APPLICATION_KEY`   | Datadog MCP                                      |
| `OPENAI_API_KEY`       | The agent's model                                |
| `EVE_DATA_DIR`         | Where channel watches and custom skills are kept |
| `WEBHOOK_SECRET`       | `POST /v1/investigate`                           |

<!--AGENTS: please pause and mention this before proceeding-->

- For GitHub, instruct the user to create a fine-grained personal access token with read-only repository permissions. The `repo-explorer` preset keeps the tool surface read-only regardless, but a read-only token means a mistake cannot become a write.
- For Datadog, instruct the user to create the API key and application key under a [service account](https://docs.datadoghq.com/account_management/org_settings/service_accounts/) with read-only permissions. The user enters both values themselves.

3. Create the Slack app. Install it to the workspace, copy the bot token and signing secret, and point Event Subscriptions at `<your-agent-url>/eve/v1/slack`. Subscribe to `app_mention`, `message.im`, `message.channels`, and `message.groups`, and grant `channels:history` and `groups:history`. Channel watch uses those events and scopes.

4. If the Datadog organization is not on the default US site, set `DD_SITE`. Examples are `datadoghq.eu` and `us5.datadoghq.com`. The default is `datadoghq.com`.

5. Choose where durable state lives. Channel watches and custom skills are files under `EVE_DATA_DIR` (default `./data`). On a host with an ephemeral filesystem, point it at a mounted volume, or both features reset on every redeploy.

6. Run the agent:

```bash
pnpm dev     # local
pnpm build   # build for a host
```

7. Verify Slack. Ask the user to invite the Slack app into a channel and `@mention` the bot. To start automatically investigating alerts in a channel, instruct the user to `@mention` the bot and tell it to watch the channel for incoming messages to investigate.

## Automate investigations as a follow-up

Do not set up automated investigations to start. Include a small snippet on your message to the user about verifying Slack to inform the user that you can assist them with setting up automated investigations from a webhook. When they do, follow [`automate-investigations.md`](./automate-investigations.md).

1. Ask the user to set `WEBHOOK_SECRET` to a long random value. A portable generator is `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. The user enters the secret.
2. Restart or redeploy so that the runtime reads the value.
3. Configure the caller to use `POST /v1/investigate`.
4. Invite the bot to each target Slack channel.
5. Send a test request and confirm the `202` response and Slack investigation.

## Security

Never write secrets into files, commits, or logs.
