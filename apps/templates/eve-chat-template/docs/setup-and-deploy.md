# Setup and Deployment

This guide covers the database-free starter, local development, long-term memory, the production persistence upgrade, account sign-in, and optional connections.

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

Configure a database, a Redis, and a Better Auth secret to switch the same codebase into production mode. Production mode uses per-user identity, per-user long-term memory, database-backed per-user history, and distributed rate limiting.

```bash
# Any Postgres.
DATABASE_URL=postgresql://user:password@localhost:5432/eve_chat
# openssl rand -base64 32
BETTER_AUTH_SECRET=
# Any Redis.
REDIS_URL=redis://localhost:6379
```

Those three variables are the whole requirement. Sign-in is email and password, so production mode needs no account with any other service.

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

`BETTER_AUTH_SECRET` has no default value. It signs session cookies and salts stored password hashes, so production mode raises an error instead of falling back to a shared constant when it is missing.

## Accounts and Sign-In

Production mode signs people in with an email address and a password. Better Auth owns the credential flow end to end: it hashes the password with its own implementation, stores the hash in the `account` table, and issues the session cookie. No third-party account is involved.

Passwords must be at least 12 characters. Signing up creates the account and signs that person in; there is no email verification step, so the template needs no outbound mail service.

`POST /api/auth/sign-in/email` and `POST /api/auth/sign-up/email` are rate limited per client address through the same Redis limiter the chat actions use, before any database work happens.

Anyone who can reach a production deployment can create an account. Put the deployment behind your own network controls, or stay in starter mode, when it is meant for a single operator.

## Optional Social Sign-In

A social provider adds one button below the email and password form. It is off by default, and with no provider configured that button does not render at all.

```bash
AUTH_SOCIAL_PROVIDER=github
AUTH_SOCIAL_CLIENT_ID=<client-id>
AUTH_SOCIAL_CLIENT_SECRET=<client-secret>
```

`AUTH_SOCIAL_PROVIDER` accepts `discord`, `github`, `gitlab`, `google`, `microsoft`, or `vercel`. Set all three variables or none: a provider without both credentials logs a warning and leaves social sign-in off.

Create the OAuth app in that provider's own dashboard, grant it whatever scope returns the user's email address, and add a callback URL for every origin you use:

```text
http://localhost:3000/api/auth/callback/<provider>
https://<your-production-domain>/api/auth/callback/<provider>
```

Sign-in redirects to `/auth/error?error=email_not_found` when the provider returns no email address, because Better Auth needs one to create the account.

To use a Better Auth provider that is not in the list above, add its id and display name to `SOCIAL_PROVIDER_LABELS` in `lib/social-provider.ts`.

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

Open the matching local URL. If you configured a social provider, make sure its OAuth app lists the same callback URL.

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

If sign-in redirects to `/auth/error?error=auth_env_missing`, set `BETTER_AUTH_SECRET` and restart.

If a sign-in attempt answers with `Too many attempts`, the credential rate limit is doing its job; wait for the window to pass or raise the limit in `app/api/auth/[...all]/route.ts`.

If social sign-in redirects to `/auth/error?error=email_not_found` or `error=invalid_scope`, grant the OAuth app the scope that returns the user's email address.

If social sign-in redirects to an auth error after the provider's consent screen, confirm that the callback URL exactly matches your browser origin, including port and `/api/auth/callback/<provider>`.

If `pnpm db:migrate` says `DATABASE_URL` is missing, export it in the same shell first: Drizzle reads the process environment, not `.env.local`.

If rate limiting is reported as unconfigured, set `REDIS_URL` and restart.

If Notion tool calls fail, confirm that `NOTION_API_KEY` is set in the environment the agent runs in and that the token is still valid in Notion.

## Useful Links

- [eve documentation](https://eve.dev/docs)
- [Better Auth email and password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth social providers](https://better-auth.com/docs/concepts/oauth)
