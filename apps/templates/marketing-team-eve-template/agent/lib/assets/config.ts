import { mkdir } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

/**
 * Asset namespace layout, the path guards that protect it, and where the files actually live.
 *
 * @remarks
 * Everything the team stores lives in one directory, so the key layout is a shared concern rather
 * than a per-feature one. This module owns that layout: the reserved prefixes, what each is for,
 * and which tool is allowed to write it. The general-purpose asset tools consult
 * {@link reservedNamespaceForKey} before acting, so a model can't reach a managed document through
 * a generic file operation and overwrite the team's positioning or another user's preferences.
 *
 * Feature modules import their prefix from here rather than declaring their own. The dependency
 * points toward storage on purpose: adding a namespace should be a single edit in this file, and
 * the guards can only be complete if one module sees every prefix.
 */

/**
 * Root directory holding every durable file the team writes.
 *
 * @remarks
 * `EVE_DATA_DIR` is the one variable that moves all durable state at once, so a deployment has a
 * single path to mount, back up, or move between hosts. It defaults to `data/` under the working
 * directory, which is what `eve dev` uses with no configuration.
 *
 * @returns Absolute or working-directory-relative path to the data directory.
 */
const dataDirectory = (): string => process.env.EVE_DATA_DIR?.trim() || join(process.cwd(), "data");

/**
 * Directory holding stored assets, including every reserved namespace.
 *
 * @returns Path to the assets directory.
 */
export const assetsDirectory = (): string => join(dataDirectory(), "assets");

/**
 * Shape every asset key must match: slash-separated segments that each start with a letter or a
 * digit.
 *
 * @remarks
 * Anchored, and deliberately narrower than the filesystem allows. Keys come from the model and a
 * key is interpolated into a real path, so this pattern is what stops `../`, a leading slash, or a
 * bare `.` segment from escaping {@link assetsDirectory}. Nothing builds a path from a key that
 * has not been through {@link assetPath}.
 */
const ASSET_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*)*$/;

/** Longest asset key accepted, so one call cannot build an unbounded path. */
export const MAX_ASSET_KEY_LENGTH = 300;

/** Largest asset `download_asset` will read into an agent's context, in bytes. */
export const MAX_ASSET_BYTES = 5_000_000;

/**
 * Resolve an asset key to an absolute path inside {@link assetsDirectory}.
 *
 * @remarks
 * Returns `null` for any key that fails {@link ASSET_KEY_PATTERN} or that resolves outside the
 * assets directory. Callers report that as "not found" rather than naming the reason, so a probe
 * learns nothing from the difference between a malformed key and a missing file.
 *
 * @param key - Model-supplied asset key, e.g. `drafts/launch-post.md`.
 * @returns The absolute path, or `null` when the key is not addressable.
 */
export const assetPath = (key: string): string | null => {
  if (key.length > MAX_ASSET_KEY_LENGTH || !ASSET_KEY_PATTERN.test(key)) {
    return null;
  }
  const root = resolve(assetsDirectory());
  const path = resolve(root, key);
  return path.startsWith(`${root}${sep}`) ? path : null;
};

/**
 * Create the parent directory for an asset path.
 *
 * @param path - Absolute asset path, as returned by {@link assetPath}.
 */
export const ensureAssetDirectory = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

/**
 * Content types this team recognizes, by file extension.
 *
 * @remarks
 * A stored file carries no metadata of its own, so the extension is the content type. Keeping the
 * map short is deliberate: an unknown extension is binary, which is always safe to return.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
};

/**
 * The content type an asset key implies.
 *
 * @param key - Asset key, with its extension.
 * @returns The mapped MIME type, or `application/octet-stream` for an unknown extension.
 */
export const assetContentType = (key: string): string =>
  CONTENT_TYPES[extname(key).toLowerCase()] ?? "application/octet-stream";

/**
 * Whether a content type is returned as raw text rather than base64.
 *
 * @param contentType - A MIME type, e.g. from {@link assetContentType}.
 * @returns `true` when the bytes are readable text.
 */
export const isTextContentType = (contentType: string): boolean =>
  contentType.startsWith("text/") ||
  contentType.includes("json") ||
  contentType.includes("xml") ||
  contentType.includes("yaml");

/**
 * An asset key prefix that the generic asset tools must not touch.
 *
 * @remarks
 * `writeTool` and `readTool` name the tools that own the namespace, so a guard can tell the model
 * where to go instead of only refusing. `readTool` is optional because not every namespace has a
 * meaningful read tool to redirect to.
 */
interface ReservedNamespace {
  /** Human-readable description of what the namespace holds. */
  readonly label: string;
  /** Tool that reads this namespace, when one exists. */
  readonly readTool?: string;
  /** Tool that owns writes to this namespace. */
  readonly writeTool: string;
}

/** Asset key prefix holding the team's shared brand context document. */
export const BRAND_CONTEXT_PREFIX = "brand-context/";

/** Asset key prefix holding per-user preference files. */
export const USER_PREFERENCES_PREFIX = "user-preferences/";

/** Asset key prefix holding handoff artifacts passed between agents. */
export const ARTIFACTS_PREFIX = "artifacts/";

/**
 * Every reserved prefix, keyed by the prefix itself.
 *
 * @remarks
 * Add a namespace here and every asset tool starts guarding it, with no change at the call sites.
 */
const RESERVED_NAMESPACES: Readonly<Record<string, ReservedNamespace>> = {
  [BRAND_CONTEXT_PREFIX]: {
    label: "the team's brand context",
    readTool: "get_brand_context",
    writeTool: "save_brand_context",
  },
  [USER_PREFERENCES_PREFIX]: {
    label: "user preferences",
    readTool: "get_user_preferences",
    writeTool: "save_user_preferences",
  },
  [ARTIFACTS_PREFIX]: {
    label: "handoff artifacts",
    readTool: "read_artifact",
    writeTool: "save_artifact",
  },
};

/** Leading slashes stripped from a key before the reserved-prefix check. */
const LEADING_SLASHES = /^\/+/;

/**
 * Find the reserved namespace an asset key falls under, if any.
 *
 * @remarks
 * Leading slashes are stripped first so `/brand-context/brand.md` is refused by name rather than
 * falling through to the generic "not found" that {@link assetPath} produces for it. Both outcomes
 * refuse the call; this one tells the model which tool to use instead.
 *
 * @param key - An asset key, e.g. `drafts/post.md`.
 * @returns The matching namespace, or `null` when the key is a normal asset.
 */
export const reservedNamespaceForKey = (key: string): ReservedNamespace | null => {
  const normalized = key.replace(LEADING_SLASHES, "");
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
  `That key is reserved for ${namespace.label}: use ${namespace.writeTool} instead.`;

/**
 * Build the refusal message for a read blocked by a reserved namespace.
 *
 * @param namespace - The namespace the key fell under.
 * @returns A message naming the owning read tool when there is one.
 */
export const reservedReadMessage = (namespace: ReservedNamespace): string =>
  namespace.readTool
    ? `That key holds ${namespace.label}: use ${namespace.readTool} instead.`
    : `That key is reserved for ${namespace.label}.`;
