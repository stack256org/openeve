import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultFileMemoryBackend } from "#public/memory/file/backends/default.js";

vi.mock("#compiled/@vercel/blob/index.js", () => ({
  BlobPreconditionFailedError: class BlobPreconditionFailedError extends Error {},
  get: vi.fn(),
  put: vi.fn(),
}));

const { get, put } = await import("#compiled/@vercel/blob/index.js");
const signal = new AbortController().signal;

describe("defaultFileMemoryBackend off Vercel", () => {
  let appRoot: string;

  beforeEach(async () => {
    appRoot = await mkdtemp(join(tmpdir(), "openeve-default-"));
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    await rm(appRoot, { force: true, recursive: true });
  });

  it("selects the sqlite backend instead of requiring an explicit one", async () => {
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("EVE_DEV", undefined);

    const backend = defaultFileMemoryBackend();
    await expect(backend.read({ key: "absent", signal })).resolves.toBeNull();

    const written = await backend.write({
      content: "remembered",
      expectedVersion: null,
      key: "k",
      signal,
    });
    await expect(backend.read({ key: "k", signal })).resolves.toEqual(written);
  });

  // Preserves the guard from the pre-sqlite contract: a stray Blob token in the
  // environment must never pull a self-hosted deployment onto Vercel Blob.
  it.each([undefined, "development", "production", "staging"])(
    "ignores a stray Blob token outside Vercel with NODE_ENV=%s",
    async (nodeEnv) => {
      vi.stubEnv("EVE_DEV", undefined);
      vi.stubEnv("VERCEL", undefined);
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", "outside-vercel");

      const backend = defaultFileMemoryBackend();
      await expect(backend.read({ key: "mem_a", signal })).resolves.toBeNull();

      expect(get).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    },
  );
});
