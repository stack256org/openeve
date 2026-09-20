---
"eve": patch
---

`eve init` no longer corrupts a `pnpm-workspace.yaml` whose `packages:` list is written inline (`packages: []`). It previously matched only the block form and appended a second `packages:` key, leaving the manifest with a duplicate key; the inline sequence is now rewritten as a block, and a value that cannot be rewritten faithfully is left untouched.
