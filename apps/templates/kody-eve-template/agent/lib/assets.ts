import { mkdir } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

/**
 * Root directory holding every durable file this agent writes.
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
 * Directory holding stored assets, including the reserved namespaces.
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

/** Largest asset `download_asset` will read into the model's context, in bytes. */
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
 * Content types this agent recognizes, by file extension.
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
