<img width="100%" alt="eve Software Factory Banner" src=".github/banner.png" />

# eve Software Factory Template

[![Docs](https://img.shields.io/badge/Documentation-000?style=flat-square&logo=readthedocs&logoColor=FFF&labelColor=000&color=000)](https://ask-foreman.dev/docs)
[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

Meet **Foreman**, an eve software factory that puts AI agents on every stage of the development loop and keeps people on the judgment calls.

Foreman takes tasks from GitHub and Linear, moves each one through four stations, and delivers a reviewed draft pull request on your repository. You review, mark ready, and merge.

## How it works

- **Classifier** triages the task: type, priority, complexity, actionable or not. When the task isn't actionable, Foreman asks the requester instead of building the wrong thing.
- **Analyst** turns it into a plan with acceptance criteria, working from a live checkout of your repository.
- **Implementer** executes the plan in its own sandbox, verifies with your repo's own checks, and pushes a branch.
- **Reviewer** independently judges everything against the real diff, with evidence for each verdict.

Each station is its own agent with its own instructions, sandbox, and tools. The Reviewer sees only the pushed branch, never the Implementer's reasoning. Between runs, Foreman keeps a **factory brain**: notes about your repository that every run starts from. See [the pipeline](https://ask-foreman.dev/docs/pipeline) and [factory memory](https://ask-foreman.dev/docs/memory) for the full picture.

## How work arrives

- **Label an issue `factory`.** The pipeline runs on its own, posts progress as stations complete, and ends with a draft PR linked to the issue.
- **@mention it on an issue or PR.** Mentions from repo owners, members, and collaborators start an interactive session.
- **Delegate in Linear.** Linear Agent Sessions run the same pipeline and report progress back in Linear.
- **The dev TUI.** Hand it a task locally. Changes to GitHub wait for your approval.
- **Red CI on a factory PR.** Foreman diagnoses the failure and pushes a fix to its own branches, never yours.
- **Someone opens a pull request.** Foreman posts one orienting comment for reviewers: a summary, not a review.

## Requirements

Each station runs its work in a [microsandbox](https://www.npmjs.com/package/microsandbox) VM on the machine running the factory. That backend is not an arbitrary choice: it is one of only two that implement a domain-level firewall with credential brokering, which is what keeps `GITHUB_TOKEN` outside the sandbox. The token is attached to requests on their way out to `github.com`, so a station can clone, fetch, and push, but code running inside it never sees the secret. Docker's sandbox backend supports only `allow-all` and `deny-all` and cannot express this.

The trade is a narrower set of hosts than Node alone would need:

| Host                                             | Supported                                                  |
| ------------------------------------------------ | ---------------------------------------------------------- |
| macOS on Apple Silicon                           | Yes                                                        |
| Linux (glibc) with KVM                           | Yes — needs `/dev/kvm`, or `MSB_PATH` for a custom runtime |
| Linux without KVM                                | No                                                         |
| Alpine and other musl-based Linux                | No                                                         |
| macOS on Intel, Windows                          | No                                                         |
| Serverless platforms (Vercel, Lambda, Cloud Run) | No — none of them expose KVM                               |

On an unsupported host the process still starts; the first turn that needs a sandbox fails with the reason named, for example `The microsandbox sandbox backend supports Linux with KVM or macOS on Apple Silicon. Current host is linux/x64.` If you must run where microsandbox cannot, move to a host that supports it or switch the four `sandbox.ts` files to `vercel()` from `eve/sandbox/vercel`. Do not switch them to `docker()` and pass the token in through an authenticated remote URL, a credential helper, or `env`: any of those puts the secret where `echo $GITHUB_TOKEN` inside a station reveals it, which is the whole thing this design prevents.

Two practical notes. Each sandbox is sized at 4 vCPUs and 4 GiB in `agent/lib/github/repo-sandbox.ts`, and the root plus three stations can be live at once, so lower those numbers on a smaller machine. And the `microsandbox` npm package installs with the rest of the dependencies, but its VM runtime is separate: `pnpm dev` installs it the first time, while a production process installs nothing and fails with the command to run instead.

## Deploy

Every integration reads a plain environment variable, so the factory runs on any host that meets the requirements above. Register a GitHub App for the factory, install it on `FACTORY_REPO` with write access to contents, issues, and pull requests, and point its webhook at `<your-agent-url>/eve/v1/github`. Point a Linear webhook at `<your-agent-url>/eve/v1/linear`. Then fill in `.env` from `.env.example` and build with `eve build`.

Two things must line up before the first build can finish. `FACTORY_REPO` must name a real repository in `owner/repo` format, and `GITHUB_TOKEN` must reach it. The build clones `FACTORY_REPO` up front to prewarm the station sandboxes, so a repository the token cannot reach fails with a `Cannot access <owner/repo>` error; fix the access (or the value), then build again.

Configuration (see `.env.example`):

| Variable                                                                                 | Required | Default           | What it does                                                                                                                       |
| ---------------------------------------------------------------------------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `FACTORY_REPO`                                                                           | Yes      | —                 | An existing GitHub repository in `owner/repo` format; the selected GitHub App must have access to it (the deploy fails otherwise)  |
| `FACTORY_SETUP_COMMAND`                                                                  | No       | —                 | Runs once inside the sandbox checkout at build time (e.g. `pnpm install`), so every run starts with dependencies already installed |
| `FACTORY_LABEL`                                                                          | No       | `factory`         | The issue label that hands an issue to the factory                                                                                 |
| `FACTORY_BRANCH_PREFIX`                                                                  | No       | `factory/`        | Branch prefix marking the factory's own PRs, which are the only branches automated CI fixes touch                                  |
| `FACTORY_BOT_NAME`                                                                       | No       | `GITHUB_APP_SLUG` | The `@mention` name; falls back to the GitHub App's slug                                                                           |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_SLUG` / `GITHUB_WEBHOOK_SECRET` | Yes      | —                 | The GitHub App the channel verifies webhooks with and replies as                                                                   |
| `GITHUB_TOKEN`                                                                           | Yes      | —                 | Token the GitHub tools and the station git helpers act with                                                                        |
| `LINEAR_AGENT_ACCESS_TOKEN` / `LINEAR_WEBHOOK_SECRET`                                    | Yes      | —                 | App-scoped Linear token, shared by the channel and the MCP connection, plus its webhook secret                                     |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`                                                   | Yes      | —                 | Model provider keys; see `agent/lib/models.ts` for which station uses which                                                        |
| `EVE_DATA_DIR`                                                                           | No       | `./data`          | Where preferences, the factory brain, and handoff artifacts are stored. Use a mounted volume to survive a redeploy                 |

## Local development

Fill in the environment and start the TUI:

```bash
cp .env.example .env
pnpm dev
```

The first `pnpm dev` on a new machine also installs the microsandbox VM runtime, so it takes noticeably longer than later runs.

Hand the agent a task ("users report the password reset email arrives twice, fix it") and watch the four stations fire in order, ending in a draft PR on `FACTORY_REPO`. Local runs are treated as untrusted, so changes to GitHub wait for your approval in the TUI.

## Resources

- [Foreman Docs](https://ask-foreman.dev/docs)
- [eve Documentation](https://eve.dev/docs/introduction)
- [GitHub Tools eve Extension](https://github-tools.com/frameworks/eve-extension)

## Explore more templates

- [eve Marketing Team](https://vercel.com/templates/eve/eve-marketing-team)
- [eve Personal Agent](https://vercel.com/templates/nuxt/eve-personal-agent)
- [eve Sanity Copilot](https://vercel.com/templates/eve/eve-sanity-copilot)
