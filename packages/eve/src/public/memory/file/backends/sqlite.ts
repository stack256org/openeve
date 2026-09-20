import { randomUUID } from "node:crypto";

import { openSqliteStore } from "#internal/storage/sqlite-store.js";
import {
  MemoryDocumentConflictError,
  type MemoryDocumentBackend,
} from "#public/memory/file/backend.js";

/** Location of the shared database backing {@link sqlite}. */
export interface SqliteMemoryBackendOptions {
  /** Application root holding `data/openeve.db`. Defaults to `process.cwd()`. */
  readonly appRoot?: string;
}

/** Creates a document backend stored in the shared `data/openeve.db`. */
export function sqlite(options: SqliteMemoryBackendOptions = {}): MemoryDocumentBackend {
  const appRoot = options.appRoot ?? process.cwd();
  const instanceId = randomUUID();
  let revision = 0;

  // A document backend has no lifecycle hook to close a connection on, so each
  // operation owns its handle. Holding one open for the life of the backend
  // leaks a handle per instance, and on Windows the open file cannot be
  // deleted — the directory stays locked for as long as the process runs.
  const withStore = <T>(use: (db: ReturnType<typeof openSqliteStore>["db"]) => T): T => {
    const store = openSqliteStore({ appRoot });
    try {
      return use(store.db);
    } finally {
      store.close();
    }
  };

  return {
    async read({ key, signal }) {
      signal.throwIfAborted();
      return withStore((db) => {
        const row = db
          .prepare("SELECT content, version FROM memory_documents WHERE key = ?")
          .get(key) as { content: string; version: string } | undefined;
        return row === undefined ? null : { content: row.content, version: row.version };
      });
    },
    async write({ content, expectedVersion, key, signal }) {
      signal.throwIfAborted();
      const version = `sql_${instanceId}_${++revision}`;
      const changes = withStore((db) =>
        // One statement per branch so the compare-and-set is atomic in SQLite.
        expectedVersion === null
          ? db
              .prepare(
                "INSERT OR IGNORE INTO memory_documents (key, content, version) VALUES (?, ?, ?)",
              )
              .run(key, content, version).changes
          : db
              .prepare(
                "UPDATE memory_documents SET content = ?, version = ? WHERE key = ? AND version = ?",
              )
              .run(content, version, key, expectedVersion).changes,
      );
      if (changes === 0) throw new MemoryDocumentConflictError(key);
      return { content, version };
    },
  };
}
