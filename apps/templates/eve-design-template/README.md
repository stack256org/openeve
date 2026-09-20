# Eve design agent template

A Slack design agent that answers from your approved design guidelines.

> Experimental: this template uses Eve preview APIs pinned to `0.27.3`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?env=ANTHROPIC_API_KEY%2CSLACK_BOT_TOKEN%2CSLACK_SIGNING_SECRET&envDescription=Your%20Anthropic%20API%20key%2C%20plus%20the%20bot%20token%20and%20signing%20secret%20from%20your%20Slack%20app.&envLink=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Feve-design-template%2Fblob%2Fmain%2Fdocs%2Fslack-setup.md&repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Feve-design-template%2Ftree%2Fmain)

## What it does

- Answers Slack DMs.
- Answers channel messages only when mentioned.
- Reads a reviewed design corpus committed to your repository.
- Uses message text, images, and documents as temporary context.
- Labels general recommendations when enabled.
- Flags equal-priority conflicts. In channels, it mentions your design owner.

It cannot search Slack or the web, change its corpus, edit artifacts, generate websites, or deploy projects.

Each DM or top-level mention starts a conversation. Continue in its reply thread. Channel replies must mention the agent again.

## Before you deploy

You need:

- A Node.js 24 host that can serve HTTPS. Any VPS, container platform, or Vercel.
- An Anthropic API key.
- Permission to create a Slack app in your workspace.
- A design owner and their Slack member ID.
- Existing design guidance, or a design owner who can create it with the bootstrap interview.
- A private repository if the guidance is private.

## Set up

1. Clone this repository.
2. Install Node.js 24 and pnpm 10, then run `pnpm install`.
3. Create your Slack app and collect its credentials — see [`docs/slack-setup.md`](./docs/slack-setup.md).
4. Copy `.env.example` to `.env.local` and fill in `ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, and `SLACK_SIGNING_SECRET`.
5. Open the repository in Codex, Claude Code, Conductor, or another coding agent.
6. Send:

   > Follow `BOOTSTRAP.md` and help me set up this design agent. Ask one small batch of questions at a time. Do not approve or publish the corpus for me.

7. Review the approval packet from `BOOTSTRAP.md` and explicitly approve the corpus.
8. Commit and push to `main`, then deploy with the same three variables set in your host's environment.

Until approval, the agent replies:

> Design-agent setup is incomplete. Run the bootstrap workflow and approve the generated design corpus.

## Check the setup

```bash
pnpm run setup
pnpm run setup --url https://<production-domain>
```

Without `--url` the script reports which required environment variables are missing and whether the corpus is approved. With `--url` it also confirms the Eve health route reports ready and that an unsigned Slack request is rejected.

## Knowledge

- `knowledge/sources/`: immutable source snapshots.
- `knowledge/guidelines/`: concise, actionable rules.
- `knowledge/manifest.json`: identity, ownership, provenance, precedence, access, and approval.
- [`BOOTSTRAP.md`](./BOOTSTRAP.md): first-time knowledge setup.
- [`REFRESH.md`](./REFRESH.md): reviewed knowledge updates.

The corpus is bundled at build time. Runtime conversations and attachments never change it.

## Develop

Requires Node.js 24 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Run the full check:

```bash
pnpm check
```

Other commands:

```bash
pnpm verify:knowledge
pnpm test
pnpm type-check
pnpm build
pnpm run info
```

Set `DESIGN_AGENT_MODEL` to override the default model, `claude-sonnet-4.6`. The agent calls Anthropic directly with `ANTHROPIC_API_KEY`; no gateway sits in between.

## Runtime safety

The agent can read and search only its bundled corpus. Shell, file writes, web access, delegation, todo management, and sandbox network access are disabled. Slack is its only integration.

## License

MIT
