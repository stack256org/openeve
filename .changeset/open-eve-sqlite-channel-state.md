---
"eve": patch
---

Linq and Photon iMessage channels now keep their Chat SDK state — thread locks,
message queues, subscriptions, and cached values — in the local SQLite database
at `data/openeve.db` instead of in process memory, so a restart no longer drops
queued messages or subscriptions and two workers cannot run the same thread at
once.
