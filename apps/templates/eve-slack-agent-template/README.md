This is a Slack agent template for [eve](https://eve.dev).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?demo-description=An%20eve%20template%20for%20Slack%20agents%20with%20webhook%20handling%2C%20a%20starter%20agent%2C%20and%20an%20example%20tool.%20Runs%20on%20any%20Node%20host.&demo-image=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F2mBY0MIfBcFytW99mnvinL%2Ffc3917c584ab1389af305788b8050f5d%2Fimage__1_.png&demo-title=eve%20Slack%20Agent&demo-url=https%3A%2F%2Fvercel.com%2Fkb%2Fguide%2Feve-slack-agent-starter&env=ANTHROPIC_API_KEY%2CSLACK_BOT_TOKEN%2CSLACK_SIGNING_SECRET&envDescription=Your%20Anthropic%20API%20key%2C%20plus%20the%20bot%20token%20and%20signing%20secret%20from%20your%20Slack%20app.&project-name=eve%20Slack%20Agent&repository-name=eve-slack-agent&repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Feve%2Ftree%2Fmain%2Fapps%2Ftemplates%2Feve-slack-agent-template)

## Getting Started

First, install dependencies and create your environment file:

```bash
pnpm install
cp .env.example .env.local
```

Fill in the three values. `ANTHROPIC_API_KEY` comes from the Anthropic console.
`SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` come from a Slack app you own:

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps).
2. Under **OAuth & Permissions**, add the `app_mentions:read`, `chat:write`,
   and `im:history` bot scopes, install the app to your workspace, and copy the
   **Bot User OAuth Token** into `SLACK_BOT_TOKEN`.
3. Under **Basic Information**, copy the **Signing Secret** into
   `SLACK_SIGNING_SECRET`.
4. Under **Event Subscriptions**, point the request URL at
   `https://<your-host>/eve/v1/slack` and subscribe to `app_mention` and
   `message.im`.

Then, run the development server:

```bash
pnpm dev
```

You can start editing the agent by modifying `agent/agent.ts`. Its behavior is defined in `agent/instructions.md`, and tools live in `agent/tools/`. The agent auto-updates as you edit the files.

This project uses the Eve framework's bundled guides — see `node_modules/eve/dist/docs/public/` after installing dependencies.

## Learn More

To learn more about eve, take a look at the following resources:

- [eve documentation](https://eve.dev/docs) - learn about eve features and API.
- [Slack apps](https://api.slack.com/apps) - where the bot token and signing secret this template reads come from.

You can check out [the eve GitHub repository](https://github.com/vercel/eve) - your feedback and contributions are welcome!

<img width="1552" height="1013" alt="Image Edit Request" src="https://github.com/user-attachments/assets/115c947d-1b7d-4464-8d57-91f2dd8758f0" />
