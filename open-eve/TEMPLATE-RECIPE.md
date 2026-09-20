# De-Vercelizing a template

The recipe every template in `apps/templates/` follows for Task 13. Each
template is independent, so this exists to stop twelve people inventing twelve
slightly different answers to the same four questions.

Read `open-eve/PLAN.md` "Global Constraints" first. Nothing here overrides it.

## The measured couplings

| Coupling                                      | Templates affected                             |
| --------------------------------------------- | ---------------------------------------------- |
| `@vercel/connect`                             | 10 of 12                                       |
| `@vercel/blob`                                | 6 of 12                                        |
| AI Gateway model slugs                        | 11 of 12, ~20 occurrences                      |
| `@vercel/analytics`, `@vercel/speed-insights` | `eve-chat-template`, `personal-agent-template` |
| Neon Postgres, Upstash Redis                  | `eve-chat-template` only                       |

`mux-video-agent` carries none of these and needs no change.

## 1. Connections: `connect()` becomes an environment token

The canonical portable form is whatever `eve init` now generates, in
`packages/eve/src/setup/scaffold/update/connections.ts:76-86`. Match it exactly
rather than inventing a variant.

```ts
// before
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  auth: connect(process.env.NOTION_CONNECTOR ?? "notion/social-media-agent"),
  // …
});

// after
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  auth: { getToken: async () => ({ token: process.env.NOTION_API_KEY! }) },
  // …
});
```

Delete the connector-UID constant and its TSDoc along with the import. Keep
every approval policy, `tools.allow` list, and description exactly as it was:
those encode security decisions that have nothing to do with hosting.

Add the new variable to `.env.example` with an empty value, and remove the
`<X>_CONNECTOR` entry.

## 2. Channels: drop the `credentials` argument

Vercel Connect brokered both the outbound token and inbound webhook
verification. eve's channels already read the same pair from the environment
when no `credentials` is passed, which is what `eve init`'s portable branch
generates.

```ts
// before
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

export default slackChannel({
  credentials: connectSlackCredentials(process.env.SLACK_CONNECTOR ?? "slack/agent"),
});

// after
import { slackChannel } from "eve/channels/slack";

export default slackChannel();
```

Environment variables per channel, matching what Task 8's portable branch
writes:

| channel | variables                                                                             |
| ------- | ------------------------------------------------------------------------------------- |
| slack   | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`                                             |
| discord | `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`                   |
| github  | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `GITHUB_WEBHOOK_SECRET` |
| linear  | `LINEAR_AGENT_ACCESS_TOKEN`, `LINEAR_WEBHOOK_SECRET`                                  |
| teams   | `MICROSOFT_APP_ID`, `MICROSOFT_APP_PASSWORD`, `MICROSOFT_TENANT_ID`                   |

Rewrite the TSDoc that explains Connect brokering. Leaving it in place is worse
than deleting it: it tells the next reader to go set up a connector that the
code no longer uses.

## 3. Blob storage: the local data directory

`@vercel/blob` backs two different things in these templates, and they need
different answers.

**Memory documents** (`fileMemory`) need no change at all. `sqlite()` is
already the default off Vercel, so deleting an explicit `vercelBlob()` backend
is enough.

**Asset tools** (`upload_asset`, `get_asset_info`, `delete_asset`, and the
per-principal preference files) store arbitrary blobs and need real storage.
Write them under the same directory the rest of open-eve's durable state uses:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataDirectory = () => process.env.EVE_DATA_DIR?.trim() || join(process.cwd(), "data");
const assetPath = (key: string) => join(dataDirectory(), "assets", key);
```

Four properties of the Blob version are load-bearing and must survive:

- **Reserved prefixes.** The general asset tools refuse keys under the
  brand-context, preferences, and artifact prefixes, so none can be used as a
  side channel. Keep that check.
- **Anchored key validation.** Artifact ids come from the model, so they are
  matched against an anchored pattern before a path is built. Under a
  filesystem this matters _more_ than it did under Blob: an unvalidated key is
  now a path traversal. Reject any key that is not the anchored shape, and
  never `join` a model-supplied string without that check.
- **Not-found and invalid are indistinguishable.** Both return `found: false`,
  so a probe learns nothing from the difference.
- **`download_asset` only fetched `*.blob.vercel-storage.com`.** The local
  equivalent reads from the assets directory and fetches nothing. If a template
  keeps a URL-fetching tool, it needs its own allowlist — an unrestricted
  server-side fetch on a user-supplied URL is an SSRF.

## 4. Models: a direct provider, not a gateway slug

A bare `provider/model` string routes through Vercel AI Gateway. This is true
even with a BYOK provider key: the key is passed to the gateway's `byok` block,
so the request still transits Vercel. A slug is a Vercel dependency.

**Check the `eve` version the template pins before using `eve/models/*`.**
`eve/models/anthropic` first shipped in eve 0.57.0. At older pins,
`eve/models/openai` exports only `chatgpt()` — a ChatGPT-subscription model
that explicitly fails in a deployment — and not the direct `openai()`. Several
templates pin 0.39 to 0.54. Where the pin is too old, use `@ai-sdk/anthropic`
and `@ai-sdk/openai` directly. Do not bump the template's `eve` version to
reach the nicer form: that drags in documented breaking changes to the
instrumentation API and `defineWorkflowTool`.

Where the pin is 0.57.0 or newer, eve ships direct providers for two:

```ts
// before
export default defineAgent({ model: "anthropic/claude-opus-5" });

// after
import { anthropic } from "eve/models/anthropic";

export default defineAgent({ model: anthropic("claude-opus-5") });
```

`anthropic()` reads `ANTHROPIC_API_KEY`; `openai()` from `eve/models/openai`
reads `OPENAI_API_KEY`. Neither touches a gateway.

