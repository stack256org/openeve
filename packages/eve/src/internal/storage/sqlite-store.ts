import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { resolveDataDirectory } from "#internal/storage/data-directory.js";

/** Open handle to the shared open-eve database. */
export interface SqliteStore {
  readonly db: DatabaseSync;
  close(): void;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS memory_documents (
     key TEXT PRIMARY KEY,
     content TEXT NOT NULL,
     version TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS channel_subscriptions (thread_id TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS channel_locks (
     thread_id TEXT PRIMARY KEY,
     token TEXT NOT NULL,
     expires_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS channel_kv (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     expires_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS channel_lists (
     key TEXT NOT NULL,
     seq INTEGER NOT NULL,
     value TEXT NOT NULL,
     expires_at INTEGER,
     PRIMARY KEY (key, seq)
   )`,
  `CREATE TABLE IF NOT EXISTS channel_queues (
     thread_id TEXT NOT NULL,
     seq INTEGER NOT NULL,
     entry TEXT NOT NULL,
     PRIMARY KEY (thread_id, seq)
   )`,
] as const;

/**
 * Opens `data/openeve.db`, creating the directory and schema on first use.
 *
 * `node:sqlite` is Stability 1.2 on the supported Node floor, so every import
 * of it is confined to this module: swapping the driver stays a one-file change.
 */
export function openSqliteStore(input: { readonly appRoot: string }): SqliteStore {
  const directory = resolveDataDirectory(input.appRoot);
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "openeve.db"));
  // Before WAL: switching journal mode takes an exclusive lock, so a second
  // process opening the same database concurrently fails with SQLITE_BUSY
  // unless this connection is already willing to wait for it.
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  for (const statement of SCHEMA) db.exec(statement);
  return {
    db,
    close() {
      db.close();
    },
  };
}
