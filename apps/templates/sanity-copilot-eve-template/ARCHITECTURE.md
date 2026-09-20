# ARCHITECTURE.md

A map of how this agent is put together, for humans and AI agents working in the repo. Keep it current as the codebase evolves.

## Project identification

- **Name:** Sanity Copilot (eve template)
- **Maintainer:** Vercel Labs
- **License:** MIT
- **Last updated:** 2026-07-20

## Overview

A Slack-based Sanity copilot built on the [eve](https://eve.dev) agent framework. Users @mention it to manage a Sanity project: querying content with GROQ, shaping schemas, creating and editing drafts, and managing releases, all through Sanity's MCP server. Long-form pieces are drafted into Notion pages; generated files and assets live on the local filesystem under `EVE_DATA_DIR`. The agent runs the same way locally (`eve dev`) and in production, on any host with Node 24.

eve discovers every capability from the filesystem under `agent/`. There is no central registry or wiring file: a tool's name is its filename, a connection's name is its filename, and so on.

## Project structure

```text
agent/
  agent.ts                  # model configuration (defineAgent): compaction + session token limits
  instructions.md           # base system prompt / behavior
  channels/
    slack.ts                # Slack surface; SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET
    eve.ts                  # inbound route auth; dev-only localDevUser shim (user principal)
  connections/
    sanity.ts               # Sanity MCP server, user-scoped OAuth; destructive tools approval-gated
    notion.ts               # Notion MCP server, user-scoped OAuth; update/move tools approval-gated
  sandbox.ts                # sandbox backend (Docker)
  subagents/
    researcher/             # agent.ts + instructions.md; fresh-context web researcher (web tools only)
    reviewer/               # agent.ts + instructions.md + own skills/writing-quality copy + sandbox.ts
  tools/
    upload_asset.ts         # asset store: write text/binary
    list_assets.ts          # asset store: browse
    get_asset_info.ts       # asset store: metadata
    download_asset.ts       # asset store: read back (validated keys only)
    delete_asset.ts         # asset store: delete (approval-gated)
    get_user_preferences.ts   # load this user's saved preferences
    save_user_preferences.ts  # save standing preferences (principal-scoped)
    clear_user_preferences.ts # clear this user's preferences (approval-gated)
  lib/
    assets.ts               # data directory, anchored key validation, content types
    user-preferences.ts     # principal-scoped asset key + reserved-prefix guard (shared helper)
  skills/                   # load-on-demand procedures, routed by description frontmatter
    sanity-best-practices/              # schemas, GROQ, TypeGen, functions, framework integrations
    content-modeling-best-practices/    # content types, references vs embedding, taxonomies
    portable-text-conversion/           # HTML/Markdown into Portable Text
    portable-text-serialization/        # Portable Text out to React, HTML, Markdown, etc.
    seo-aeo-best-practices/             # metadata, structured data, EEAT, AI-answer readiness
    content-experimentation-best-practices/ # A/B tests, variants, metrics, pitfalls
    writing-quality/                    # AI-tells, plain English, web-content specs
```

## Core components

| Component           | Lives in                                                                             | eve primitive    | Responsibility                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slack surface       | `agent/channels/slack.ts`                                                            | Channel          | Receives @mentions/DMs, threads replies, renders approvals as buttons                                                                                             |
| Route auth          | `agent/channels/eve.ts`                                                              | Channel          | Inbound auth for the eve route; the `localDevUser` shim upgrades the dev principal to a user so user-scoped connections work in the dev TUI                       |
| Agent runtime       | `agent/agent.ts` + `instructions.md`                                                 | Agent            | The model loop and behavior; orchestrates skills, tools, and the connections                                                                                      |
| Skills              | `agent/skills/<name>/`                                                               | Skill            | Task-specific guidance (Sanity, content modeling, Portable Text in/out, SEO/AEO, experimentation, writing quality), loaded on demand                              |
| Sanity access       | `agent/connections/sanity.ts`                                                        | Connection (MCP) | Query with GROQ, inspect schemas, create/edit drafts, manage releases as the signed-in user; destructive tools (`APPROVAL_REQUIRED_TOOLS`) are approval-gated     |
| Notion access       | `agent/connections/notion.ts`                                                        | Connection (MCP) | Search/read/write Notion as the signed-in user; update/move tools are approval-gated, page creation is not                                                        |
| Asset tools         | `agent/tools/{upload,list,get_asset_info,download,delete}_asset.ts`                  | Tools            | Store and manage files under `EVE_DATA_DIR/assets`, addressed by validated keys                                                                                   |
| User preferences    | `agent/tools/{get,save,clear}_user_preferences.ts` + `agent/lib/user-preferences.ts` | Tools            | Per-user standing preferences on disk, keyed to the resolved principal (never model input)                                                                        |
| Researcher subagent | `agent/subagents/researcher/`                                                        | Subagent         | Fresh-context web research for facts the project's content doesn't hold; uses framework `web_search`/`web_fetch`, returns cited findings + gaps                   |
| Reviewer subagent   | `agent/subagents/reviewer/`                                                          | Subagent         | Fresh-context, verdict-only review of a finished draft; loads the rubric from its own `writing-quality` skill copy, so the root passes only the draft and context |

Channels and the connections are I/O boundaries. Tools run in the app runtime (full `process.env`). Skills only add instructions to context; they are not an execution surface. The `researcher` and `reviewer` subagents each run in their own isolated child session — fresh context, none of the root's skills or connections — so the root passes what each needs in the call `message`. The reviewer is sent only the draft and any voice or audience context; it loads the rubric itself from its own copy of the `writing-quality` skill. That copy intentionally diverges from the root's where the root's version points at other root-only skills (e.g. `seo-aeo-best-practices`): the reviewer's copy declares those concerns out of scope instead.

## Data stores

- **Sanity** (external, user-owned): the CMS the copilot manages. All access goes through Sanity's MCP server; the agent never holds a shared Sanity credential and acts as each user via their own OAuth token.
- **Notion** (external, user-owned): the destination for long-form drafts and the source for briefs and reference material. Also per-user OAuth, no shared credential.
- **The asset store** (`<EVE_DATA_DIR>/assets`, defaulting to `./data/assets`): exported drafts, images, and attachments, addressed by key. Also holds per-user preferences under the reserved `user-preferences/<hashed-principal>.md` prefix, reachable only through the principal-scoped preference tools. Back up that one directory and the copilot's whole durable state moves with it.
- **The sandbox** (`/workspace/skills/...`): holds the seeded skill files the model reads. The reviewer subagent declares its own `sandbox.ts` because subagent sandboxes don't inherit from the root. Not a durable application data store.

There is no application database.

## External integrations

| Integration       | Purpose                                           | Method                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slack             | Chat surface (inbound events + outbound messages) | `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`, with the app's request URL at `/eve/v1/slack`                                                                                                                               |
| Sanity (MCP)      | Query, edit, and release CMS content              | MCP connection to `mcp.sanity.io` with an API token (`SANITY_API_TOKEN`)                                                                                                                                                |
| Notion (MCP)      | Read source material, write long-form drafts      | MCP connection to `mcp.notion.com` with a workspace integration token (`NOTION_API_KEY`)                                                                                                                                |
| Local filesystem  | File/asset storage                                | `node:fs/promises` under `EVE_DATA_DIR`, via `agent/lib/assets.ts`                                                                                                                                                      |
| Anthropic, OpenAI | Model access                                      | `@ai-sdk/anthropic` and `@ai-sdk/openai` called directly, reading `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`; the root model is set in `agent/agent.ts` and each subagent sets its own in `agent/subagents/<id>/agent.ts` |
| Docker            | Isolated runtime that holds seeded skill files    | `agent/sandbox.ts` and the reviewer's own `sandbox.ts` (`docker()` backend)                                                                                                                                             |

## Deployment & infrastructure

- **Platform:** any host that runs Node 24 and can reach a Docker daemon. `pnpm build` produces the deployable bundle.
- **Slack app:** install it in the workspace and point Event Subscriptions at `<your-host>/eve/v1/slack`.
- **Environment:** `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SANITY_API_TOKEN`, `NOTION_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and optionally `EVE_DATA_DIR`. `.env.example` lists all of them.
- **Storage:** `EVE_DATA_DIR` (default `./data`) must be writable and should outlive the process, so mount a volume rather than relying on a container's filesystem.
- **Local development:** `pnpm dev` runs the same runtime in a TUI, reading `.env.local`. The Slack surface needs a public URL, so use a tunnel or a deployment to exercise it.

## Security considerations

- **Inbound route auth** (`agent/channels/eve.ts`): `localDevUser` plus HTTP Basic, and the Basic credential is only registered when `EVE_API_PASSWORD` is set, so an unset variable leaves the route closed rather than accepting an empty password. Slack traffic is authenticated by the channel's signing secret and carries a per-user (`principalType: "user"`) principal. `localDevUser` defers the trust decision to the framework's `localDev()` and only upgrades the resolved dev principal to a user, so the principal-scoped preference tools work from the dev TUI without affecting production.
- **Outbound auth:** Sanity and Notion each authenticate with a static token read from the environment inside `getToken` (`SANITY_API_TOKEN`, `NOTION_API_KEY`), resolved per call and never exposed to the model. Both are shared rather than per-user, so scope each token to what the copilot actually needs. No credentials live in code, and `.env*` is gitignored except `.env.example`.
- **Human-in-the-loop:** irreversible tool actions (`delete_asset`, `clear_user_preferences`) are gated with `approval` from `eve/tools/approval`. The Sanity connection gates its destructive tools (`patch_documents`, `publish_documents`, `unpublish_documents`, `discard_drafts`, `version_discard`, `update_dataset`, `deploy_schema`, `deploy_studio`) and the Notion connection gates its update/move tools (`notion-update-pages`, `notion-move-pages`, `notion-update-data-source`, `notion-update-view`) with per-connection `approval` policies. Each renders as a Slack approve/deny button.
- **Input hardening:** asset keys are model-supplied and become real paths, so `agent/lib/assets.ts` matches every key against an anchored pattern and refuses anything else before a path is built; `../` and a leading slash never reach a `join`, and an invalid key is reported exactly like a missing file. No tool fetches a model-supplied URL, so there is no SSRF surface to allow-list.
- **Per-user isolation:** the preference tools derive their key from the resolved principal (`ctx.session.auth.current`), never from model input, so a session can only touch its own user's file; the id is hashed so the stored path carries no raw identifier. The general asset tools refuse the reserved `user-preferences/` prefix so they can't be used as a side channel. The files sit in the same data directory as everything else, so preferences are scoped within the copilot, not encrypted at rest.

## Development & testing

- **Runtime/TUI:** `pnpm dev` (eve dev TUI; `/model` links a provider).
- **Type checking:** `pnpm typecheck` (tsc).
- **Lint/format:** `pnpm check` / `pnpm fix` (Ultracite, a Biome preset; config in `biome.jsonc`).
- **Discovery diagnostics:** `npx eve info` (must report 0 errors / 0 warnings).
- There is no unit-test suite; verify behavior in the dev TUI.

## Future considerations

- Gating Notion page creation: `notion-create-pages` is currently ungated because drafting into Notion is the normal flow; add it to the Notion `APPROVAL_REQUIRED_TOOLS` if creation should confirm too. Notion's MCP server exposes no delete tool, so deletions happen in the Notion UI.
- A deterministic style checker (e.g. a banned-words lint tool reading the `writing-quality` references) to complement the reviewer's model-based judgment.
- Keeping the root's and the reviewer's `writing-quality` skill copies in step; today they are duplicated by hand, and only the documented divergence (root-only skill references) should differ.
- Richer Sanity release workflows: multi-document releases, scheduled publishing, and release review summaries beyond the current draft-then-approve loop.

## Glossary

- **eve:** the agent framework powering this app; discovers capabilities from `agent/`.
- **Channel:** an inbound/outbound surface (here, Slack, plus the eve route's auth config).
- **Connection:** an external server (MCP/OpenAPI) exposed to the model; tools are called as `connection__<name>__<tool>`. Here: `sanity` and `notion`.
- **Tool:** a typed action authored with `defineTool`, run in the app runtime.
- **Skill:** a load-on-demand Markdown procedure; the packaged form requires `description` frontmatter used for routing. Here: seven skills covering Sanity work, content modeling, Portable Text conversion and serialization, SEO/AEO, experimentation, and writing quality.
- **Subagent:** a declared agent under `agent/subagents/<id>/` that the root delegates to as a tool. It runs in its own fresh child session and inherits none of the root's skills, connections, or tools, so the root passes context in the call `message`. Here: `researcher` (web research) and `reviewer` (draft review, with its own skill copy and sandbox).
- **Asset key:** the identifier for a stored file, a relative path such as `drafts/post.md`. Validated against an anchored pattern in `agent/lib/assets.ts` before it becomes a real path.
- **`EVE_DATA_DIR`:** the single directory holding everything durable the copilot writes, defaulting to `./data`.
