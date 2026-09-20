---
"eve": patch
---

Agents now store file memory in a local SQLite database at `data/openeve.db`
instead of failing outside Vercel and `eve dev`. `fileMemory()` picks the new
`sqlite()` backend automatically when no backend is configured, so a
self-hosted deployment works with no setup. The database is opened through
Node's built-in `node:sqlite`, so nothing is added to your install.
