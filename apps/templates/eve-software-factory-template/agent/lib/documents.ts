import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * The factory's shared document layer: the reserved-namespace registry and the helpers every
 * document-backed tool reads and writes through.
 *
 * @remarks
 * Everything the factory stores lives in one data directory, so the key layout is a shared
 * concern rather than a per-feature one. This module owns that layout: the reserved prefixes,
 * what each holds, and which tool owns it. Any general-purpose document tool added later must
 * consult {@link reservedNamespaceForPath} before acting, so a managed document (the factory
 * brain, a user's preferences, a handoff artifact) can't be reached or overwritten through a
 * generic file operation.
 *
 * Feature modules import their prefix from here rather than declaring their own. The dependency
 * points toward storage on purpose: adding a namespace is a single edit in this file, and the
 * guards can only be complete if one module sees every prefix.
 *
 * A key becomes a path under the data directory, so every key is matched against
 * {@link DOCUMENT_KEY} before it is joined. Feature modules already derive keys that cannot
 * escape their namespace, but this check is what makes that true of any key, including one a
 * later tool builds from model input. A key that fails validation is indistinguishable from a
 * key that was never written.
 */

/** Key prefix holding per-user preference files. */
export const USER_PREFERENCES_PREFIX = "user-preferences/";

/** Key prefix holding the shared factory brain. */
export const FACTORY_BRAIN_PREFIX = "factory-brain/";

/** Key prefix holding handoff artifacts passed between stations. */
export const ARTIFACTS_PREFIX = "artifacts/";

/**
 * A key prefix that a general-purpose document tool must not touch.
 *
 * @remarks
 * `writeTool` and `readTool` name the tools that own the namespace, so a guard can tell the
 * model where to go instead of only refusing.
 */
interface ReservedNamespace {
  /** Human-readable description of what the namespace holds. */
  readonly label: string;
  /** Tool that reads this namespace. */
  readonly readTool: string;
  /** Tool that owns writes to this namespace. */
  readonly writeTool: string;
}

/**
 * Every reserved prefix, keyed by the prefix itself.
 *
 * @remarks
 * Add a namespace here and every guard call site starts covering it, with no change at the
 * call sites.
 */
const RESERVED_NAMESPACES: Readonly<Record<string, ReservedNamespace>> = {
  [ARTIFACTS_PREFIX]: {
    label: "handoff artifacts",
    readTool: "read_artifact",
    writeTool: "save_artifact",
  },
  [FACTORY_BRAIN_PREFIX]: {
    label: "the shared factory brain",
    readTool: "read_factory_brain",
    writeTool: "update_factory_brain",
  },
  [USER_PREFERENCES_PREFIX]: {
    label: "user preferences",
    readTool: "get_user_preferences",
    writeTool: "save_user_preferences",
  },
};

/** Leading slashes stripped from a key before the reserved-prefix check. */
const LEADING_SLASHES = /^\/+/;

/**
 * Shape every document key must have: slash-separated segments, each starting with a letter or
 * digit and continuing with letters, digits, `_`, `.` or `-`.
 *
 * @remarks
 * Anchored, and no segment may start with a dot, so `..`, `.`, a leading slash, an empty
 * segment, and a backslash are all rejected. A key that matches cannot traverse out of the
 * data directory when it is joined onto it.
 */
const DOCUMENT_KEY = /^[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)*$/u;

/** Upper bound on a key's length, applied before the pattern so a pathological key is cheap to reject. */
const MAX_KEY_LENGTH = 512;

const isValidKey = (key: string): boolean => key.length <= MAX_KEY_LENGTH && DOCUMENT_KEY.test(key);

/** True for "the file is not there", the one failure a read treats as "not found". */
const isMissing = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === "ENOENT";

/**
 * Root of the factory's durable documents. Override with `EVE_DATA_DIR` to place it on a
 * mounted volume; it defaults to `data/` beside the running process.
 */
const dataDirectory = (): string => process.env.EVE_DATA_DIR?.trim() || join(process.cwd(), "data");

const documentPath = (key: string): string => join(dataDirectory(), "documents", key);

/**
 * Find the reserved namespace a key falls under, if any.
 *
 * @remarks
 * Leading slashes are stripped first so a caller-supplied `/factory-brain/x.md` is seen in its
 * normalized form and cannot slip past the guard.
 *
 * @param pathname - A document key, e.g. `drafts/post.md`.
 * @returns The matching namespace, or `null` when the key is not reserved.
 */
export const reservedNamespaceForPath = (pathname: string): ReservedNamespace | null => {
  const normalized = pathname.replace(LEADING_SLASHES, "");
  for (const [prefix, namespace] of Object.entries(RESERVED_NAMESPACES)) {
    if (normalized.startsWith(prefix)) {
      return namespace;
    }
  }
  return null;
};

/**
 * Build the refusal message for a write blocked by a reserved namespace.
 *
 * @param namespace - The namespace the key fell under.
 * @returns A message naming the owning tool, for the model to act on.
 */
export const reservedWriteMessage = (namespace: ReservedNamespace): string =>
  `That path is reserved for ${namespace.label}: use ${namespace.writeTool} instead.`;

/**
 * Build the refusal message for a read blocked by a reserved namespace.
 *
 * @param namespace - The namespace the key fell under.
 * @returns A message naming the owning read tool.
 */
export const reservedReadMessage = (namespace: ReservedNamespace): string =>
  `That path holds ${namespace.label}: use ${namespace.readTool} instead.`;

/**
 * Read a Markdown document from the store by its exact key.
 *
 * @remarks
 * A missing document is a normal state (`found: false`), not an error, and a key that fails
 * validation returns the same thing, so a probe learns nothing from the difference. Other I/O
 * failures propagate for the caller to map onto its own output shape.
 *
 * @param key - The exact document key, derived by the owning feature module.
 * @returns The document `content` and `uploadedAt` (ISO string) when found.
 */
export const readDocument = async (
  key: string,
): Promise<{ found: false } | { content: string; found: true; uploadedAt: string }> => {
  if (!isValidKey(key)) {
    return { found: false };
  }
  const path = documentPath(key);
  try {
    const [content, stats] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    return { content, found: true, uploadedAt: stats.mtime.toISOString() };
  } catch (error) {
    if (isMissing(error)) {
      return { found: false };
    }
    throw error;
  }
};

/**
 * Write a Markdown document to the store at its exact key.
 *
 * @remarks
 * The key is the identity, so nothing is appended to it and the parent directories are created
 * on demand. Overwrite is the caller's decision: the singleton documents (brain, preferences)
 * replace themselves, while artifacts are write-once and fail if the key is already taken.
 *
 * @param key - The exact document key, derived by the owning feature module.
 * @param contents - The full Markdown document.
 * @param options - Whether an existing document at the key may be replaced.
 * @returns The stored document's `pathname` (callers report it).
 */
export const writeDocument = async (
  key: string,
  contents: string,
  options: { allowOverwrite: boolean },
): Promise<{ pathname: string }> => {
  if (!isValidKey(key)) {
    throw new Error("Invalid document key.");
  }
  const path = documentPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, { encoding: "utf8", flag: options.allowOverwrite ? "w" : "wx" });
  return { pathname: key };
};

/**
 * Delete a document from the store by its exact key.
 *
 * @remarks
 * Reports whether a document existed so callers can tell "deleted" from "nothing to delete":
 * `clear_user_preferences` reports the difference. An invalid key reports the same `false` as a
 * key that was never written.
 *
 * @param key - The exact document key, derived by the owning feature module.
 * @returns Whether a document existed at the key (and was deleted).
 */
export const deleteDocument = async (key: string): Promise<{ existed: boolean }> => {
  if (!isValidKey(key)) {
    return { existed: false };
  }
  try {
    await stat(documentPath(key));
  } catch (error) {
    if (isMissing(error)) {
      return { existed: false };
    }
    throw error;
  }
  await rm(documentPath(key), { force: true });
  return { existed: true };
};
