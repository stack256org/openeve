import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Durable JSON storage for the agent's own state: custom skills and channel watches.
 *
 * @remarks
 * Objects are files under a single data directory, addressed by a slash-separated key. The key
 * becomes a path, so every key is matched against {@link OBJECT_KEY} before it is joined: without
 * that check a key derived from a Slack id or a skill name could traverse out of the data
 * directory. A key that fails validation is treated exactly like a key that was never written,
 * so a probe learns nothing from the difference.
 */

export interface ObjectStore {
  delete: (key: string) => Promise<void>;
  list: (prefix: string) => Promise<string[]>;
  read: (key: string) => Promise<string | null>;
  write: (key: string, content: string) => Promise<void>;
}

/**
 * The shape every object key must have: slash-separated segments, each starting with a letter or
 * digit and continuing with letters, digits, `_`, `.` or `-`.
 *
 * @remarks
 * Anchored, and no segment may start with a dot, so `..`, `.`, a leading slash, an empty segment,
 * and a backslash are all rejected. A key that matches cannot escape the data directory when it
 * is joined onto it.
 */
const OBJECT_KEY = /^[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)*$/u;

/** Upper bound on a key's length, applied before the pattern so a pathological key is cheap to reject. */
const MAX_KEY_LENGTH = 512;

const isValidKey = (key: string): boolean => key.length <= MAX_KEY_LENGTH && OBJECT_KEY.test(key);

/**
 * A prefix is a key followed by a trailing slash; `list` is only ever called with one.
 */
const isValidPrefix = (prefix: string): boolean =>
  prefix.endsWith("/") && isValidKey(prefix.slice(0, -1));

/**
 * Root of the agent's durable state. Override with `EVE_DATA_DIR` to place it on a mounted
 * volume; it defaults to `data/` beside the running process.
 */
const dataDirectory = (): string => process.env.EVE_DATA_DIR?.trim() || join(process.cwd(), "data");

const objectPath = (key: string): string => join(dataDirectory(), "objects", key);

/** True for "the file or directory is not there", the one failure both reads treat as empty. */
const isMissing = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === "ENOENT";

// Inferred from the call rather than from `readdir` itself: the bare function's
// return type resolves to its last overload, whose entries carry Buffer names.
const readEntries = (directory: string) => readdir(directory, { withFileTypes: true });

/** Recursively lists file keys under `directory`, relative to the objects root. */
async function listKeys(directory: string, relative: string): Promise<string[]> {
  let entries: Awaited<ReturnType<typeof readEntries>>;
  try {
    entries = await readEntries(directory);
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw error;
  }

  const keys: string[] = [];
  for (const entry of entries) {
    const childKey = `${relative}${entry.name}`;
    if (entry.isDirectory()) {
      // biome-ignore lint/performance/noAwaitInLoops: directory depth is bounded by the key layout
      keys.push(...(await listKeys(join(directory, entry.name), `${childKey}/`)));
    } else if (entry.isFile()) {
      keys.push(childKey);
    }
  }
  return keys;
}

export function createObjectStore(): ObjectStore {
  return {
    async delete(key) {
      if (!isValidKey(key)) {
        return;
      }
      await rm(objectPath(key), { force: true });
    },
    async list(prefix) {
      if (!isValidPrefix(prefix)) {
        return [];
      }
      return await listKeys(objectPath(prefix), prefix);
    },
    async read(key) {
      if (!isValidKey(key)) {
        return null;
      }
      try {
        return await readFile(objectPath(key), "utf8");
      } catch (error) {
        if (isMissing(error)) {
          return null;
        }
        throw error;
      }
    },
    async write(key, content) {
      if (!isValidKey(key)) {
        throw new Error("Invalid object key.");
      }
      const path = objectPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
    },
  };
}
