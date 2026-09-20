# Environment Variables

> Back to [README](../README.md) | See also: [Architecture](./ARCHITECTURE.md), [Customization](./CUSTOMIZATION.md)

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

## Quick start (minimum required)

| Variable              | How to get it                                                    |
| --------------------- | ---------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Create a key in the Anthropic console                            |
| `BETTER_AUTH_SECRET`  | Run `openssl rand -base64 32`                                    |
| `BETTER_AUTH_URL`     | `http://localhost:3000` locally, or your production URL          |
| `INTERNAL_API_SECRET` | Run `openssl rand -base64 32` (must match on web + eve services) |

These four variables are enough for local development. In production, set them on **both** the web and eve services — and add a database if the host has no durable filesystem (see below).

## Database

### `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (required without a durable filesystem)

NuxtHub (`hub.db: "sqlite"`) uses a SQLite file at `.data/db/sqlite.db`, so a VPS, container with a mounted volume, or any host with a persistent disk needs no configuration at all. On a serverless host that file cannot be created, and every request fails with:

```
Error: ConnectionFailed("Unable to open connection to local database .../.data/db/sqlite.db: 14")
```

There, point the app at any libSQL database:

```bash
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

NuxtHub reads them at **build time** and switches from the local file to the remote database, so rebuild after adding them. Then apply the schema with the same variables exported:

```bash
pnpm db:migrate
```

### `NUXT_PUBLIC_SITE_URL` (optional)

Canonical URL for SEO — used for Open Graph images, Twitter cards, and canonical links. Set to your production URL (e.g. `https://agent.example.com`). Falls back to the request origin when unset.

## Authentication

### `BETTER_AUTH_SECRET` (required)

Random secret used by [Better Auth](https://www.better-auth.com/docs/installation#set-environment-variables) to sign sessions and tokens.

```bash
openssl rand -base64 32
```

### `BETTER_AUTH_URL` (required)

Public URL of the Nuxt app. Used for auth callbacks and as the base URL for agent → Nuxt internal API calls.

| Environment | Value                         |
| ----------- | ----------------------------- |
| Local       | `http://localhost:3000`       |
| Production  | `https://your-domain.example` |

## Internal API

### `INTERNAL_API_SECRET` (required)

Shared bearer token between the Eve agent service and the Nuxt internal API (`/api/internal/*`).

Used for:

- Memory read/write from the agent
- Slack account linking
- Sendblue / iMessage phone linking lookup

**Must be identical** on both services (web and eve). If missing or mismatched, memory injection, Slack linking, and iMessage auth will fail silently or return 401.

## Sendblue (iMessage, optional)

Reach the agent over iMessage via [Sendblue](https://chat-sdk.dev/adapters/vendor-official/sendblue). Set these on the **eve** service (and `BETTER_AUTH_URL` on both services so the agent can resolve phone links):

| Variable                       | Required | Description                                                                             |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `SENDBLUE_API_KEY`             | Yes      | API key ID from the [Sendblue dashboard](https://dashboard.sendblue.com)                |
| `SENDBLUE_API_SECRET`          | Yes      | API secret key                                                                          |
| `SENDBLUE_FROM_NUMBER`         | Yes      | Your Sendblue line in E.164 format (e.g. `+15551234567`)                                |
| `SENDBLUE_WEBHOOK_SECRET`      | Yes      | Shared secret verified via the `sb-signing-secret` header                               |
| `SENDBLUE_STATUS_CALLBACK_URL` | No       | Delivery status callbacks for outbound messages                                         |
| `SENDBLUE_ALLOWED_SERVICES`    | No       | Comma-separated list; defaults to `iMessage` only. Use `iMessage,SMS,RCS` to accept all |

Setup:

1. Create a Sendblue account and note your API credentials and assigned number (`sendblue show-keys`, `sendblue lines`).
2. Set the env vars above on the **eve** service.
3. Configure the Sendblue **receive webhook** to:

   `https://<your-domain>/eve/v1/sendblue/webhook`

4. Users add their personal phone number (E.164) in **Settings → Profile** before messaging the Sendblue number.

See [Customization](./CUSTOMIZATION.md#sendblue-imessage) for the full linking flow.

## AI provider

### `ANTHROPIC_API_KEY` (required)

[`agent/agent.ts`](../agent/agent.ts) calls Anthropic directly:

```typescript
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default defineAgent({ model: anthropic("claude-sonnet-4.6") });
```

The provider talks to the Anthropic API with no gateway in between. To use OpenAI instead, swap `createAnthropic` from `@ai-sdk/anthropic` for `createOpenAI` from `@ai-sdk/openai`, call `openai.responses("<model>")`, and set `OPENAI_API_KEY`.

## Slack (optional)

| Variable               | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`      | "Bot User OAuth Token" under OAuth & Permissions                  |
| `SLACK_SIGNING_SECRET` | "Signing Secret" under Basic Information; verifies inbound events |

Create an app at [api.slack.com/apps](https://api.slack.com/apps), add the `app_mentions:read`, `chat:write`, `im:history`, and `users:read.email` bot scopes, install it to your workspace, and point Event Subscriptions at `https://<your-domain>/eve/v1/slack`. Set both variables on the **eve** service.

## Integrations (optional)

| Variable         | Service | Where to get it                                  |
| ---------------- | ------- | ------------------------------------------------ |
| `LINEAR_API_KEY` | Linear  | Linear → Settings → Security & access → API keys |
| `GITHUB_TOKEN`   | GitHub  | GitHub → Settings → Developer settings → Tokens  |

Each token is shared by every signed-in user, so the agent acts as one service
account against that service. Grant only the scopes the agent needs: `repo` is
enough for the GitHub tools.

Set them on the **eve** service so the agent can use the tools, and on the web
service so **Settings → Integrations** can show status and run its test. A row
reports "Setup required" with the variable name until the token is present;
restart the app after adding one.

## GitHub (optional)

GitHub tools load at `session.started` when `GITHUB_TOKEN` is set. Start a new chat session after adding it.

## Local-only files

These paths are gitignored and should never be committed:

| Path     | Purpose                   |
| -------- | ------------------------- |
| `.env`   | Local secrets             |
| `.data/` | SQLite database (NuxtHub) |
| `.eve/`  | Eve dev cache             |

Reset the local database:

```bash
rm -rf .data/db && pnpm db:migrate
```
