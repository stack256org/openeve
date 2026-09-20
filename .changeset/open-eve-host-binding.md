---
"eve": patch
---

An authored `host` in `agent/agent.ts` now governs runtime behavior. The compiled manifest's host is published to the process at cold start, so the call sites that previously read `process.env.VERCEL` resolve the authored value first and fall back to the environment only when nothing was authored.
