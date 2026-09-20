---
"eve": patch
---

The framework now recognizes itself when installed under an npm alias (`"eve": "npm:@stack256org/openeve@^x.y.z"`), where the manifest carries the published name but every import specifier still reads `eve`. Package-root resolution, workflow module specifiers, and authored-module detection all accept either name and keep emitting `eve`.
