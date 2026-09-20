# Typefully Social Media Agent eve Template

[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

A Slack-based social media agent built on [eve](https://eve.dev). Team members @mention it in Slack and it runs their social presence through Typefully: drafting posts and threads for X, LinkedIn, Threads, Bluesky, and Mastodon, scheduling and managing the publishing queue, uploading media, reading analytics, and pulling briefs from Notion. Long-form pieces are shared as Notion pages.

- **Lives in Slack.** Answers @mentions and DMs, replies in threads, and renders approvals as buttons.
- **Works on your Typefully account.** The connection authenticates with your Typefully API key (`TYPEFULLY_API_KEY`), so drafts and scheduling run against your real workspace. Plain drafting is friction-free; scheduling or publishing a post (`publish_at`) and deleting drafts, comments, or threads pause for approval before they run.
- **Pulls from and drafts into Notion.** Briefs and source material come from Notion pages through a workspace integration token (`NOTION_API_KEY`), long-form pieces are drafted back as pages, and page updates and moves are gated on approval.
- **Stores files on disk.** Export threads, save images and attachments, and read them back from the agent's own data directory (`EVE_DATA_DIR`, defaulting to `./data`).
- **Posts a weekly analytics digest.** Every Monday it pulls Typefully post and follower analytics and posts two tables to a Slack channel you choose (`TYPEFULLY_ANALYTICS_CHANNEL`).

## Setup

Copy `.env.example` to `.env.local` and fill in the five credentials the agent needs:

- **Slack**: create a Slack app, install it in your workspace, and copy the bot token (`SLACK_BOT_TOKEN`) and signing secret (`SLACK_SIGNING_SECRET`). Point the app's Event Subscriptions request URL at `<your-host>/eve/v1/slack`.
- **Typefully**: copy your API key from Settings into `TYPEFULLY_API_KEY`, and set `TYPEFULLY_ANALYTICS_CHANNEL` to the Slack channel id the weekly digest posts to.
- **Notion**: create an internal integration, share the pages it should reach with it, and copy the token into `NOTION_API_KEY`.
- **Anthropic and OpenAI**: `ANTHROPIC_API_KEY` for the root agent and reviewer, `OPENAI_API_KEY` for the researcher.

Storage is a directory. `EVE_DATA_DIR` holds everything durable the agent writes, including the asset store and per-user preferences; it defaults to `./data`. Back up that one path, or point it at a mounted volume.

Then run it anywhere Node 24 runs. @mention the bot in your Slack workspace to start working on your social posts.

## Tech stack

| Layer                     | Technology                                                    |
| ------------------------- | ------------------------------------------------------------- |
| Agent framework           | [eve](https://eve.dev)                                        |
| Language                  | TypeScript (strict, ESM)                                      |
| Chat surface              | Slack, bot token + signing secret from the environment        |
| Social publishing         | Typefully (MCP), static API key (`TYPEFULLY_API_KEY`)         |
| Briefs & long-form drafts | Notion (MCP), workspace integration token (`NOTION_API_KEY`)  |
| File storage              | the local filesystem, under `EVE_DATA_DIR`                    |
| Model access              | Anthropic and OpenAI, called directly with their own API keys |
| Sandbox                   | Docker                                                        |
| Lint & format             | [Ultracite](https://www.ultracite.ai/) (Biome)                |

**Every credential is an environment variable.** Nothing is brokered by a hosting provider, so the agent runs the same on a laptop, a VM, or a container. `.env.example` lists every variable with a one-line note on where to get it.

## Quick start with an AI coding agent

If you're working with an AI coding agent like Claude Code or Cursor, you can use this prompt to have it help you with building your agent:

```text
I want to build a Slack agent with the eve framework, using the Typefully social media agent template. Read the setup instructions at https://agent-resources.dev/typefully-eve-template.md and follow them. They will cover deploying the template, building with eve, how everything works overall, and more.
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
    typefully.ts            # Typefully MCP, static API key (TYPEFULLY_API_KEY); deletes and scheduling require approval
    notion.ts               # Notion MCP, integration token; page updates/moves require approval
  sandbox.ts                # Docker sandbox backend
  schedules/
    weekly-analytics.ts     # Monday cron: pull Typefully analytics, post a digest to Slack
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
    lint_against_style.ts   # check a draft against the target platform's banned-words list
    post_analytics_report.ts  # post the weekly analytics digest to a fixed Slack channel
  lib/
    assets.ts               # data directory, anchored key validation, content types
    user-preferences.ts     # principal-scoped asset key + reserved-prefix guard
  skills/
    writing-quality/              # generic prose quality for anything written for humans
    x-style/                      # X voice, hooks, threads, specs, banned words
    linkedin-style/               # LinkedIn equivalents
    threads-style/                # Threads equivalents
    bluesky-style/                # Bluesky equivalents
    mastodon-style/               # Mastodon equivalents
```

## Pairing with the content agent template

The [eve content agent template](https://github.com/vercel-labs/eve-content-agent-template) is a full content assistant with a house voice and style skills for long-form surfaces this agent doesn't cover (blog posts, release notes, newsletters). Instead of merging all of that into this agent, you can deploy it as its own agent and let this one delegate to it through eve's [remote agents](https://eve.dev/docs/guides/remote-agents) feature.

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

3. Set `CONTENT_AGENT_URL` in this project's environment and mention the new subagent in `agent/instructions.md` so the agent knows when to hand off.

The remote agent runs in its own deployment with its own skills and connections, and it never sees this agent's conversation history, so this agent packs everything the writer needs into the call `message`. The result comes back as a normal tool result, the same shape as the local `researcher` and `reviewer` subagents.

## Local development

Copy `.env.example` to `.env.local`, fill it in, then run the development server:

```bash
pnpm dev
```

You can chat with the agent directly in the dev TUI to test the Typefully, Notion, and asset flows. The Slack surface needs a public URL, so point the Slack app's request URL at a tunnel or a deployment to exercise it. Build a deployable bundle with:

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

- **Behavior:** edit `agent/instructions.md`. It describes the whole workflow: load the right skill first, ground work in the user's real social sets and drafts, draft freely but schedule and delete only on approval, draft long pieces into Notion, and get a fresh-eyes review before proposing a draft.
- **Approval gates:** edit the approval policy in `agent/connections/typefully.ts` (the `DELETE_TOOLS` / `PUBLISH_TOOLS` lists and the `publish_at` check) and the `APPROVAL_REQUIRED_TOOLS` list in `agent/connections/notion.ts` to change which MCP tools pause for a human decision.
- **Skills:** edit or add skills in `agent/skills/`. Each folder holds a `SKILL.md` plus its reference files. The five `*-style` skills carry per-platform guidance and a `banned-words.json` that the `lint_against_style` tool checks drafts against; `writing-quality` carries the generic prose rules. The reviewer subagent keeps its own identical copy of `writing-quality` under `agent/subagents/reviewer/skills/`.
- **Model:** edit `agent/agent.ts` (or run `/model` in the dev TUI).
- **Tools:** add or change tools in `agent/tools/`. The filename is the tool name.
- **Weekly analytics digest:** set `TYPEFULLY_ANALYTICS_CHANNEL` to the Slack channel id it should post to. Change the day or time in `agent/schedules/weekly-analytics.ts` (the cron is evaluated in UTC), and edit `agent/tools/post_analytics_report.ts` to change the report format. In dev, trigger a run with `curl -X POST http://localhost:3000/eve/v1/dev/schedules/weekly-analytics`.

The agent auto-updates as you edit these files.

## Learn more

- [eve documentation](https://eve.dev/docs/introduction): the framework powering this agent.
- [Slack apps](https://api.slack.com/quickstart): where the bot token and signing secret come from.
- [Typefully](https://typefully.com): the social publishing platform the agent works through.
- [Notion integrations](https://www.notion.so/profile/integrations): where the Notion token comes from.

## Related templates

- [eve Content Agent](https://github.com/vercel-labs/eve-content-agent-template)
- [eve Personal Agent](https://github.com/vercel-labs/personal-agent-template)
