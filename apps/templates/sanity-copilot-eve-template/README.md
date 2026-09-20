# Sanity Copilot eve Template

[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

A Slack-based Sanity copilot built on [eve](https://eve.dev). Team members @mention it in Slack and it manages their Sanity project: querying and editing content with GROQ, inspecting and shaping schemas, creating and editing drafts, managing releases, and drafting content pieces into Notion. Long-form drafts are shared as Notion pages.

- **Lives in Slack.** Answers @mentions and DMs, replies in threads, and renders approvals as buttons.
- **Works on your Sanity project.** The connection authenticates with a Sanity API token (`SANITY_API_TOKEN`), so queries and edits run against your real project, and destructive operations (patching, publishing, deploying schemas) pause for approval before they run.
- **Drafts in Notion.** Long-form pieces are created as Notion pages through a workspace integration token (`NOTION_API_KEY`), with page updates and moves gated on approval.
- **Stores files on disk.** Export drafts, save images and attachments, and read them back from the agent's own data directory (`EVE_DATA_DIR`, defaulting to `./data`).

## Setup

Copy `.env.example` to `.env.local` and fill in the credentials the copilot needs:

- **Slack**: create a Slack app, install it in your workspace, and copy the bot token (`SLACK_BOT_TOKEN`) and signing secret (`SLACK_SIGNING_SECRET`). Point the app's Event Subscriptions request URL at `<your-host>/eve/v1/slack`.
- **Sanity**: mint an API token in sanity.io/manage with the narrowest role that covers the work, and put it in `SANITY_API_TOKEN`.
- **Notion**: create an internal integration, share the pages it should reach with it, and copy the token into `NOTION_API_KEY`.
- **Anthropic and OpenAI**: `ANTHROPIC_API_KEY` for the root agent and reviewer, `OPENAI_API_KEY` for the researcher.

Storage is a directory. `EVE_DATA_DIR` holds everything durable the copilot writes, including the asset store and per-user preferences; it defaults to `./data`. Back up that one path, or point it at a mounted volume.

Then run it anywhere Node 24 runs. @mention the bot in your Slack workspace to start working on your Sanity project.

## Tech stack

| Layer              | Technology                                                    |
| ------------------ | ------------------------------------------------------------- |
| Agent framework    | [eve](https://eve.dev)                                        |
| Language           | TypeScript (strict, ESM)                                      |
| Chat surface       | Slack, bot token + signing secret from the environment        |
| Content management | Sanity (MCP), API token (`SANITY_API_TOKEN`)                  |
| Drafting surface   | Notion (MCP), workspace integration token (`NOTION_API_KEY`)  |
| File storage       | the local filesystem, under `EVE_DATA_DIR`                    |
| Model access       | Anthropic and OpenAI, called directly with their own API keys |
| Sandbox            | Docker                                                        |
| Lint & format      | [Ultracite](https://www.ultracite.ai/) (Biome)                |

**Every credential is an environment variable.** Nothing is brokered by a hosting provider, so the copilot runs the same on a laptop, a VM, or a container. `.env.example` lists every variable with a one-line note on where to get it. Sanity and Notion are reached with one shared token each rather than per-user, so scope each token to what the copilot actually needs.

## Quick start with an AI coding agent

If you're working with an AI coding agent like Claude Code or Cursor, you can use this prompt to have it help you with building your agent:

```text
I want to build a Slack agent with the eve framework, using the Sanity copilot template. Read the setup instructions at https://agent-resources.dev/sanity-copilot-eve-template.md and follow them. They will cover deploying the template, building with eve, how everything works overall, and more.
```

## What's inside

```text
agent/
  agent.ts                  # model configuration, compaction, session token limits
  instructions.md           # the agent's behavior
  channels/
    slack.ts                # Slack surface (SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET)
    eve.ts                  # dev TUI surface for local development
  connections/
    sanity.ts               # Sanity MCP, user-scoped OAuth; destructive tools require approval
    notion.ts               # Notion MCP, user-scoped OAuth; page updates/moves require approval
  sandbox.ts                # Docker sandbox backend
  subagents/
    researcher/             # fresh-context web researcher (own session, web tools only)
    reviewer/               # fresh-context draft reviewer (own session)
      skills/writing-quality/  # its own copy of the writing-quality rubric
      sandbox.ts            # its own sandbox backend
  tools/
    upload_asset.ts         # asset store: write text or binary content
    list_assets.ts          # asset store: browse stored assets
    get_asset_info.ts       # asset store: metadata without reading the file
    download_asset.ts       # asset store: read a stored file back
    delete_asset.ts         # asset store: delete (requires approval)
    get_user_preferences.ts   # load this user's saved preferences
    save_user_preferences.ts  # save standing preferences (per-user, principal-scoped)
    clear_user_preferences.ts # clear this user's preferences (requires approval)
  lib/
    assets.ts               # data directory, anchored key validation, content types
    user-preferences.ts     # principal-scoped asset key + reserved-prefix guard
  skills/
    sanity-best-practices/              # schemas, GROQ, releases, framework integrations
    content-modeling-best-practices/    # designing and refactoring content types
    portable-text-conversion/           # converting rich text into Portable Text
    portable-text-serialization/        # rendering Portable Text out to other formats
    seo-aeo-best-practices/             # metadata, structured data, AI-answer readiness
    content-experimentation-best-practices/  # A/B tests and variants
    writing-quality/                    # prose rules for anything written for humans
```

All of the skills except `writing-quality` come from Sanity's [Agent Toolkit](https://github.com/sanity-io/agent-toolkit); the `sanity-best-practices` references are also the canonical content behind the Sanity MCP server's rules tools.

## Pairing with the content agent template

The [eve content agent template](https://github.com/vercel-labs/eve-content-agent-template) is a full content assistant: per-surface style skills (blog, LinkedIn, X, release notes, newsletters), a house voice, and a style lint. Instead of merging all of that into this copilot, you can deploy it as its own agent and let the copilot delegate to it through eve's [remote agents](https://eve.dev/docs/guides/remote-agents) feature.

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

3. Set `CONTENT_AGENT_URL` in this project's environment and mention the new subagent in `agent/instructions.md` so the copilot knows when to hand off.

The remote agent runs in its own deployment with its own skills and connections, and it never sees this copilot's conversation history, so the copilot packs everything the writer needs into the call `message`. The result comes back as a normal tool result, the same shape as the local `researcher` and `reviewer` subagents.

## Local development

Copy `.env.example` to `.env.local`, fill it in, then run the development server:

```bash
pnpm dev
```

You can chat with the agent directly in the dev TUI to test the Sanity, Notion, and asset flows. The Slack surface needs a public URL, so point the Slack app's request URL at a tunnel or a deployment to exercise it. Build a deployable bundle with:

```bash
pnpm build
```

### Linting and formatting

This project uses [Ultracite](https://www.ultracite.ai/) (a [Biome](https://biomejs.dev/) preset) for linting and formatting:

```bash
pnpm check      # check formatting and lint rules
pnpm fix        # auto-fix what is fixable
pnpm validate   # lint + typecheck + eve discovery diagnostics
```

## Customizing

- **Behavior:** edit `agent/instructions.md`. It describes the whole workflow: load the right skill first, ground work in the real project with GROQ and schema reads, work in drafts and publish only on approval, draft long pieces into Notion, and get a fresh-eyes review before proposing a draft.
- **Approval gates:** edit the `APPROVAL_REQUIRED_TOOLS` lists in `agent/connections/sanity.ts` and `agent/connections/notion.ts` to change which MCP tools pause for a human decision.
- **Skills:** edit or add skills in `agent/skills/`. Each folder holds a `SKILL.md` plus its reference files. The reviewer subagent keeps its own copy of `writing-quality` under `agent/subagents/reviewer/skills/`.
- **Model:** edit `agent/agent.ts` (or run `/model` in the dev TUI).
- **Tools:** add or change tools in `agent/tools/`. The filename is the tool name.

The agent auto-updates as you edit these files.

## Learn more

- [eve documentation](https://eve.dev/docs/introduction): the framework powering this agent.
- [Slack apps](https://api.slack.com/quickstart): where the bot token and signing secret come from.
- [Sanity documentation](https://www.sanity.io/docs): the CMS the copilot manages.
- [Sanity Agent Toolkit](https://github.com/sanity-io/agent-toolkit): the source of every skill here except `writing-quality`.
- [Notion integrations](https://www.notion.so/profile/integrations): where the Notion token comes from.

## Related templates

- [eve Content Agent](https://github.com/vercel-labs/eve-content-agent-template)
- [eve Personal Agent](https://github.com/vercel-labs/personal-agent-template)
