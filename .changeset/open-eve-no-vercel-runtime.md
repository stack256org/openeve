---
"eve": patch
---

Vendored Vercel code no longer loads on deployments that do not use Vercel. The Vercel Blob memory client, the OIDC token reader, and the `@vercel/otel` registrar are now loaded on first use rather than at import time, and a new `check:no-vercel-runtime` build step fails the build if a runtime module imports them statically again.
