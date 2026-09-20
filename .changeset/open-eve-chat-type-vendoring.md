---
"eve": patch
---

The vendored `chat` type declarations resolve for the first time. Only one of chat's two content-hashed declaration chunks was being copied, so every type re-exported through the other one — `StateAdapter`, `Lock`, `QueueEntry`, `Message`, `Thread`, `Author` — silently degraded to `any`. Code touching the Chat SDK is now type-checked against the real contract.
