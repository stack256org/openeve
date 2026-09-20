---
"eve": patch
---

The authored `host` now governs the default file-memory backend. Selecting Vercel Blob previously read `process.env.VERCEL` directly, so `host: vercel()` alone did not move memory to Blob on a machine where that variable was unset.
