import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Message, type Lock, type QueueEntry, type StateAdapter } from "#compiled/chat/index.js";
import { sqliteState } from "#public/channels/chat-sdk/state/sqlite.js";

function entry(text: string, expiresAt = Date.now() + 60_000): QueueEntry {
  return {
    enqueuedAt: Date.now(),
    expiresAt,
    message: new Message({
      // `Message.toJSON()` dereferences `attachments` and `metadata.dateSent`,
      // so a serializing adapter only ever sees messages carrying both.
      attachments: [],
      author: { fullName: "Alice", isBot: false, isMe: false, userId: "alice", userName: "alice" },
      formatted: { children: [], type: "root" },
      id: text,
      metadata: { dateSent: new Date("2026-01-01T00:00:00.000Z"), edited: false },
      raw: {},
      text,
      threadId: "thread",
    }),
  };
}

async function acquire(state: StateAdapter, threadId: string, ttlMs = 60_000): Promise<Lock> {
  const lock = await state.acquireLock(threadId, ttlMs);
  if (lock === null) throw new Error(`expected to acquire the lock on ${threadId}`);
  return lock;
}

describe("sqliteState", () => {
  let appRoot: string;
  let opened: StateAdapter[];

  // Every adapter holds its database open until `disconnect()`. Windows refuses
  // to unlink an open file, so the temp directory only goes away once each one
  // this test created has been closed.
  const openState = (): StateAdapter => {
    const adapter = sqliteState({ appRoot });
    opened.push(adapter);
    return adapter;
  };

  beforeEach(async () => {
    appRoot = await mkdtemp(join(tmpdir(), "openeve-state-"));
    opened = [];
  });
  afterEach(async () => {
    for (const adapter of opened) await adapter.disconnect();
    await rm(appRoot, { force: true, recursive: true });
  });

  it("grants a lock once and refuses a second holder until release", async () => {
    const state = openState();
    const first = await acquire(state, "t1");
    await expect(state.acquireLock("t1", 60_000)).resolves.toBeNull();
    await state.releaseLock(first);
    await expect(state.acquireLock("t1", 60_000)).resolves.not.toBeNull();
  });

  it("arbitrates the lock in the database, not in adapter memory", async () => {
    const [first, second] = await Promise.all([
      openState().acquireLock("t1", 60_000),
      openState().acquireLock("t1", 60_000),
    ]);
    expect([first, second].filter((lock) => lock !== null)).toHaveLength(1);
  });

  it("hands an elapsed lock to the next caller and refuses the old token", async () => {
    const state = openState();
    const elapsed = await acquire(state, "t1", 0);
    const next = await acquire(state, "t1");
    expect(next.token).not.toBe(elapsed.token);
    await expect(state.extendLock(elapsed, 60_000)).resolves.toBe(false);
    await expect(state.extendLock(next, 60_000)).resolves.toBe(true);
  });

  it("refuses to extend a lock held under a different token", async () => {
    const state = openState();
    const lock = await acquire(state, "t2");
    await state.forceReleaseLock("t2");
    const stolen = await acquire(state, "t2");
    await expect(state.extendLock(lock, 60_000)).resolves.toBe(false);
    expect(stolen.token).not.toBe(lock.token);
  });

  it("never resurrects a released lock through extendLock", async () => {
    const state = openState();
    const lock = await acquire(state, "t2");
    await state.releaseLock(lock);
    await expect(state.extendLock(lock, 60_000)).resolves.toBe(false);
    await expect(state.acquireLock("t2", 60_000)).resolves.not.toBeNull();
  });

  it("ignores releaseLock from a holder that was force-released", async () => {
    const state = openState();
    const stale = await acquire(state, "t2");
    await state.forceReleaseLock("t2");
    await acquire(state, "t2");
    await state.releaseLock(stale);
    await expect(state.acquireLock("t2", 60_000)).resolves.toBeNull();
  });

  it("persists values across adapter instances and expires TTL'd ones", async () => {
    await openState().set("k", { a: 1 });
    await expect(openState().get("k")).resolves.toEqual({ a: 1 });

    await openState().set("ttl", "gone", 1);
    await sleep(5);
    await expect(openState().get("ttl")).resolves.toBeNull();
    await expect(openState().get("absent")).resolves.toBeNull();
  });

  it("setIfNotExists returns false for an existing key", async () => {
    const state = openState();
    await expect(state.setIfNotExists("k", "first")).resolves.toBe(true);
    await expect(state.setIfNotExists("k", "second")).resolves.toBe(false);
    await expect(state.get("k")).resolves.toBe("first");

    await state.delete("k");
    await expect(state.setIfNotExists("k", "second")).resolves.toBe(true);
  });

  it("setIfNotExists claims a key whose TTL has elapsed", async () => {
    const state = openState();
    await state.set("k", "first", 1);
    await sleep(5);
    await expect(state.setIfNotExists("k", "second")).resolves.toBe(true);
    await expect(state.get("k")).resolves.toBe("second");
  });

  it("trims appendToList to maxLength keeping newest", async () => {
    const state = openState();
    for (const value of ["one", "two", "three"]) {
      await state.appendToList("k", value, { maxLength: 2 });
    }
    await expect(state.getList("k")).resolves.toEqual(["two", "three"]);
    await expect(state.getList("absent")).resolves.toEqual([]);
  });

  it("drops an expired list instead of appending to it", async () => {
    const state = openState();
    await state.appendToList("k", "old", { ttlMs: 1 });
    await sleep(5);
    await expect(state.getList("k")).resolves.toEqual([]);
    await state.appendToList("k", "new");
    await expect(state.getList("k")).resolves.toEqual(["new"]);
  });

  it("dequeues in FIFO order and reports depth", async () => {
    const state = openState();
    await state.enqueue("t3", entry("one"), 10);
    await expect(state.enqueue("t3", entry("two"), 10)).resolves.toBe(2);
    await expect(state.queueDepth("t3")).resolves.toBe(2);
    expect((await state.dequeue("t3"))?.message).toMatchObject({ text: "one" });
    expect((await state.dequeue("t3"))?.message).toMatchObject({ text: "two" });
    await expect(state.dequeue("t3")).resolves.toBeNull();
  });

  it("round-trips a queued message in the shape chat rehydrates", async () => {
    await openState().enqueue("t3", entry("hello"), 10);
    expect((await openState().dequeue("t3"))?.message).toMatchObject({
      _type: "chat:Message",
      id: "hello",
      text: "hello",
    });
  });

  it("discards queue entries past expiresAt on dequeue", async () => {
    const state = openState();
    await state.enqueue("t3", entry("stale", Date.now() - 1), 10);
    await state.enqueue("t3", entry("fresh"), 10);
    expect((await state.dequeue("t3"))?.message).toMatchObject({ text: "fresh" });
    await expect(state.queueDepth("t3")).resolves.toBe(0);
  });

  it("trims the queue to maxSize, dropping the oldest entry", async () => {
    const state = openState();
    await state.enqueue("t3", entry("one"), 2);
    await state.enqueue("t3", entry("two"), 2);
    await expect(state.enqueue("t3", entry("three"), 2)).resolves.toBe(2);
    expect((await state.dequeue("t3"))?.message).toMatchObject({ text: "two" });
  });

  it("persists subscriptions across adapter instances", async () => {
    await expect(openState().isSubscribed("t4")).resolves.toBe(false);
    await openState().subscribe("t4");
    await openState().subscribe("t4");
    await expect(openState().isSubscribed("t4")).resolves.toBe(true);
    await openState().unsubscribe("t4");
    await expect(openState().isSubscribed("t4")).resolves.toBe(false);
  });

  it("reopens the store after disconnect", async () => {
    const state = openState();
    await state.connect();
    await state.set("k", "kept");
    await state.disconnect();
    await expect(state.get("k")).resolves.toBe("kept");
  });
});
