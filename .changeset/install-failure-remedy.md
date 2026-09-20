---
"eve": patch
---

`eve init` now explains how to fix an install that npm rejects with `EALLOWSCRIPTS`. npm's own message points at `package.json` and `.npmrc`, but the setting that breaks a project-scoped install is the user-level one; the CLI now names the command that removes it.
