---
"eve": patch
---

Scaffolded projects now install the framework under the published `@stack256org/openeve` name, aliased to `eve` so every `import ... from "eve/..."` keeps working unchanged. Projects created with a workspace protocol, a tarball path, or any other explicit specifier are left as-is.
