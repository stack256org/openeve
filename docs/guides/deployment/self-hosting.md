---
title: "Self-Host eve"
description: "Run an eve agent as a Node service with your own workflow storage, sandbox backend, and routing."
---

Self-host eve when you operate a Node service, container platform, or reverse proxy. You run eve’s Nitro server and choose the infrastructure that stores workflows and executes sandbox sessions.

## Build and start the Node service

Build the agent, then start the generated server:

```bash
eve build
PORT=3000 eve start --host 0.0.0.0
```

The build writes the Nitro server under `.output/`. `eve start` serves that output and accepts either `PORT` or the `--port` flag.

Run this process under the same process manager or container platform you use for other Node web services. Configure Transport Layer Security (TLS), scaling, restarts, and log collection in that platform.

Node 24 or newer is required.

## Choose the host

The `host` field on the root `defineAgent` names which host operates the runtime services. It is `"self"` or `"vercel"`, and it defaults to `"self"`. A self-hosted deployment therefore authors nothing:

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-opus-4.8",
});
```

To select Vercel Workflow, Vercel Sandbox, and Vercel build output, opt in explicitly:

```ts title="agent/agent.ts"
import { defineAgent } from "eve";
import { vercel } from "eve/hosts/vercel";

export default defineAgent({
  host: vercel(),
  model: "anthropic/claude-opus-4.8",
});
```

`host` is root-only: a subagent cannot override it. It compiles into the manifest, so `eve build` and the running server read the same value.

When `host` is not authored, eve falls back to the `VERCEL` environment variable, which a Vercel build sets automatically. An authored value always wins over that fallback, so `host: vercel()` also works in environments Vercel does not set up for you, and a self-hosted process never becomes a Vercel one by accident.

One exception is worth knowing: `fileMemory()` selects Vercel Blob by reading `VERCEL` directly rather than the `host` field. On a machine where `VERCEL` is unset, `host: vercel()` alone does not move memory documents to Blob. Pass `fileMemory({ backend: vercelBlob() })` from `eve/memory/file/vercel` if that is what you want.

## Configure model access and route auth

Set `AI_GATEWAY_API_KEY` to use a string model ID through the Vercel AI Gateway from a non-Vercel host. A bare model ID always routes through the gateway, so it is not a self-contained path. To keep model calls on infrastructure you control, pass a provider object instead — see [Local models](../local-models) for Ollama, vLLM, and LiteLLM, and [Agent configuration](../../agent-config#set-the-model) for the forms `model` accepts.

`eve build` resolves the model's context window from the Vercel AI Gateway catalogue unless you author `modelContextWindowTokens`. That is a build-time request, not a runtime one, and it fails the build for a model the catalogue does not list — which includes every model you serve yourself. Author the value and the lookup never happens.

Don’t rely on `vercelOidc()` as the only production authenticator outside Vercel. Configure Basic auth, JSON Web Token (JWT) verification, generic OpenID Connect (OIDC), or a custom verifier that your host can validate. See [Authentication](../auth-and-route-protection).

## Persist workflow state

The default local Workflow world stores run state under `.eve/.workflow-data`. Mount that directory on persistent storage so runs survive process and container replacement.

You can instead select an installed Workflow world package in the root `agent.ts`:

```typescript
import { defineAgent } from "eve";

