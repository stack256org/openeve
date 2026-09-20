# Mux Video Agent for eve

An [eve](https://eve.dev) agent template and reusable extension for working with video through Mux. Create and inspect assets, make clips, and run supported Mux Robots workflows from a durable agent that is ready to deploy on Vercel.

> **Mux Robots powers the AI workflows in this template.** [Explore Mux Robots](https://www.mux.com/docs/guides/robots) to summarize, moderate, caption, translate, and structure videos through one API.

> **This template includes a live eval suite.** [See how the agent is evaluated](./EVALUATIONS.md) across two assets and two models using efficacy, efficiency, and expense.

## Quick Start

Before you begin, install Node.js 24 or newer and pnpm 10. You will also need a Mux access token with Video access and access to the Robots workflows you plan to use.

Install dependencies and create your local environment file:

```bash
pnpm install
cp .env.example .env.local
```

Add your AI Gateway and Mux credentials to `.env.local`:

```bash
AI_GATEWAY_API_KEY=...
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
```

Start the development server:

```bash
pnpm dev
```

The agent runs at `http://127.0.0.1:2000`. The local development identity is accepted only while `eve dev` is running.

Try one of these prompts:

- `Create a test asset from https://storage.googleapis.com/muxed/leds.mp4 and generate English subtitles.`
- `Inspect Mux asset ASSET_ID and show me its ready caption tracks.`
- `Summarize ASSET_ID for a developer audience.`
- `Create a public clip of ASSET_ID from 12.5 seconds to 28 seconds.`

## What Is Included

This repository includes two ways to use the integration:

- A root eve agent that is ready to build and deploy on Vercel.
- [`@mux/eve-video`](./packages/eve-video), the same capabilities packaged as an eve extension for existing agents.

Both include tools to:

- Create a Mux Video asset from an HTTP or HTTPS media URL.
- Generate baseline subtitles during asset creation.
- Inspect asset status, tracks, metadata, and public playback URLs by asset ID.
- Create a new clip from an exact range in an existing asset.
- Start and retrieve these Mux Robots workflows:
  - Summarize
  - Ask Questions
  - Generate Chapters
  - Find Scenes
  - Find Key Moments
  - Find Best Thumbnails
  - Moderate
  - Translate Captions
  - Generate Premium Captions
  - Edit Captions

Asset creation, clip creation, and Robots job creation require explicit human approval in eve. The root agent also disables the generic shell, file, web-fetch, web-search, and self-delegation tools to keep the deployed template's runtime surface narrow.

## What Is Not Included

This template intentionally excludes multimodal embeddings, catalog search, within-video frame or shot search, and suggested semantic-search queries. Those capabilities are not ready for external API consumption, so the agent and extension do not expose placeholder or private integrations for them.

Slack and other channel-specific private file downloads are also intentionally excluded. A consuming channel should verify the attachment and stage or upload the bytes from trusted server-side code, then pass the resulting Mux asset ID to these tools. Never give the model a Slack token or private download URL.

## Deploy to Vercel

Link the repository to a Vercel project and deploy it with eve:

```bash
pnpm exec eve link
pnpm exec eve deploy
```

Add `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` to the Vercel project before running a Mux tool. The default model uses Vercel project OIDC in deployments, so a separate provider key is not required there.

After deployment, check the health route and connect the local eve client to the deployed agent:

```bash
curl https://YOUR_DEPLOYMENT/eve/v1/health
pnpm exec eve dev https://YOUR_DEPLOYMENT
```

The HTTP session routes accept Vercel OIDC in production and local development identity under `eve dev`. They do not accept anonymous production traffic. Replace or extend [`agent/channels/eve.ts`](./agent/channels/eve.ts) when embedding the agent in an application with its own user authentication.

## Add the Extension to Another Agent

After the package is published, install it in an existing eve project:

```bash
pnpm add @mux/eve-video
```

Mount it under any namespace, with Mux credentials held in the consuming agent's environment:

```ts
// agent/extensions/mux_video.ts
import muxVideo from "@mux/eve-video";

export default muxVideo({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});
```

Mounting the extension as `mux_video.ts` exposes tools such as `mux_video__get_asset`, `mux_video__create_asset`, and `mux_video__run_workflow`. The consuming agent keeps control of its model, sandbox, authentication, channels, and approval overrides.

While developing in this repository, the root agent mounts the workspace package from [`agent/extensions/mux_video.ts`](./agent/extensions/mux_video.ts).

## Agent Code

The root agent model and limits are configured in [`agent/agent.ts`](./agent/agent.ts). Its behavior is defined in [`agent/instructions.md`](./agent/instructions.md), and the Mux extension is mounted from [`agent/extensions/mux_video.ts`](./agent/extensions/mux_video.ts).

Set `MUX_VIDEO_AGENT_MODEL` to override the default `openai/gpt-5.6-luna` model locally or in a deployment. The reusable extension source lives under [`packages/eve-video`](./packages/eve-video).

## Verify

Run the full local verification suite:

```bash
pnpm verify
```

This runs TypeScript checks, focused extension tests, the extension build, the eve production build, and eval discovery.

## Evaluate

The live eve eval suite covers end-to-end summarization, including completed title, description, and tag outputs, across two asset fixtures and two agent models. It records efficacy, efficiency, and expense without introducing uncalibrated semantic-quality gates.

Evaluate both fixtures against any model available through your configured Vercel AI Gateway credentials without changing the source:

```bash
pnpm eval:models -- --model spacexai/grok-4.6
```

The `--model` option runs only that model and can be repeated to define a custom matrix. See [`EVALUATIONS.md`](./EVALUATIONS.md) for the framework, required asset environment variables, default two-model matrix, and command costs. `pnpm eval:models` creates four live Mux Robots jobs by default, while a single `--model` creates two, so use `pnpm eval:list` when you only want to verify discovery.

## Architecture Boundary

The eve runtime owns the durable agent session, human approvals, and deployment runtime. The extension makes bounded calls to Mux Video and Mux Robots with credentials held in the trusted application runtime. It does not store media, run its own transcoder, expose credentials to the model, or become a second media backend.
