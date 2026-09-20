# Working on this template

This repository is a generic, Slack-only design-agent template built with Eve.

- Read `node_modules/eve/docs/` before changing Eve APIs.
- Keep runtime knowledge closed to the approved files under `knowledge/`.
- Keep the runtime read-only: no shell, file writes, web access, connections, or delegation.
- The corpus is served from a Docker sandbox (`agent/sandbox/sandbox.ts`) with `networkPolicy: "deny-all"`. Running or building the agent needs a reachable Docker daemon, and the deny-all policy must stay.
- Do not add organization-specific names, rules, links, tokens, or examples.
- Pin dependency versions exactly.
- Run `pnpm check` before opening a pull request.
- Update `BOOTSTRAP.md`, `REFRESH.md`, and `README.md` when setup behavior changes.
