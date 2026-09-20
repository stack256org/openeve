# Kody (GitHub Maintainer) eve Template

[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

Kody is a personal GitHub maintainer agent built on [eve](https://eve.dev), made for freelancers, solo maintainers, and anyone who runs a repo alongside everything else. Every Monday it emails you a digest of your repo's open issues, and you reply to act on it ("create Linear issues for #1 and #2 and assign them to me"). Between digests it keeps working the repo: summarizing new pull requests, answering @mentions, and handling the Linear issues you delegate. You stay in your inbox, Kody works the tracker.

- **Digests your issue tracker weekly.** A cron schedule fetches all open issues on your repo, groups them (needs attention, recent activity, stale), cites every issue as #N, and sends the digest by email through the Resend MCP tools.
- **Acts on email replies.** Inbound replies land on the Resend chat channel; the agent resolves the referenced issue numbers against GitHub, does what was asked (comment, label, close, create Linear issues), and replies on the same thread.
- **Summarizes new pull requests.** When a PR opens, Kody posts one orienting comment: what the PR does and why, plus a table breaking down the changed files. PRs opened by bots are skipped.
- **Works in Linear.** Delegate issues to the agent or mention it in Linear Agent Sessions ("email me a summary of this issue"), and it works the issue with the Linear MCP tools.
- **Answers GitHub mentions.** @Kody on an issue or PR gets an in-thread reply, cross-referencing Linear when it helps.
- **Remembers your preferences.** Standing preferences (a preferred email address, how you like the digest grouped, a default Linear team) live on disk under `EVE_DATA_DIR`, keyed to the resolved principal.

## Setup

Copy `.env.example` to `.env.local` and fill it in. Kody needs four groups of credentials.

### GitHub

Two different things authenticate to GitHub, because the channel and the tools do different jobs.

- **The channel** answers @mentions and comments on new pull requests, so it is a GitHub App: set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`, subscribe the App to `issue_comment`, `pull_request_review_comment`, and `pull_request`, and point its webhook at `<your-host>/eve/v1/github`.
- **The tools** read and write issues through the GitHub Tools SDK, which reads `GITHUB_TOKEN`. A personal access token or an App installation token both work; scope it to the repositories Kody maintains.

### Linear

Create a Linear agent app, then set `LINEAR_AGENT_ACCESS_TOKEN` (used by both the channel and the Linear MCP connection) and `LINEAR_WEBHOOK_SECRET`. Subscribe the app to the AgentSessionEvent webhook category and point it at `<your-host>/eve/v1/linear`.

### Resend

Set `RESEND_API_KEY` (used by both the email channel and the Resend MCP connection) and `RESEND_WEBHOOK_SECRET`, then point Resend's inbound webhook at `<your-host>/eve/v1/resend` so replies reach the agent. Set `RESEND_FROM_ADDRESS` to a verified sender on your Resend domain, and optionally `RESEND_FROM_NAME` (defaults to "Kody"); the email channel and the system prompt both read them, so every email the agent sends carries the same identity.

### Redis, storage, models, and digest config

- `REDIS_URL`: thread state for the email channel (`@chat-adapter/state-redis`). Any Redis works, hosted or a local container.
- `EVE_DATA_DIR`: the directory holding the preference files and anything else durable Kody writes. Defaults to `./data`; mount a volume so it outlives the process.
- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`: the root agent calls Anthropic directly, the researcher subagent calls OpenAI.
- `DIGEST_REPO` (e.g. `owner/repo`) and `DIGEST_EMAIL`: what the weekly digest covers and who receives it. Both are required at build time; a missing value fails discovery with a clear error instead of shipping a digest that cannot send.

## Tech stack

| Layer                  | Technology                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Agent framework        | [eve](https://eve.dev)                                                                                                                |
| Language               | TypeScript (strict, ESM)                                                                                                              |
| GitHub surface & tools | eve GitHub channel (GitHub App) + [GitHub Tools SDK](https://github.com/vercel-labs/github-tools) (maintainer preset, `GITHUB_TOKEN`) |
| Linear surface & tools | eve Linear channel (Agent Sessions) + Linear MCP, both on `LINEAR_AGENT_ACCESS_TOKEN`                                                 |
| Email surface          | Resend, via the [Chat SDK](https://chat-sdk.dev) channel (`@resend/chat-sdk-adapter`) with Redis state                                |
| Email sending          | Resend MCP (`mcp.resend.com`)                                                                                                         |
| Preference storage     | the local filesystem, under `EVE_DATA_DIR`                                                                                            |
| Model access           | Anthropic and OpenAI, called directly with their own API keys                                                                         |
| Sandbox                | Docker                                                                                                                                |
| Lint & format          | [Ultracite](https://www.ultracite.ai/) (Biome)                                                                                        |

Every credential is an environment variable, so Kody runs the same on a laptop, a VM, or a container. `.env.example` lists all of them with a one-line note on where each comes from.

## Quick start with an AI coding agent

If you're working with an AI coding agent like Claude Code or Cursor, you can use this prompt to have it help you with building your agent:

```text
I want to build a GitHub maintainer agent with the eve framework, using the Kody template. Read the setup instructions at https://agent-resources.dev/kody-eve-template.md and follow them. They will cover deploying the template, building with eve, how everything works overall, and more.
```

## What's inside

```text
agent/
  agent.ts                  # model configuration, compaction, session token limits
  instructions.ts           # the agent's behavior; compiled at build time with RESEND_FROM_ADDRESS baked in
  channels/
    github.ts               # eve GitHub Channel; @mentions in-thread + a summary comment on newly opened PRs
    linear.ts               # eve Linear Channel
    resend.ts               # Chat SDK channel: Resend adapter + Redis state
    eve.ts                  # dev TUI / route auth surface
  connections/
    linear.ts               # Linear MCP, app-scoped Connect auth via linearAuth
    resend.ts               # Resend MCP, static bearer token from RESEND_API_KEY
  schedules/
    weekly-digest.ts        # cron "0 9 * * 1" (Mondays 09:00 UTC); the agent composes and sends the digest
  sandbox.ts                # Docker sandbox backend
  subagents/
    researcher/             # fresh-context web researcher (own session, web tools only)
  tools/
    github.ts               # GitHub Tools SDK: read and triage issues on the repo
    get_user_preferences.ts   # load this user's saved preferences
    save_user_preferences.ts  # save standing preferences (per-user, principal-scoped)
    clear_user_preferences.ts # clear this user's preferences (requires approval)
  lib/
    constants.ts            # requireEnv + shared app-scoped Linear authorization
    assets.ts               # data directory, anchored key validation, content types
    user-preferences.ts     # principal-scoped storage key + reserved-prefix guard
  skills/
    writing-quality/        # prose rules for anything written for humans
    digest-format/          # the weekly digest's structure: grouping, criteria, one-line summaries
    triaging-issues/        # triage playbook: dedupe, repo labels, ask-or-close, repro requests
    github-linear-bridging/ # bridged Linear issues and two-way cross-links
```

## Pairing with the content agent template

The [eve content agent template](https://github.com/vercel-labs/eve-content-agent-template) is a full content assistant: per-surface style skills (blog, LinkedIn, X, release notes, newsletters), a house voice, and a style lint. Instead of merging all of that into Kody, you can deploy it as its own agent and let Kody delegate to it, through eve's [remote agents](https://eve.dev/docs/guides/remote-agents) feature, when repo work turns into writing work: release notes for a shipped fix, or a post announcing a feature that just closed out.

1. Deploy the content agent template as its own service.
2. Add a remote subagent file to this repo. The filename is the tool name, and `bearer()` carries a shared token between the two deployments:

```ts
// agent/subagents/content_writer.ts
import { defineRemoteAgent } from "eve";
import { bearer } from "eve/agents/auth";

export default defineRemoteAgent({
  url: () => process.env.CONTENT_AGENT_URL ?? "https://your-content-agent.example.com",
  description:
    "Drafts blog posts, LinkedIn and X posts, release notes, and newsletters in the house voice. " +
    "Pass the surface, the source material, and any constraints in the message.",
  auth: bearer(() => process.env.CONTENT_AGENT_TOKEN ?? ""),
});
```

3. Set `CONTENT_AGENT_URL` in this project's environment and mention the new subagent in `agent/instructions.ts` so Kody knows when to hand off.

The remote agent runs in its own deployment with its own skills and connections, and it never sees Kody's conversation history, so Kody packs everything the writer needs into the call `message`: the issues or PRs the piece covers, the audience, and the surface. The result comes back as a normal tool result, the same shape as the local `researcher` subagent.

## Local development

Copy `.env.example` to `.env.local`, fill it in, then run the development server:

```bash
pnpm dev
```

You can chat with the agent directly in the dev TUI to exercise the GitHub tools, the Linear and Resend connections, and the preference tools. The webhook surfaces (GitHub mentions, Linear sessions, email replies) need a public URL, so point them at a tunnel or a deployment.

`eve dev` never fires schedules on their cron cadence. Trigger the digest by hand with the dev dispatch route:

```bash
curl -X POST http://localhost:3000/eve/v1/dev/schedules/weekly-digest
```

Ship changes with:

```bash
eve deploy
```

### Linting and formatting

This project uses [Ultracite](https://www.ultracite.ai/) (a [Biome](https://biomejs.dev/) preset) for linting and formatting:

```bash
pnpm check      # check formatting and lint rules
pnpm fix        # auto-fix what is fixable
pnpm validate   # lint + typecheck + eve discovery diagnostics
```

## Customizing

- **Behavior:** edit `agent/instructions.ts`. It describes the whole workflow: ground everything in the real tracker, the weekly digest shape, acting on email replies, Linear sessions, and GitHub mentions. The sending-email rule resolves `RESEND_FROM_ADDRESS` at build time.
- **The digest:** the cron expression, subject line, and recipient live in `agent/schedules/weekly-digest.ts`; the digest's structure (grouping, needs-attention and stale criteria, one-line summaries) lives in `agent/skills/digest-format/SKILL.md`.
- **PR summaries:** the `onPullRequest` hook and its task prompt live in `agent/channels/github.ts`. Adjust the dispatch condition there (for example, to include bot PRs or drafts) or the comment's shape.
- **Approval gates:** `agent/tools/github.ts` sets `requireApproval: "never"` for the reversible issue-conversation writes because email cannot render an approval prompt; adjust the list to re-gate them. `clear_user_preferences` stays approval-gated.
- **Skills:** edit or add skills in `agent/skills/`. Each folder holds a `SKILL.md` plus its reference files.
- **Model:** edit `agent/agent.ts` (or run `/model` in the dev TUI).
- **Tools:** add or change tools in `agent/tools/`. The filename is the tool name.

The agent auto-updates as you edit these files.

## Learn more

- [eve documentation](https://eve.dev/docs/introduction): the framework powering this agent.
- [GitHub Apps](https://docs.github.com/en/apps/creating-github-apps): where the channel's App id, private key, and webhook secret come from.
- [Chat SDK](https://chat-sdk.dev): the adapter layer behind the email channel.
- [Resend](https://resend.com/docs): email sending and inbound webhooks.
- [Linear agents](https://linear.app/developers/agents): where the agent access token and webhook secret come from.

## Related templates

- [eve Content Agent](https://github.com/vercel-labs/eve-content-agent-template)
- [eve Personal Agent](https://github.com/vercel-labs/personal-agent-template)
