# open-eve

open-eve is a fork of [eve](https://github.com/vercel/eve), Vercel's filesystem-first
framework for durable backend AI agents. It runs the same agents with no Vercel
service in the path: every default is local, so `eve build && eve start` on a bare
virtual private server (VPS) reaches no third party except the model provider you chose.

Vercel is not removed. It is opt-in, one field in `agent/agent.ts`.

## What differs from eve

| Layer             | eve on Vercel         | open-eve default                                 |
| ----------------- | --------------------- | ------------------------------------------------ |
| Host              | Vercel                | `self`; `host: vercel()` opts back in            |
| Durable execution | Vercel Workflow       | Local Workflow world under `.eve/.workflow-data` |
| File memory       | Vercel Blob           | SQLite in `data/openeve.db`                      |
| Channel state     | Vercel-managed        | SQLite in `data/openeve.db`                      |
| Sandbox           | Vercel Sandbox        | Docker, then microsandbox, then just-bash        |
| Model             | AI Gateway model slug | Any AI SDK provider, including a local endpoint  |
| Build output      | `.vercel/output`      | A Nitro Node server under `.output/`             |
| Channel auth      | Vercel Connect        | Credentials you set in the environment           |

Two pages cover most of the practical difference:

- [Local models](docs/guides/local-models.md) — Ollama, vLLM, LiteLLM, and direct providers
- [Self-host eve](docs/guides/deployment/self-hosting.md) — what a VPS needs and what it stores

Everything else in eve is unchanged, including the nine first-class channels, tools,
skills, subagents, schedules, and the terminal UI.

## What has not changed

Some things a reader might expect from the name are deliberately still as upstream
left them:

- **The import specifier is still `eve`.** Imports are still `eve`, `eve/tools`, and so
  on. The package name is also the import specifier, so renaming it would rewrite
  roughly 1,600 import sites and make every upstream merge conflict on them. open-eve
  publishes as `@stack256org/openeve` and installs under the `eve` alias:
  `npm install eve@npm:@stack256org/openeve@latest`. A bare `npm install eve` installs
  upstream eve.
- **The CLI answers to both `eve` and `openeve`.** They are the same binary.
- **`eve add` still resolves `https://eve.dev/r`.** No open-eve registry is hosted yet.
  Override it with `EVE_DEV_OFFICIAL_REGISTRY_URL`, or point at your own with
  `eve registry add`.
- **`eve-software-factory-template` runs on fewer machines than the rest.** It needs a
  sandbox that brokers a GitHub credential without exposing it, which the Docker
  backend refuses to do, so it uses microsandbox — Apple Silicon macOS or Linux with
  KVM. The other eleven templates run anywhere Node.js does.

[`open-eve/DEFERRED.md`](open-eve/DEFERRED.md) is the full list of what is not built yet
and why.

## The filesystem is the authoring interface

A typical eve agent has this structure:

```text
my-agent/
└── agent/
    ├── agent.ts            # Optional: model and runtime config
    ├── instructions.md     # Required: the always-on system prompt
    ├── tools/              # Optional: typed functions the model can call
    │   └── get_weather.ts
    ├── skills/             # Optional: procedures loaded on demand
    │   └── plan_a_trip.md
    ├── channels/           # Optional: message channels (HTTP, Slack, Discord)
    │   └── slack.ts
    └── schedules/          # Optional: recurring cron jobs
        └── weekly_recap.ts
```

The [`docs/`](docs) directory is the full project layout and guides. eve's hosted
documentation at [eve.dev/docs](https://eve.dev/docs) describes upstream, so where the two
disagree, this repository's copy is the one that matches this code.

## Quick start

open-eve is not published to npm, so build it from a clone:

```bash
git clone https://github.com/stack256org/openeve.git
cd openeve
pnpm install
pnpm build
```

Then scaffold an agent with the CLI you just built:

```bash
node packages/eve/bin/eve.js init my-agent
```

That creates a new `my-agent` directory, installs its dependencies, initializes Git, and
starts the interactive terminal UI. Passing a path instead of a name adds eve to an
existing project.

`init` writes an AI Gateway model ID into `agent/agent.ts`, which routes through Vercel.
Replace it with a provider object to keep model calls on infrastructure you control — see
[Local models](docs/guides/local-models.md).

> [!NOTE]
> The `eve` package includes its full documentation, so coding agents can read it locally from
> `node_modules/eve/docs`.

### A minimal example

The generated project includes an `agent` directory. Replace `agent/instructions.md` with:

```md
You are a concise weather demo assistant. Tell users that the weather data is mocked.
```

Add a mock weather tool at `agent/tools/get_weather.ts`:

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Return mock weather data for a city.",
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    return { city, condition: "Sunny", temperatureF: 72 };
  },
});
```

Choose the model in `agent/agent.ts`. Against a model server on the same machine, that
is an AI SDK provider pointed at its address:

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

const ollama = createOpenAI({
  apiKey: "ollama",
  baseURL: "http://127.0.0.1:11434/v1",
  name: "ollama",
});

export default defineAgent({
  model: ollama.chat("qwen3:8b"),
  modelContextWindowTokens: 32_768,
});
```

Each of those three extra fields matters, and one of them breaks `eve build`
rather than a request. [Local models](docs/guides/local-models.md) explains why.

For a new scaffold, start the agent again:

```bash
npm run dev
```

That's a working agent. Add human-in-the-loop prompts, subagents, and schedules as needed.
Follow the [first-agent tutorial](docs/tutorial/first-agent.mdx) for a complete
walkthrough.

## Community

open-eve's issues and discussions are on
[this repository](https://github.com/stack256org/openeve). Questions about eve itself
belong upstream, in [eve's discussions](https://github.com/vercel/eve/discussions).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get the repo
running locally and land a change. By participating, you agree to our
[Code of Conduct](CODE_OF_CONDUCT.md).

Changes that are not about removing the Vercel dependency belong upstream in
[vercel/eve](https://github.com/vercel/eve), so everyone gets them. This fork merges
upstream releases rather than diverging from them, which is why it renames no files and
edits upstream ones a line at a time.

## Security

Please do not open public issues for security vulnerabilities. Instead, follow
[SECURITY.md](SECURITY.md) and report responsibly to
[responsible.disclosure@vercel.com](mailto:responsible.disclosure@vercel.com).

## Beta terms

eve is currently in beta and subject to the [Vercel beta terms](https://vercel.com/docs/release-phases/public-beta-agreement);
the framework, APIs, documentation, and behavior may change before general availability.
