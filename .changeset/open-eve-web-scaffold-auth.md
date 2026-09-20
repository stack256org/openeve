---
"eve": patch
---

The Web Chat app that `eve init` scaffolds now starts and authenticates off Vercel. The generated channel registers HTTP Basic from `EVE_API_PASSWORD` instead of `vercelOidc()`, which never matches on a non-Vercel host, and registers it only when the password is set. The authenticated variant signs users in with email and password through Better Auth (12-character minimum, generic sign-in errors), takes an optional social provider from `AUTH_SOCIAL_PROVIDER`/`AUTH_SOCIAL_CLIENT_ID`/`AUTH_SOCIAL_CLIENT_SECRET`, and reads its public URL from `BETTER_AUTH_URL` with the `VERCEL_*` variables kept as extra sources, so it no longer throws `No trusted deployment hosts are configured` at startup outside Vercel.
