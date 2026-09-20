# Setup and Deployment

This guide covers the database-free starter, local development, long-term memory, the production persistence upgrade, Sign in with Vercel, and optional connections.

## Prerequisites

- Node.js 24 or newer
- pnpm through Corepack
- An Anthropic API key

```bash
corepack enable
pnpm install
```

Everything below runs against files and connection strings. No hosting provider is required until you deploy, and any Node 24 host will do.

## One-Shot Setup

```bash
./scripts/setup.sh
```

The script installs dependencies, creates `.env.local` from `.env.example`, and generates `EVE_CHAT_PASSWORD`, `BETTER_AUTH_SECRET`, and a local `BETTER_AUTH_URL`. It runs migrations when `DATABASE_URL` is set and otherwise leaves the starter in browser-storage mode.

Add your key afterwards:

```bash
ANTHROPIC_API_KEY=
```

`agent/agent.ts` calls Anthropic directly with that key. No gateway sits between the app and the model.

## Starter Mode

Starter mode needs one variable beyond the model key:

```bash
EVE_CHAT_PASSWORD=
```

Use a strong value; 16+ characters are recommended. The app exchanges it for a secure, HTTP-only session cookie. Chats and eve session cursors are stored in the current browser's localStorage, so history does not follow the user to another browser.

Starter mode is for one trusted operator. Everyone who knows the password shares
the same eve principal and any user-scoped connection grants. Upgrade to
production mode before giving independent users access.

If `EVE_CHAT_PASSWORD` is absent and the full production environment is not configured, the deployment fails closed and does not allow chat requests.

## Long-Term Memory

`agent/memory/profile.ts` gives the agent a small, model-maintained document of durable facts and preferences per eve principal. In starter mode every password holder shares one document; in production mode each signed-in user has their own. Memory is optional in every mode.

eve stores memory documents in the local data directory, so memory works with no configuration wherever the filesystem persists across restarts. Set `EVE_DATA_DIR` to move that directory; back it up like any other application data.

Vercel's filesystem is not durable, so a Vercel deployment needs a Blob store instead. The memory slot stays disabled, and the agent has no memory tools, until one is connected:

```bash
pnpm exec eve integration setup file-memory --yes
```

That command creates or reuses a private Vercel Blob store and pulls the `EVE_MEMORY_BLOB_*` environment variables into `.env.local`. Blob usage may incur charges. Redeploy after running it; environment changes apply to new deployments only.

This template enables Blob-backed memory only from the `EVE_MEMORY_BLOB_*` variables. A store you attach manually with the generic `BLOB_*` variables is ignored, so memory never takes over an application's own Blob store.

## Production Persistence Upgrade

Configure a database, a Redis, and Sign in with Vercel to switch the same codebase into production mode. Production mode uses per-user identity, per-user long-term memory, database-backed per-user history, and distributed rate limiting.

```bash
# Any Postgres.
DATABASE_URL=postgresql://user:password@localhost:5432/eve_chat
BETTER_AUTH_SECRET=
NEXT_PUBLIC_VERCEL_APP_CLIENT_ID=
VERCEL_APP_CLIENT_SECRET=
# Any Redis.
REDIS_URL=redis://localhost:6379
```

Once all production environment variables are present, production mode takes precedence over `EVE_CHAT_PASSWORD`. Run migrations after the first production deployment.

## Database

`DATABASE_URL` is an ordinary Postgres connection string. The app talks to it over the standard wire protocol through `postgres`, so a container on your laptop, a database on the same host, and a managed Postgres all work the same way.

For a local database:

```bash
docker run -d --name eve-chat-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:18
```

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

In production, set `DATABASE_URL` in your host's encrypted environment variables and make sure the database is reachable from wherever the app runs.

## Redis

`REDIS_URL` is an ordinary Redis connection string, and rate limiting is its only consumer. When it is unset, rate limiting is skipped.

For a local instance:

```bash
docker run -d --name eve-chat-redis -p 6379:6379 redis:8
```

```bash
REDIS_URL=redis://localhost:6379
```

## Better Auth Secret

Generate a production-safe secret:

```bash
openssl rand -base64 32
```

```bash
BETTER_AUTH_SECRET=<generated-secret>
```

Set the same value in your host's environment. `./scripts/setup.sh` generates one for local development.

## Sign in with Vercel

