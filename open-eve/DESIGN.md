# open-eve — design

**Status:** proposed
**Last updated:** 2026-09-20
**Upstream:** [vercel/eve](https://github.com/vercel/eve) (Apache-2.0)

## Summary

open-eve is a fork of eve that runs with zero Vercel dependency. Every default
is local: a user can clone a project, run it on a bare VPS, and no data leaves
the machine. Vercel remains available as an explicit opt-in, so the fork is a
superset of upstream behavior rather than a subtraction from it.

The fork is a real GitHub fork of `vercel/eve`. Upstream changes are merged on a
branch and landed as PRs. Minimizing merge conflict surface is a first-class
design constraint, not an afterthought.

Package name: `open-eve`. Binary: `openeve`.

## Goals

1. `openeve build && openeve start` runs on any Node host with no `@vercel/*`
   package in the runtime dependency tree.
2. Every layer is pluggable, and the user declares the implementation in their
   own files. Defaults are local; alternatives are one config edit away.
3. A VPS deployment can run with no third-party service and no outbound calls
   beyond the model provider the user chose.
4. Upstream eve releases can be ported with a mechanical merge, not a rewrite.

## Non-goals

- Removing Vercel support. Vercel code stays in core, disabled by default.
- Reimplementing anything Vercel already open-sourced. The Workflow SDK
  (Apache-2.0) and Chat SDK (MIT) are used as-is.
- Matching Vercel Connect's zero-configuration OAuth. Users supply their own
  provider credentials, which is the cost of not routing through a broker.

## What upstream already solves

Investigation found that most of the stack is open source and host-neutral. The
fork's real work is much smaller than a naive audit suggests.

| Layer                    | eve on Vercel                         | Replacement                                         | License      | Work             |
| ------------------------ | ------------------------------------- | --------------------------------------------------- | ------------ | ---------------- |
| Durable execution        | `@workflow/world-vercel`              | `@workflow/world-local`, `@workflow/world-postgres` | Apache-2.0   | config           |
| Channels + provider auth | first-class channels + Vercel Connect | Chat SDK adapters via `chatSdkChannel`              | MIT          | rewire scaffolds |
| Channel state            | Vercel-managed                        | `state-pg`, `state-redis`, new `state-sqlite`       | MIT          | new adapter      |
| Sandbox                  | Vercel Sandbox                        | `docker()`, `microsandbox()`, `justbash()`          | ships in eve | none             |
| Model routing            | AI Gateway                            | AI SDK provider with `baseURL` override             | Apache-2.0   | init flow        |
| Route auth               | `vercelOidc()`                        | `oidc()`, `jwtEcdsa()`, `httpBasic()`               | ships in eve | none             |
| Tracing                  | Agent Runs                            | OTLP to any collector                               | ships in eve | none             |
| Scheduling               | Vercel Cron                           | Nitro scheduled tasks                               | ships in eve | none             |
| Deploy                   | `.vercel/output`                      | Nitro Node server                                   | ships in eve | gate it          |
| File memory              | Vercel Blob                           | new `sqlite()` and `s3()` backends                  | —            | new adapters     |
| Registry                 | `https://eve.dev/r`                   | own shadcn registry, static JSON                    | —            | fork it          |

Only three Vercel pieces are hosted services with no drop-in equivalent:
Sandbox, Blob, and AI Gateway. eve already ships replacements for two.

Critically, `@vercel/connect` is not privileged. It implements
`defineInteractiveAuthorization`, a public seam eve already exports. Chat SDK
adapters own their own provider auth and webhook verification, which is exactly
the role Connect plays for channels.

## Architecture

### Host provider switch

eve branches on `process.env.VERCEL` at 18 sites. These collapse into one
resolver.

```ts
// agent.ts — default, fully self-hosted
export default defineAgent({ model: /* ... */ });

// agent.ts — opt back into Vercel
import { vercel } from "open-eve/hosts/vercel";
export default defineAgent({ host: vercel() });
```

`host` compiles into the manifest, so build and runtime read the same value.
`resolveHostProvider()` returns `"self" | "vercel"`, defaulting to `"self"`.

Framework integrations (Next.js, Nuxt, SvelteKit) keep environment detection,
because they execute inside the host framework's config before eve compiles.
This is not a second mechanism: eve config governs eve, host environment governs
the host.

Each of the 18 sites becomes a one-line change, which keeps upstream merges
mechanical.

### Local-first data layout

All durable state lives under a single `data/` directory, so a VPS deployment
backs up one path and migrates with one `rsync`.

```text
data/
  openeve.db     SQLite — channel state, file memory, traces
  workflow/      @workflow/world-local run state
```

There is no separate credential store. Connection tokens are cached by the
authorization strategy that owns them, and Chat SDK adapters hold their own
provider credentials, so open-eve adds no credential storage of its own.

Node 26 ships `node:sqlite`, so SQLite adds **no runtime dependency**. This keeps
the fork aligned with eve's principle of holding `nitro` as the only runtime
dependency, while giving users one consolidated, portable store.

SQLite also buys atomic consistency a file tree cannot: `VACUUM INTO` snapshots
a live database without tearing, so backups and migrations are safe while the
agent is running.

The workflow world deliberately stays on upstream `world-local` rather than a
custom `world-sqlite`. A custom world would have to implement the full world
protocol — state, queues, hooks, streams — against the moving `5.0.0-beta` line,
and the runtime rejects version mismatches outright. Upstream bumps
`@workflow/*` frequently and independently, so owning a world would convert
every upstream release into a patch we must re-verify. Keeping `world-local`
holds fork-sync cost at zero, which is a stated project requirement. The cost is
that `data/` is one directory rather than one literal file.

### Layer options

Every layer is declared by the user. Defaults are local and require no signup.

**Sandbox** — `agent/sandbox.ts`. Default `docker()`. Alternatives
`microsandbox()`, `justbash()`, custom `SandboxBackend`, `vercel()` when gated
on. `defaultBackend()` resolves Docker, then microsandbox, then just-bash;
Vercel leaves the chain.

**Durable execution** — `agent.ts`. Default `@workflow/world-local` writing to
`data/workflow/`. Alternatives `@workflow/world-postgres` and any package
implementing the `5.0.0-beta` world protocol.

**File memory** — memory config. Default `sqlite()`, storing documents in
`data/openeve.db`. Alternatives `s3()` against MinIO, Garage, SeaweedFS, R2, or
B2 when documents are large or shared across nodes; `inMemory()` for tests;
`vercelBlob()` when gated on.

**Channels** — `agent/channels/*.ts`. Default is the eve HTTP channel alone.

Channels are deliberately not the headline. Most users drive the agent from
their own application over HTTP, so that path gets the polish budget and
channels remain opt-in.

eve's nine first-class channels are all retained: Slack, Discord, Teams, GitHub,
Linear, Telegram, Twilio, Linq, and Photon. Every one already supports portable
credentials through environment variables, and Telegram and Twilio never used
Vercel Connect at all. The fork only flips the scaffold default from Vercel
Connect to portable credentials, which preserves first-class behavior that a
generic adapter cannot express — Slack message hooks, Events API callbacks,
slash commands, and API calls made outside a handler.

Chat SDK adapters cover the surfaces eve does not ship first-class: Google Chat,
WhatsApp, Instagram, Messenger, X, Gmail, and Notion. There, the adapter owns
provider auth and webhook verification, and optional capabilities such as typing
indicators degrade gracefully when an adapter does not implement them.

**Model** — `agent.ts`. No default is written. `openeve init` detects a local
Ollama endpoint and offers it first, then a self-hosted LiteLLM proxy, then
direct providers. Local and proxy options are AI SDK providers with a `baseURL`
override rather than bespoke helpers:

```ts
import { createOpenAI } from "@ai-sdk/openai";

const local = createOpenAI({
  baseURL: "http://127.0.0.1:11434/v1",
  apiKey: "ollama",
});

export default defineAgent({ model: local("qwen3:8b") });
```

This covers Ollama, vLLM, llama.cpp, LM Studio, and LiteLLM with no new code.

**Route auth** — `agent/channels/eve.ts`. `localDev()` in development;
`httpBasic()`, `jwtHmac()`, `jwtEcdsa()`, `oidc()` against self-hosted Keycloak,
Zitadel, Authentik, or Ory, or a custom `AuthFn` in production.

**Tracing** — instrumentation config. Default local capture into
`data/openeve.db`, which makes trace history queryable with plain SQL.
Alternative OTLP export to self-hosted Jaeger, SigNoz, Grafana Tempo, Langfuse,
or Arize Phoenix.

**Connections and tools** — `defineMcpClientConnection`,
`defineOpenApiConnection`, and authored tools are the local default.
`composio()` is an opt-in third-party catalog and the one documented exception
to the no-egress rule.

### Channel state: two layers

Channel state is split across two stores, and only one of them can require a
database.

**eve's `channel.state`** holds thread identity and streaming bookkeeping. It is
ordinary eve durable state, so it is persisted by the configured workflow world:
`world-local` writes it under `data/workflow/`, `world-postgres` writes it to
Postgres. It introduces no dependency of its own.

**The Chat SDK `StateAdapter`** is separate, passed as `state:` to
`chatSdkChannel`. Its interface is eighteen methods over five concerns:
subscriptions, per-thread TTL locks, key/value with TTL, lists, and per-thread
queues. No SQL schema is exposed, so nothing about it implies a database.

| Adapter                        | Storage           | Survives restart | Multi-node | Dependency |
| ------------------------------ | ----------------- | ---------------- | ---------- | ---------- |
| `state-memory`                 | process memory    | no               | no         | none       |
| `state-sqlite` (new)           | `data/openeve.db` | yes              | no         | none       |
| `state-redis`, `state-ioredis` | Redis             | yes              | yes        | Redis      |
| `state-pg`                     | Postgres          | yes              | yes        | Postgres   |

`acquireLock(threadId, ttlMs)` is the only primitive with a genuine distribution
requirement: it serializes concurrent messages on one thread. SQLite implements
it correctly on a single node through an atomic conditional insert inside a
transaction, which is stronger than an advisory file lock. Across several nodes
behind a load balancer it does not hold, because each node has its own database
file, and two nodes would process the same thread concurrently.

The resulting rule is that open-eve has **no database dependency until a
deployment scales past one node**. That threshold is identical to the
`world-local` to `world-postgres` boundary, so both layers cross over together
and users face one upgrade decision rather than two.

### Registry

`eve add` installs shadcn-format items from `https://eve.dev/r`, generated from
`apps/docs/registry.json` and overridable through
`EVE_DEV_OFFICIAL_REGISTRY_URL`. open-eve publishes its own registry as static
JSON from the fork. No service is required, and users can point at a private
registry with `openeve registry add`.

## Work items

1. **SQLite store.** Shared `data/openeve.db` opened through `node:sqlite`, with
   schema setup and migration. Backs items 2, 4, and traces.
2. **`sqlite()` memory backend.** New default. Mirrors the existing
   `vercelBlob()` backend shape.
3. **`s3()` memory backend.** S3-compatible, covering MinIO, Garage, SeaweedFS,
   R2, and B2 with one adapter.
4. **`state-sqlite` Chat SDK adapter.** Eighteen `StateAdapter` methods over
   `data/openeve.db`, so channels survive restart with no external service.
5. **Host provider switch.** `host` field in `agent.ts`, `resolveHostProvider()`,
   and 18 one-line call-site changes. Defaults flip to `"self"`.
6. **Channel scaffold rewire.** Seven setup files emit Chat SDK adapter code
   instead of `@vercel/connect/eve` imports.
7. **`composio()` connection adapter.** Opt-in, rides
   `defineMcpClientConnection`.
8. **Gate the Vercel build path.** `@vercel/*` moves to optional dependencies;
   `openeve link` and `openeve deploy` only appear when the Vercel host is on.
9. **Rebrand.** `package.json` `name` becomes `open-eve` and `bin` exposes
   `openeve`, with `eve` retained for drop-in compatibility. **No file or
   directory is renamed** — see Upstream sync.
10. **Registry and templates.** Publish an open-eve registry as static shadcn
    JSON, and de-Vercelize all twelve templates. See Templates below.
11. **`openeve init` model flow.** Replace the AI Gateway model-ID default with
    provider detection and a `baseURL` prompt.
12. **Trace storage.** Move local trace capture into `data/openeve.db`.

## Templates

All twelve templates listed on eve.dev are vendored into `apps/templates/`, so
open-eve ships the same catalogue as upstream. Four were already there; the
other eight were cloned from `vercel-labs/*` and `muxinc/mux-video-agent` with
their `.git` removed. Seven are MIT; `mux-video-agent` declares no license.

They live in `apps/templates/` rather than a second top-level `templates/`
directory because that path is already the repository's vendored zone:
`pnpm-workspace.yaml` deliberately omits `apps/templates/*`, so templates are
not workspace members, and `.syncpackrc.json` excludes `!**/templates/**`.
Nothing existing was moved, so no rename was introduced.

De-Vercelizing them is one repeatable recipe:

| Coupling             | Templates affected | Replacement              |
| -------------------- | ------------------ | ------------------------ |
| `@vercel/connect`    | 7 of 8 external    | portable credentials     |
| `@vercel/blob`       | 6 of 8 external    | `sqlite()` or `s3()`     |
| AI Gateway model IDs | 16 occurrences     | provider plus `baseURL`  |
| Neon, Upstash Redis  | chat               | local Postgres and Redis |

`mux-video-agent` is already free of `@vercel/*`.

Third-party SaaS inside a template is acceptable and out of scope for the
no-egress rule: the Mux template needs Mux, the Sanity template needs Sanity.
The guarantee is that the framework carries no Vercel infrastructure
dependency, not that every example avoids all external products.

Vendored template code is held to eve's mechanical invariants because
`guard-invariants` walks the whole repository. Three templates tripped it on
import: a `CLAUDE.md` symlink in `eve-sre-agent-template`, and nine
spread-ternary object compositions in `marketing-team-eve-template` and
`mux-video-agent`. These were fixed in place rather than excluded from the
guard, keeping `scripts/` free of fork divergence. The symlink was replaced with
a real file containing `@AGENTS.md`, matching what this repository's own root
`CLAUDE.md` does.

## Upstream sync

```sh
git remote add upstream https://github.com/vercel/eve.git
git fetch upstream
git merge upstream/main   # on a branch, landed as a PR
```

Easy syncing is a primary requirement, not a nice-to-have. Seven rules, ordered
by impact.

**1. Zero renames.** No file or directory is renamed, ever. The package path
stays `packages/eve/`. Git re-detects renames heuristically across roughly 1,600
files, and past `merge.renameLimit` it stops trying — every upstream change then
arrives as add/delete pairs instead of edits. A single directory rename would
convert clean merges into hundreds of conflicts permanently. Rebranding is three
lines in `package.json`.

**2. Additive by default.** Every new adapter is a new file in a new directory.
New files never conflict, which is why the SQLite decision costs nothing.

**3. Move, do not delete.** The 55 Vercel-named files stay where upstream put
them, gated off, so upstream patches still apply.

**4. Single-line seams.** Where upstream code must change, change exactly one
line that delegates to our code. Each of the 18 `process.env.VERCEL` sites
becomes `resolveHostProvider() === "vercel"`. A conflict then requires upstream
to edit that exact line, not merely that file.

**5. Never reformat.** No formatter configuration changes, no import reordering,
no cosmetic sweeps across upstream files. A formatting pass would touch every
file and conflict with every future release.

**6. Enable `git rerere`.** Highest-leverage single command for a long-lived
fork.

```sh
git config rerere.enabled true
git config rerere.autoupdate true
```

Git records each conflict resolution and replays it automatically on later
merges. The same small set of files conflicts every release, so after the first
resolution rerere handles them silently. Always merge, never rebase — rebasing
rewrites hashes and defeats rerere.

**7. Mechanize the promise.** `scripts/sync-upstream.sh` fetches, merges on a
branch, runs the guards, and reports. A new invariant guard fails if any
`@vercel/*` import becomes reachable from the default runtime entrypoint, so an
upstream release that reintroduces coupling is caught at merge time rather than
in production. `FORK.md` records every divergence point and its rationale.

Measured conflict surface: 5 files carry more than 25 Vercel-referencing lines
(`setup/boxes/resolve-provisioning.ts`, `setup/scaffold/update/channels.ts`,
`self-modification/setup.ts`, `setup/flows/model-login-connection.ts`,
`services/dev-client/request-headers.ts`). The remaining 38 carry 1 to 15 lines
each.

### Upstreaming the host seam

After v1 ships and works, propose `resolveHostProvider()` to `vercel/eve` as a
research document plus PR. For upstream it is a pure refactor — the function
returns `"vercel"` on Vercel, so behavior is unchanged — and eve's own
principles call for the core to expose hooks rather than hardcode branches.

If it merges, we delete our 18 call-site edits and that conflict surface
disappears permanently. If it is declined, we keep our version and lose nothing.
The fork does not wait on the outcome either way.

## Testing

- **Unit** — `resolveHostProvider()` precedence, `sqlite()` and `s3()` backend
  behavior, `state-sqlite` durability across restart and lock correctness under
  concurrent acquisition.
- **Integration** — memory backend selection across host modes; channel scaffold
  output compiles.
- **Scenario** — `openeve build && openeve start` on a clean checkout with no
  Vercel environment, completing a real turn.
- **Invariant** — a guard asserting no `@vercel/*` import is reachable from the
  default runtime entrypoint. This is the fork's core promise, so it is
  mechanically enforced rather than reviewed.

## Open risks

- **Chat SDK adapter coverage.** eve's first-class channels expose richer
  surfaces than the generic `chatSdkChannel` in places. Feature parity per
  adapter needs verification before the first-class channels are retired.
- **Composio token custody.** Composio redacts raw OAuth tokens and expects
  Proxy Execute, so it cannot back `getToken`. It is a tool catalog only; the
  boundary must stay documented or users will expect it to replace all auth.
- **Workflow protocol pinning.** Custom worlds must match the vendored
  `@workflow/*` line, currently `5.0.0-beta`. Upstream bumps to that line are
  breaking for third-party worlds.
