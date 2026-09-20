# Slack setup

The agent reads its Slack credentials from the environment. Nothing else is
required, and no hosting provider is involved.

## Slack app

Create a Slack app with:

- Bot scopes: `app_mentions:read`, `chat:write`, `im:history`, `files:read`.
- Event subscriptions: `app_mention`, `message.im`.
- Request URL: `https://<production-domain>/eve/v1/slack`.
- Interactivity & Shortcuts request URL: the same `/eve/v1/slack` URL.

Install the app to the workspace, then set these environment variables
wherever the agent runs:

```text
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

`SLACK_BOT_TOKEN` is the **Bot User OAuth Token** under OAuth & Permissions.
`SLACK_SIGNING_SECRET` is the **Signing Secret** under Basic Information; the
channel uses it to verify that inbound webhooks really came from Slack.

Locally, put both in `.env.local` (copy `.env.example`). In production, set
them in your host's encrypted environment variables.

## Verify

After deploying, point the setup check at the running agent:

```bash
pnpm run setup --url https://<production-domain>
```

It confirms `/eve/v1/health` reports ready and that an unsigned POST to
`/eve/v1/slack` is rejected with `401 unauthorized`.

The bot responds to DMs and channel messages that explicitly mention it. It
does not continue ambient thread conversation.