Sign in with Vercel is the identity provider this template wires up, and production mode requires it regardless of where the app is hosted. Create a Vercel App / OAuth client for the account or team that owns the project, starting with the [Sign in with Vercel prerequisites](https://vercel.com/docs/sign-in-with-vercel/getting-started#prerequisites).

Required scopes:

```text
openid
email
profile
```

In the Vercel App dashboard UI, open the app's scopes/permissions settings and toggle all three scopes on. These are Vercel App permissions, not environment variables.

The email scope is mandatory. Without it, Better Auth redirects to:

```text
/auth/error?error=email_not_found
```

Add callback URLs for every origin you will use:

```text
http://localhost:3000/api/auth/callback/vercel
http://localhost:3001/api/auth/callback/vercel
https://<your-production-domain>/api/auth/callback/vercel
```

Use the `3001` callback only if you run local dev on port 3001.

Copy the Vercel App client ID and client secret into your environment:

```bash
NEXT_PUBLIC_VERCEL_APP_CLIENT_ID=<client-id>
VERCEL_APP_CLIENT_SECRET=<client-secret>
```

`NEXT_PUBLIC_VERCEL_APP_CLIENT_ID` is intentionally public. `VERCEL_APP_CLIENT_SECRET` and `BETTER_AUTH_SECRET` must stay secret.

To swap in a different provider, replace the `vercel` entry in `socialProviders` in `lib/auth.ts` with any [Better Auth social provider](https://better-auth.com/docs/concepts/oauth) and update the sign-in button copy.

## App URL

The app derives the auth origin in this order:

```text
BETTER_AUTH_URL -> VERCEL_PROJECT_PRODUCTION_URL -> VERCEL_URL -> http://localhost:3000
```

Set `BETTER_AUTH_URL` to your public origin on any host other than Vercel, and whenever you use a custom domain:

```bash
BETTER_AUTH_URL=https://<your-production-domain>
```

`VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` are Vercel system env vars that are simply absent elsewhere.

## Database Migrations

Run migrations after the first deployment and after any schema change, with `DATABASE_URL` pointed at the target database:

```bash
set -a
source .env.local
set +a
pnpm db:migrate
```

For local prototyping only, you can use:

```bash
set -a
source .env.local
set +a
pnpm db:push
```

To migrate production, export the production `DATABASE_URL` in the same shell and run `pnpm db:migrate`.

## Run Locally

Start the app:

```bash
pnpm dev
```

Or run it on port 3001:

```bash
PORT=3001 pnpm dev -p 3001
```

Open the matching local URL and make sure the Vercel App contains the same callback URL.

## Optional Integrations

Slack, Notion, Linear, and Sentry are optional. Each one reads a token from the environment, so setting up an integration means issuing a token in that service and adding one variable.

```bash
# Slack channel, from your own Slack app.
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# MCP connections.
NOTION_API_KEY=
LINEAR_API_KEY=
SENTRY_AUTH_TOKEN=
```

For Slack, create an app at [api.slack.com/apps](https://api.slack.com/apps), add the `app_mentions:read`, `chat:write`, and `im:history` bot scopes, install it to your workspace, and point Event Subscriptions at `https://<your-production-domain>/eve/v1/slack`. `SLACK_BOT_TOKEN` is the Bot User OAuth Token; `SLACK_SIGNING_SECRET` is the Signing Secret, which the channel uses to verify that inbound webhooks really came from Slack.

For Notion, Linear, and Sentry, issue an API token in that service and set the matching variable. Each token is sent as a bearer token to that service's MCP endpoint and nowhere else.

The composer only shows its connections menu when at least one MCP token is configured. A password-only starter deployment omits the menu and tells eve that no external connections are available.

## Deploy

Build locally before deploying:

```bash
pnpm build
```

Deploy the `.next` output with any Node 24 host. Set `ANTHROPIC_API_KEY`, `EVE_CHAT_PASSWORD` or the full production set, and `BETTER_AUTH_URL` in that host's environment, then redeploy after any environment change.

To deploy to Vercel:

```bash
pnpm dlx vercel@latest --prod
```

## Troubleshooting

If chat is disabled and says setup is required, check the tooltip. Missing migrations will show as `database migrations`; run `pnpm db:migrate` with the production `DATABASE_URL` exported.

If sign-in redirects to `/auth/error?error=email_not_found`, enable the email scope in your Vercel App. See [Sign in with Vercel scopes](https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions).

If sign-in redirects to `/auth/error?error=invalid_scope`, make sure the Vercel App has `openid`, `email`, and `profile` enabled.

If sign-in redirects to an auth error after the OAuth consent screen, confirm that the callback URL exactly matches your browser origin, including port and `/api/auth/callback/vercel`.

If `pnpm db:migrate` says `DATABASE_URL` is missing, export it in the same shell first: Drizzle reads the process environment, not `.env.local`.

If rate limiting is reported as unconfigured, set `REDIS_URL` and restart.

If Notion tool calls fail, confirm that `NOTION_API_KEY` is set in the environment the agent runs in and that the token is still valid in Notion.

## Useful Links

- [eve documentation](https://eve.dev/docs)
- [Better Auth social providers](https://better-auth.com/docs/concepts/oauth)
- [Sign in with Vercel prerequisites](https://vercel.com/docs/sign-in-with-vercel/getting-started#prerequisites)
- [Sign in with Vercel scopes](https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions)
