import { randomUUID } from "node:crypto";

import { openSqliteStore, type SqliteStore } from "#internal/storage/sqlite-store.js";
import type { Lock, QueueEntry, StateAdapter } from "#compiled/chat/index.js";

/** Location of the shared database backing {@link sqliteState}. */
export interface SqliteStateOptions {
  /** Application root holding `data/openeve.db`. Defaults to `process.cwd()`. */
  readonly appRoot?: string;
}

const encode = (value: unknown): string => JSON.stringify(value ?? null);

/** Creates a Chat SDK state adapter stored in the shared `data/openeve.db`. */
export function sqliteState(options: SqliteStateOptions = {}): StateAdapter {
  const appRoot = options.appRoot ?? process.cwd();
  let store: SqliteStore | undefined;
  const db = () => (store ??= openSqliteStore({ appRoot })).db;
  const expiry = (ttlMs: number | undefined) => (ttlMs ? Date.now() + ttlMs : null);

  const sweepQueue = (threadId: string) => {
    db()
      .prepare("DELETE FROM channel_queues WHERE thread_id = ? AND json_extract(entry, ?) <= ?")
      .run(threadId, "$.expiresAt", Date.now());
  };

  return {
    async connect() {
      db();
    },
    async disconnect() {
      store?.close();
      store = undefined;
    },

    async subscribe(threadId: string) {
      db()
        .prepare("INSERT OR IGNORE INTO channel_subscriptions (thread_id) VALUES (?)")
        .run(threadId);
    },
    async unsubscribe(threadId: string) {
      db().prepare("DELETE FROM channel_subscriptions WHERE thread_id = ?").run(threadId);
    },
    async isSubscribed(threadId: string) {
      const row = db()
        .prepare("SELECT 1 FROM channel_subscriptions WHERE thread_id = ?")
        .get(threadId);
      return row !== undefined;
    },

    async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
      const now = Date.now();
      const lock = { expiresAt: now + ttlMs, threadId, token: randomUUID() };
      // Reading the holder and taking the lock must be one statement: with two
      // of these racing, the conditional upsert lets exactly one report a write.
      const { changes } = db()
        .prepare(
          `INSERT INTO channel_locks (thread_id, token, expires_at) VALUES (?, ?, ?)
             ON CONFLICT(thread_id) DO UPDATE
               SET token = excluded.token, expires_at = excluded.expires_at
               WHERE channel_locks.expires_at <= ?`,
        )
        .run(threadId, lock.token, lock.expiresAt, now);
      return changes === 0 ? null : lock;
    },
    async extendLock(lock: Lock, ttlMs: number) {
      const now = Date.now();
      // UPDATE, never INSERT: a lock that lapsed or was force-released and
      // re-taken must not come back to life under the previous holder's token.
      const { changes } = db()
        .prepare(
          "UPDATE channel_locks SET expires_at = ? WHERE thread_id = ? AND token = ? AND expires_at > ?",
        )
        .run(now + ttlMs, lock.threadId, lock.token, now);
      return changes > 0;
    },
    async releaseLock(lock: Lock) {
      db()
        .prepare("DELETE FROM channel_locks WHERE thread_id = ? AND token = ?")
        .run(lock.threadId, lock.token);
    },
    async forceReleaseLock(threadId: string) {
      db().prepare("DELETE FROM channel_locks WHERE thread_id = ?").run(threadId);
    },

    async get<T>(key: string): Promise<T | null> {
      const row = db()
        .prepare(
          "SELECT value FROM channel_kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)",
        )
        .get(key, Date.now()) as { value: string } | undefined;
      return row === undefined ? null : (JSON.parse(row.value) as T);
    },
    async set(key: string, value: unknown, ttlMs?: number) {
      db()
        .prepare(
          `INSERT INTO channel_kv (key, value, expires_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
        )
        .run(key, encode(value), expiry(ttlMs));
    },
    async setIfNotExists(key: string, value: unknown, ttlMs?: number) {
      const { changes } = db()
        .prepare(
          `INSERT INTO channel_kv (key, value, expires_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
               WHERE channel_kv.expires_at IS NOT NULL AND channel_kv.expires_at <= ?`,
        )
        .run(key, encode(value), expiry(ttlMs), Date.now());
      return changes > 0;
    },
    async delete(key: string) {
      db().prepare("DELETE FROM channel_kv WHERE key = ?").run(key);
    },

    async appendToList(
      key: string,
      value: unknown,
      options?: { maxLength?: number; ttlMs?: number },
    ) {
      const now = Date.now();
      const database = db();
      database
        .prepare(
          "DELETE FROM channel_lists WHERE key = ? AND expires_at IS NOT NULL AND expires_at <= ?",
        )
        .run(key, now);
      database
        .prepare(
          `INSERT INTO channel_lists (key, seq, value, expires_at)
             SELECT ?, COALESCE(MAX(seq), 0) + 1, ?, ? FROM channel_lists WHERE key = ?`,
        )
        .run(key, encode(value), expiry(options?.ttlMs), key);
      if (options?.maxLength !== undefined) {
        database
          .prepare(
            `DELETE FROM channel_lists WHERE key = ?
               AND seq NOT IN (SELECT seq FROM channel_lists WHERE key = ? ORDER BY seq DESC LIMIT ?)`,
          )
          .run(key, key, options.maxLength);
      }
      database
        .prepare("UPDATE channel_lists SET expires_at = ? WHERE key = ?")
        .run(expiry(options?.ttlMs), key);
    },
    async getList<T>(key: string): Promise<T[]> {
      const rows = db()
        .prepare(
          `SELECT value FROM channel_lists WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
             ORDER BY seq`,
        )
        .all(key, Date.now()) as { value: string }[];
      return rows.map((row) => JSON.parse(row.value) as T);
    },

    async enqueue(threadId: string, entry: QueueEntry, maxSize: number) {
      sweepQueue(threadId);
      const database = db();
      database
        .prepare(
          `INSERT INTO channel_queues (thread_id, seq, entry)
             SELECT ?, COALESCE(MAX(seq), 0) + 1, ? FROM channel_queues WHERE thread_id = ?`,
        )
        .run(threadId, encode(entry), threadId);
      database
        .prepare(
          `DELETE FROM channel_queues WHERE thread_id = ?
             AND seq NOT IN (SELECT seq FROM channel_queues WHERE thread_id = ? ORDER BY seq DESC LIMIT ?)`,
        )
        .run(threadId, threadId, maxSize);
      const depth = database
        .prepare("SELECT count(*) AS depth FROM channel_queues WHERE thread_id = ?")
        .get(threadId) as { depth: number };
      return depth.depth;
    },
    async dequeue(threadId: string): Promise<QueueEntry | null> {
      sweepQueue(threadId);
      const row = db()
        .prepare(
          `DELETE FROM channel_queues WHERE thread_id = ?
             AND seq = (SELECT MIN(seq) FROM channel_queues WHERE thread_id = ?) RETURNING entry`,
        )
        .get(threadId, threadId) as { entry: string } | undefined;
      return row === undefined ? null : (JSON.parse(row.entry) as QueueEntry);
    },
    async queueDepth(threadId: string) {
      sweepQueue(threadId);
      const row = db()
        .prepare("SELECT count(*) AS depth FROM channel_queues WHERE thread_id = ?")
        .get(threadId) as { depth: number };
      return row.depth;
    },
  };
}
