# eve Chat Template

A Next.js chat template for [eve](https://eve.dev) that starts with password access and browser-persisted chats, then upgrades to durable memory, Sign in with Vercel, any Postgres, and any Redis when you need a production multi-user application.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?demo-description=A%20persisted%20Next.js%20chat%20template%20for%20eve%2C%20built%20with%20shadcn%2Fui%2C%20Tailwind%20CSS%2C%20Streamdown%2C%20Better%20Auth%2C%20Drizzle%2C%20and%20Postgres.&demo-image=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2FYXYTquqpBmvVFbASdIvrC%2Fbb50d21ba7866882d90e25d842b6fc02%2Feve-chat-no-bg.png&demo-title=eve%20Chat%20Template&demo-url=https%3A%2F%2Fchat.eve.dev&env=ANTHROPIC_API_KEY%2CEVE_CHAT_PASSWORD&envDescription=Your%20Anthropic%20API%20key%2C%20plus%20a%20strong%20password%20to%20protect%20your%20agent%20%2816%2B%20characters%20recommended%29.&envLink=https%3A%2F%2Fgithub.com%2Fvercel%2Feve%2Fblob%2Fmain%2Fapps%2Ftemplates%2Feve-chat-template%2Fdocs%2Fsetup-and-deploy.md&from=templates&project-name=eve%20Chat%20Template&repository-name=eve-chat-template&repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Feve%2Ftree%2Fmain%2Fapps%2Ftemplates%2Feve-chat-template)

## Quick Start

Run the starter with no database and no other services:

```bash
./scripts/setup.sh
pnpm dev
```

The script installs dependencies, creates `.env.local`, and generates a password
and Better Auth secret. Add your `ANTHROPIC_API_KEY`, then open the app and enter
the generated `EVE_CHAT_PASSWORD`.

Chats and eve session cursors are stored in that browser. They are not shared across browsers or users. Long-term memory lives in the local data directory; a Vercel deployment needs Blob storage instead, because its filesystem is not durable. See [Long-Term Memory](docs/setup-and-deploy.md#long-term-memory).

Starter mode is intended for one trusted operator: anyone with the password
shares the same agent identity and connection grants.

## Deployment Modes

| Mode              | Selected when                                                                     | Authentication                            | Chat persistence     | Long-term memory     |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------- | -------------------- | -------------------- |
| Starter           | `EVE_CHAT_PASSWORD` is configured                                                 | Shared password and secure session cookie | Browser localStorage | Shared, one document |
| Production        | `DATABASE_URL`, `REDIS_URL`, and all Sign in with Vercel variables are configured | Sign in with Vercel                       | Postgres             | Per-user document    |
| Local development | Neither mode is configured and `next dev` is running locally                      | Local development identity                | Browser localStorage | Process-local        |

Production mode takes precedence when its complete environment is present. The app fails closed in a production deployment when neither mode is configured. See [Setup and Deployment](docs/setup-and-deploy.md) for the upgrade path.

## Getting Started

For the starter and production setup flows, see [Setup and Deployment](docs/setup-and-deploy.md). For the runtime architecture, streaming model, persistence flow, and extension points, see [How the Chatbot Works](docs/how-the-chatbot-works.md).

Install dependencies with pnpm:

```bash
pnpm install
```

Run locally without additional services:

```bash
pnpm dev
```

To require the same password locally, put this in `.env.local`:

```bash
EVE_CHAT_PASSWORD=<at-least-16-characters>
```

Production mode requires:

```bash
# Any Postgres, for example postgresql://user:password@localhost:5432/eve_chat
DATABASE_URL=
BETTER_AUTH_SECRET=
NEXT_PUBLIC_VERCEL_APP_CLIENT_ID=
VERCEL_APP_CLIENT_SECRET=
# Any Redis, for example redis://localhost:6379
REDIS_URL=
```

`DATABASE_URL` and `REDIS_URL` take an ordinary connection string, so a container on
your laptop, a managed service, or a database on the same host all work the same way.
`NEXT_PUBLIC_VERCEL_APP_CLIENT_ID` and `VERCEL_APP_CLIENT_SECRET` come from a Vercel
OAuth app; Sign in with Vercel is the only identity provider this template wires up.

Other optional environment variables:

```bash
# Override the app origin for custom production domains.
BETTER_AUTH_URL=

# Slack channel, from your own Slack app.
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# MCP integrations, each an API token issued by that service.
LINEAR_API_KEY=
NOTION_API_KEY=
SENTRY_AUTH_TOKEN=
```

The composer only shows its connections menu when at least one MCP token is configured. Password-only starter deployments therefore omit the menu and do not prompt eve to use unavailable connections.

Production mode only: create the database tables:

```bash
pnpm db:migrate
```

Start the development server:

```bash
pnpm dev
```

## What Is Included

- Text chat with an eve agent through same-origin `/eve/v1/*` routes
- Password access with browser-backed chat history by default
- Optional Better Auth sign-in with Vercel
- Optional Postgres-backed cross-device chat history
- Optional Redis rate limiting in production mode
- Optional long-term memory (per user in production mode)
- Drizzle schema and migrations for production mode under `lib/db`
- Saved eve session cursors and event snapshots in either storage mode
- Sidebar history with delete and new-chat actions
- Notion, Linear, and Sentry MCP connections, authenticated from the environment
- Slack channel route at `/eve/v1/slack`
- Composer-level connections menu
- First-message chat titles derived locally from the user's prompt
- Streamdown markdown rendering for assistant text and reasoning
- shadcn/Tailwind components for messages, tools, HITL prompts, and composer

This template intentionally does not include file uploads, guest mode, NextAuth/Auth.js, or AI Elements.

## Agent Code

Edit the agent in `agent/agent.ts`. Its behavior is defined in `agent/instructions.md`, tools live in `agent/tools/`, and `agent/memory/profile.ts` defines per-user long-term memory.

The browser talks to eve with `useEveAgent()` from `eve/react`; the app stores eve stream events and session state so `/chat/[id]` can resume the same durable conversation after refresh.
