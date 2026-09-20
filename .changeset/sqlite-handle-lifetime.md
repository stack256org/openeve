---
"eve": patch
---

The SQLite memory backend no longer keeps a database handle open for the life of the backend. Each read and write owns its connection, so a process creating several backends no longer leaks one handle apiece, and on Windows the database file can be deleted while the process is still running.
