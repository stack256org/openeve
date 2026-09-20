---
"eve": patch
---

Fixes durable workflow execution when the framework is installed under the `eve` alias. Workflow ids were built from the installed manifest name while the bundler registered them under the import specifier, so every turn failed with `WorkflowNotRegisteredError`.