export default defineAgent({
  experimental: {
    workflow: {
      world: "@acme/eve-workflow-world",
    },
  },
});
```

The package must export a default factory or `createWorld()` function. Read credentials and host options from runtime environment variables. Install a world built against the same `@workflow/*` line as your eve release. The current line is `5.0.0-beta`, and the runtime rejects incompatible protocol versions.

See [Workflow Worlds](https://workflow-sdk.dev/worlds) for the underlying Workflow software development kit (SDK) abstraction.

## What the agent stores on disk

A running agent writes to these paths, all relative to the working directory the server runs in:

| Path                  | Holds                                                 | Durable state |
| --------------------- | ----------------------------------------------------- | ------------- |
| `data/openeve.db`     | File-memory documents and Chat SDK channel state      | Yes           |
| `.eve/.workflow-data` | Local Workflow world run state, sessions, and streams | Yes           |

Everything else `eve build` writes — the Nitro server under `.output/` and the rest of `.eve/` — is rebuilt from source and does not need preserving.

`data/openeve.db` is a SQLite database created on first write. It is opened by two things: `fileMemory()`, which stores one document per resolved memory scope there when no explicit backend is configured off Vercel, and the Linq and Photon channels, which keep their Chat SDK state there — thread subscriptions, per-thread locks, key/value entries with expiry, lists, and per-thread queues. Nothing else in eve uses it, and an agent that configures neither never creates the file.

Set `EVE_DATA_DIR` to move that directory somewhere else — a mounted volume, or a path outside the deploy directory so it survives a redeploy:

```bash
EVE_DATA_DIR=/var/lib/my-agent eve start
```

The variable replaces the whole `data/` path, not just its parent. When it is unset, the directory is `data/` under the process working directory.

Model credentials are not stored here. A deployment reads them from the process environment. The `/login` flow that saves a credential does so in the operating system's own secret store, and only applies to local development.

### Back it up

Copy `data/` for memory and channel state, and `.eve/.workflow-data` for in-flight runs. Those two paths are the durable state; everything else is rebuilt by `eve build`.

`data/openeve.db` is a live SQLite database in write-ahead logging (WAL) mode, so a plain file copy taken while the server is running can capture a torn database. Stop the process first, or use a SQLite-aware copy such as `sqlite3 data/openeve.db ".backup /backup/openeve.db"`.

Traces are not part of that set. The `.eve/traces/v1` spool that `eve traces` reads is written by `eve dev` on your own machine, so trace history does not travel when you move the agent.

A self-hosted server has no trace destination at all by default. eve seeds its Vercel Agent Runs exporter only when `VERCEL_ENV` is `preview` or `production`, and the local disk spool only under `eve dev`, so spans are produced and then dropped. Nothing is written to disk and nothing leaves the machine until you add a destination: an `agent/instrumentation/` file with `otelIntegration()` from `eve/instrumentation/otel`, pointing at a collector you run — Jaeger, Grafana Tempo, SigNoz, or anything else that speaks OpenTelemetry Protocol (OTLP). See [OpenTelemetry](../../observability/otel).

## Select a sandbox backend

`defaultBackend()` selects a local sandbox backend in availability order. You can instead select Docker, microsandbox, or a custom `SandboxBackend` adapter for your container, virtual machine, or isolation service.

Don’t select `vercel()` unless the self-hosted process should create hosted Vercel sandboxes. See [Sandbox](../../sandbox) for backend configuration and selection order.

## Configure proxy routes

Forward both runtime route prefixes through your reverse proxy or ingress:

- `/eve/` serves health, sessions, streams, channels, tools, and subagents
- `/.well-known/workflow/` receives workflow callbacks

A proxy restricted to `/eve/` lets a session start, but the run stalls when its callback can’t reach eve. Preserve both prefixes without rewriting their paths.

## Run workspace members

An [agent workspace](../../concepts/project-structure#several-root-agents) does not require Vercel or a frontend at runtime. Build each member from its own directory: root `eve build` produces a Vercel workspace deployment, not a group of self-hosted Node servers.

For a workspace containing `support` and `research`, run these from the workspace root, outside a Vercel build environment:

```bash
(cd agents/support && npx eve build)
(cd agents/research && npx eve build)
```

Start each built agent in a separate terminal, or configure these commands in your process manager:

```bash
(cd agents/support && npx eve start --host 127.0.0.1 --port 3001)
(cd agents/research && npx eve start --host 127.0.0.1 --port 3002)
```

For example, this Caddy configuration gives each agent its own origin and forwards both `/eve/` and `/.well-known/workflow/` without changing their paths. Point the example hostnames at your server and run Caddy on the same machine:

```text
support.example.com {
    reverse_proxy 127.0.0.1:3001
}

research.example.com {
    reverse_proxy 127.0.0.1:3002
}
```

Apply the authentication, persistent storage, and sandbox configuration above to each member. With the default local Workflow world, persist each member's own `.eve/.workflow-data` directory. If agents delegate to one another, configure an explicit [workspace-peer transport](../../subagents#vercel-workspace-peers) with the peer's URL and credentials; the default transport requires Vercel. Ensure callback URLs are reachable from the services that call them.

### Add a peer frontend

A frontend under `apps/web/` is another service managed by your host, not by `eve start`. Build and start it using its framework commands. A browser client can use `useEveAgent({ host: "https://support.example.com" })`; configure [CORS](../../channels/eve#cors) and browser credentials for that deployment. Alternatively, mount each agent on the frontend's origin through your reverse proxy.

For path-based mounts, strip the public prefix before forwarding requests to the agent and set `EVE_PUBLIC_ROUTE_PREFIX` in that agent's build and runtime environments. Forward its workflow callback routes as well as its eve routes. Keep the browser client, callback URLs, and peer transports consistent with the public mounts.

You can instead use [`eve/next`](../frontend/nextjs#dev-vs-deploy-topology) if you want Next.js to start built agent processes and provide the browser-facing proxy routes. That integration is optional; `eve/vercel` configuration is not used by a self-hosted process manager.

## Run schedules

The standard `eve build && eve start` path starts Nitro’s schedule runner. If you adapt the output to a custom HTTP-only host or preset, run Nitro scheduled tasks or invoke the same work from your scheduler.

## Verify the service

Check the health route after your proxy and authentication configuration are active:

```bash
curl https://your_agent.example.com/eve/v1/health
```

Then connect the development TUI and complete a real turn:

```bash
eve dev https://your_agent.example.com
```

## Continue configuring production

Use these guides to secure and observe the deployed agent:

- [Authentication](../auth-and-route-protection): configure the host’s route policy
- [Instrumentation](../../observability/instrumentation): export traces and diagnose runtime failures
- [Sandbox](../../sandbox): select and secure a sandbox backend
