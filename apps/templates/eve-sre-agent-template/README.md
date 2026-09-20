![sre banner](./.github/banner.png)

# sre

[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

sre is an [eve](https://eve.dev) incident response agent for Slack. It brings together the observability data you need to debug an alert or incident across Datadog, GitHub, and other tools. Investigations are read-only by default.

Mention `@sre`, watch a channel for alerts, or invoke it from an external system with a webhook. The agent checks hypotheses against live signals and records each finding with a source link. Replies start with the answer, then the supporting evidence.

## How it works

An investigation starts from one of three places.

- A Slack mention or direct message.
- A new top-level message in a watched Slack channel.
- A `POST /v1/investigate` webhook call.

The agent records novel, decision-relevant findings with source links. Each investigation turn has its own evidence set. The agent records each finding-and-URL pair once, then adds recorded evidence to the Slack result.

Automated runs use webhook metadata and service-authenticated tools. They do not use per-user OAuth.

Channel watch and custom skills are optional. Both store state as files under `EVE_DATA_DIR` (default `./data`). On a host with an ephemeral filesystem, point that at a mounted volume or the state resets on every redeploy.

## Set up the project

Every integration reads a plain environment variable, so the agent runs anywhere Node 24 does. Copy [`.env.example`](./.env.example) to `.env` and fill it in:

1. Create a Slack app, install it to your workspace, and copy `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`. Point its Event Subscriptions request URL at `<your-agent-url>/eve/v1/slack`.
2. Create a fine-grained GitHub personal access token with read-only repository access and set `GITHUB_TOKEN`.
3. Create a Datadog API key and application key, ideally on a read-only service account, and set `DD_API_KEY` and `DD_APPLICATION_KEY`.
4. Set `OPENAI_API_KEY` for the agent's model.

For a complete step-by-step setup with your agent, use [`docs/setup-for-agents.md`](./docs/setup-for-agents.md).

Then:

1. Invite the Slack app to a channel.
2. Mention `@sre` and confirm that the app replies.
3. To enable automated runs via a webhook, follow [`docs/automate-investigations.md`](./docs/automate-investigations.md).

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Environment configuration

| Variable               | Required | Default         | What it does                                                                                            |
| ---------------------- | -------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`      | Yes      | none            | Slack bot token for the channel and the bot Web API tools.                                              |
| `SLACK_SIGNING_SECRET` | Yes      | none            | Slack signing secret used to verify inbound requests.                                                   |
| `OPENAI_API_KEY`       | Yes      | none            | Model provider key for the agent's model.                                                               |
| `GITHUB_TOKEN`         | No       | none            | GitHub token for the read-only GitHub tools extension.                                                  |
| `DD_API_KEY`           | No       | none            | Datadog API key, sent to the Datadog MCP server as the `DD_API_KEY` header.                             |
| `DD_APPLICATION_KEY`   | No       | none            | Datadog application key, sent as the `DD_APPLICATION_KEY` header.                                       |
| `DD_SITE`              | No       | `datadoghq.com` | Datadog site for MCP. Examples are `datadoghq.eu` and `us5.datadoghq.com`.                              |
| `EVE_DATA_DIR`         | No       | `./data`        | Directory holding channel watches and custom skills. Use a mounted volume to survive a redeploy.        |
| `WEBHOOK_SECRET`       | No       | none            | Shared secret for `POST /v1/investigate`. Use a long random value from Node crypto (`randomBytes(32)`). |

Copy [`.env.example`](./.env.example) to `.env` to set local environment variables.

## Automation endpoint

`POST /v1/investigate` accepts a title, a Slack channel, an optional description, and optional metadata. It returns `202` and starts a Slack investigation.

The endpoint uses `WEBHOOK_SECRET`. Send the secret with `x-sre-webhook-secret` or `Authorization: Bearer`.

## Customize the agent

- Edit `agent/instructions/instructions.md` to change general behavior.
- Edit the built-in skills in `agent/skills/` to change investigation and handoff procedures.
- Add tools or connections for other operational systems in `agent/connections/`.
- Integrate with `agent/channels/webhook.ts` to invoke the agent from any external system (see [`docs/automate-investigations.md`](./docs/automate-investigations.md)).

### Create runbooks in Slack

Ask `@sre` to create a runbook for a recurring alert or incident. Global runbooks apply to every session. Personal runbooks apply only to the requesting Slack user and override global runbooks with the same name. The agent loads a saved runbook on a later matching request, not during the request that creates it. Runbooks are stored as files under `EVE_DATA_DIR`.

## Verify changes

```bash
pnpm validate
pnpm test
```

## Troubleshooting

- If Slack mentions do not arrive, confirm that the trigger path is `/eve/v1/slack`.
- If a webhook returns `401`, confirm that the caller and the deployment use the same `WEBHOOK_SECRET`.
- If an investigation does not start, confirm that the bot is a member of `slackChannel`.
- If custom skills fail to save, confirm that `EVE_DATA_DIR` exists and is writable by the process.

## Learn more

- [eve documentation](https://eve.dev/docs/introduction)
- [Automate investigations with generic webhooks](./docs/automate-investigations.md)

## Explore more templates

- [eve software factory](https://vercel.com/templates/eve/eve-software-factory)
- [eve marketing team](https://vercel.com/templates/eve/eve-marketing-team)
- [eve personal agent](https://vercel.com/templates/nuxt/eve-personal-agent)
- [All eve templates](https://vercel.com/templates/eve)
