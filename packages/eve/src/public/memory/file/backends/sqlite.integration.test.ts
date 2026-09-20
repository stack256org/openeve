import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryDocumentConflictError } from "#public/memory/file/backend.js";
import { sqlite } from "#public/memory/file/backends/sqlite.js";

const signal = new AbortController().signal;

describe("sqlite memory backend", () => {
  let appRoot: string;
  beforeEach(async () => {
    appRoot = await mkdtemp(join(tmpdir(), "openeve-memory-"));
  });
  afterEach(async () => {
    await rm(appRoot, { force: true, recursive: true });
  });

  it("returns null for an absent document", async () => {
    await expect(sqlite({ appRoot }).read({ key: "missing", signal })).resolves.toBeNull();
  });

  it("creates, reads back byte-exact, and conditionally replaces", async () => {
    const backend = sqlite({ appRoot });
    const created = await backend.write({
      content: "# hi\né",
      expectedVersion: null,
      key: "k",
      signal,
    });
    expect(created.version).not.toBe("");
    await expect(backend.read({ key: "k", signal })).resolves.toEqual(created);

    const replaced = await backend.write({
      content: "next",
      expectedVersion: created.version,
      key: "k",
      signal,
    });
    expect(replaced.version).not.toBe(created.version);
    expect((await backend.read({ key: "k", signal }))?.content).toBe("next");
  });

  it("rejects a stale replace and a duplicate create", async () => {
    const backend = sqlite({ appRoot });
    const created = await backend.write({ content: "a", expectedVersion: null, key: "k", signal });
    await backend.write({ content: "b", expectedVersion: created.version, key: "k", signal });

    await expect(
      backend.write({ content: "c", expectedVersion: created.version, key: "k", signal }),
    ).rejects.toSatisfy(MemoryDocumentConflictError.is);
    await expect(
      backend.write({ content: "d", expectedVersion: null, key: "k", signal }),
    ).rejects.toSatisfy(MemoryDocumentConflictError.is);
  });

  it("isolates keys and honours cancellation", async () => {
    const backend = sqlite({ appRoot });
    await backend.write({ content: "one", expectedVersion: null, key: "a", signal });
    await expect(backend.read({ key: "b", signal })).resolves.toBeNull();

    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(backend.read({ key: "a", signal: controller.signal })).rejects.toThrow(
      "cancelled",
    );
  });

  it("persists across backend instances", async () => {
    const created = await sqlite({ appRoot }).write({
      content: "kept",
      expectedVersion: null,
      key: "k",
      signal,
    });
    await expect(sqlite({ appRoot }).read({ key: "k", signal })).resolves.toEqual(created);
  });
});
