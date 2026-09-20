# Architecture

## Project identification

- Name is **eve-sre-agent-template**.
- License is MIT.
- Maintained by Vercel Labs.
- Built on the [eve](https://eve.dev) agent framework.

## Overview

sre is a Slack incident response agent. It investigates production issues with evidence from Datadog, GitHub, and Slack. Investigations start from a Slack mention or direct message, from a watched channel message, or from a `POST /v1/investigate` webhook call. The agent records typed evidence for each finding and renders it in the Slack reply.

## Directory map

```text
agent/
  agent.ts            Model, context window, and reasoning configuration
  channels/           Trigger surfaces
    slack.ts          Mentions, DMs, and channel watch (optional)
    webhook.ts        POST /v1/investigate
    eve.ts            Local development channel
  connections/        Datadog MCP connection
  extensions/         GitHub tools extension
  instructions/       System instructions and date context
  tools/              Evidence, Slack read, watch, and skill tools
  skills/             Built-in investigation skills
    custom.ts         Custom skills loader (optional, needs EVE_DATA_DIR)
  lib/                Shared logic
    auth.ts           Slack user auth helpers
    object-store.ts   Key-validated file object store
    evidence.ts       Investigation evidence state and rendering
    channel-watch/    Watchlist store and admission (optional, needs EVE_DATA_DIR)
    skills/           Custom skill store (optional, needs EVE_DATA_DIR)
    slack/            Message parsing and investigation rendering
    webhook/          Webhook auth, request parsing, and session logic
```

Channel watch and custom skills are optional. Both write files under `EVE_DATA_DIR` (default `./data`). The rest of the agent works without it.

## Core components

| Component        | Location                    | Purpose                                                        |
| ---------------- | --------------------------- | -------------------------------------------------------------- |
| Agent definition | `agent/agent.ts`            | Selects the model and reasoning effort.                        |
| Slack channel    | `agent/channels/slack.ts`   | Handles mentions, DMs, and watched channel messages.           |
| Webhook channel  | `agent/channels/webhook.ts` | Accepts `POST /v1/investigate` and starts Slack runs.          |
| Instructions     | `agent/instructions/`       | Defines identity, rules, and tool guidance.                    |
| Evidence system  | `agent/lib/evidence.ts`     | Records findings and renders them for agent and Slack replies. |
| Channel watch    | `agent/lib/channel-watch/`  | Admits top-level messages from watched channels.               |
| Custom skills    | `agent/lib/skills/`         | Stores user and global runbooks on disk.                       |
| Datadog site     | `agent/lib/constants.ts`    | Resolves the Datadog MCP host from `DD_SITE`.                  |
