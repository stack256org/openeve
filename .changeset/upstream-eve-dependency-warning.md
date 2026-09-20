---
"eve": patch
---

`eve init` now warns when the target already declares an `eve` dependency that installs the upstream package, naming the alias specifier to replace it with. The dependency key is `eve` for open-eve and upstream alike, so nothing downstream could tell them apart. Scaffolded projects also explain the alias in their README.