**There is no direct export for `xai`, `moonshotai`, or `google`.** Those three
appear in `eve-llm-council-template` and `eve-software-factory-template`'s eval
config. Use an OpenAI-compatible provider with an explicit `baseURL`:

```ts
import { createOpenAI } from "@ai-sdk/openai";

const xai = createOpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });

export default defineAgent({ model: xai.chat("grok-4.5") });
```

**`.chat(...)`, not the bare callable.** `createOpenAI(...)(id)` resolves to the
Responses API — its type is `(modelId: OpenAIResponsesModelId)` — so
`xai("grok-4.5")` POSTs to `/responses`, which OpenAI-compatible providers do
not implement. Only native OpenAI uses `.responses(...)`, which is what eve's
own `openai()` does.

Endpoints confirmed against primary documentation:

| provider      | baseURL                                                    |
| ------------- | ---------------------------------------------------------- |
| xAI           | `https://api.x.ai/v1`                                      |
| Moonshot AI   | `https://api.moonshot.ai/v1`                               |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` |

That adds `@ai-sdk/openai` to the template's dependencies, which is fine —
templates are applications, not the framework.

## 4b. When a service has no portable credential at all

Some services cannot be ported, and inventing an environment variable for them
is worse than removing them. `https://mcp.vercel.com` is the worked example:
it is OAuth-only and, per Vercel's documentation, "only supports AI clients
that have been reviewed and approved by Vercel". There is no bearer token to
point an env var at.

Delete the connection, its connector variable, and every README reference,
and state the capability loss in your report. Do not write a `getToken` that
reads a variable the service will never accept.

## 4c. The two couplings a `@vercel/` grep does not find

Both of these are eve exports rather than npm packages, so
`grep -rn "@vercel/"` returns clean while the template still depends on Vercel.
Check for them by name.

**`vercel()` in `agent/sandbox.ts`** is Vercel Sandbox, a paid hosted service.
Replace it with `docker({ networkPolicy: "deny-all" })` from
`eve/sandbox/docker`, which exists as far back as eve 0.11. The new cost to the
user is a running Docker daemon, so say so in the README.

**`vercelOidc()` in `agent/channels/eve.ts`** is easy to misread as an inert
opt-in. It is not. Off Vercel it never matches, so if it is the only production
verifier in the list the HTTP API has no way to authenticate a real request and
the route is unusable. Register HTTP Basic instead, and only when the password
is actually set:

```ts
const auth: AuthFn<Request>[] = [localDev()];
const apiPassword = process.env.EVE_API_PASSWORD;
if (apiPassword) {
  auth.push(httpBasic({ password: apiPassword, username: process.env.EVE_API_USERNAME ?? "eve" }));
}
```

Do not write `httpBasic({ password: process.env.EVE_API_PASSWORD ?? "" })`.
That accepts `Basic base64("eve:")` and fails open.

Leave `vercelOidc()` alone only where another verifier already covers
production, such as a template with its own application session.

## 4d. Pin the AI SDK packages exactly

`@ai-sdk/anthropic` and `@ai-sdk/openai` pin `@ai-sdk/provider` exactly, and so
does `ai`. A caret range on the provider packages installs two copies of
`@ai-sdk/provider`, and `tsc` then rejects the `model:` field with
`TS2322: Type 'LanguageModelV4' is not assignable to type
'PublicAgentStaticModelDefinition'`.

For a template on `ai@7.0.70`, the newest working pair is
`@ai-sdk/anthropic@4.0.41` and `@ai-sdk/openai@4.0.45`, which share that
release's `@ai-sdk/provider@4.0.7`. Pin exactly, and record the constraint in
the template's AGENTS.md so a later caret does not silently reintroduce it.

Installing the template and running `pnpm typecheck` against its real pinned
`eve` is what catches this. It is worth doing.

## 5. Analytics

`@vercel/analytics` and `@vercel/speed-insights` send page telemetry to Vercel
from the browser. Remove the packages and their components. Nothing replaces
them: a template should not ship third-party telemetry by default, and a user
who wants it can add it.

## 6. `eve-chat-template` only: Neon and Upstash

Both are network services with ordinary local equivalents, and both are already
reached through a URL, so this is configuration rather than code.

- Neon Postgres → `POSTGRES_URL` pointing at any Postgres. Keep the driver if
  it speaks the wire protocol; swap it for `postgres` if it is Neon-specific.
- Upstash Redis → a plain Redis client against `REDIS_URL`. The rate limiter is
  the only consumer.

Document both in the template's README as "any Postgres" and "any Redis", not
as a hosted product.

## Finishing a template

1. Remove the now-unused `@vercel/*` entries from `package.json`.
2. `.env.example` lists every new variable, empty, with a one-line comment.
3. The README no longer instructs the reader to create a Vercel connector or
   Blob store.
4. `pnpm guard:invariants` passes. Rule 13 (no spread-ternary object
   composition) has already been tripped twice by template code.
5. `pnpm lint` reports no new warnings from files you touched.
6. `grep -rn "@vercel/" <template>` returns nothing outside `pnpm-lock.yaml`.
   Lockfile hits are expected and usually cannot be removed: `eve` declares
   `@vercel/blob` as an optional peer and `@github-tools/sdk` declares
   `@vercel/connect`, and pnpm's `autoInstallPeers` resolves both. What matters
   is that the `importers:` section declares neither. Regenerating a lockfile to
   chase the rest churns unrelated dependencies, which is the worse trade.
7. `.env.example` is actually committed. Several templates have `.env*` in
   `.gitignore` with no `!.env.example` negation, so a new one is silently
   ignored. Add the negation.
8. Grep for the two couplings in section 4c by name, since they do not contain
   the string `@vercel/`.
