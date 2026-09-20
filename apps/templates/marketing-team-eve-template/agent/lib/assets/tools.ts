import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import {
  assetContentType,
  assetPath,
  assetsDirectory,
  ensureAssetDirectory,
  isTextContentType,
  MAX_ASSET_BYTES,
  MAX_ASSET_KEY_LENGTH,
  reservedNamespaceForKey,
  reservedReadMessage,
  reservedWriteMessage,
} from "#lib/assets/config.js";

/**
 * Shared definitions for the team's asset tools.
 *
 * @remarks
 * eve resolves an agent's tools from its own `tools/` directory and subagents inherit nothing, so
 * every specialist that needs durable file storage calls these factories from one-line files.
 * Defining them once here means each agent gets the same descriptions, schemas, and reserved-key
 * guards: a guard that only some agents apply is not a guard.
 *
 * Assets live under `<EVE_DATA_DIR>/assets`. Keys are model-supplied, so every one is validated
 * against an anchored pattern before a path is built, and a key that fails validation is reported
 * exactly like a key that was never stored.
 */

/** Largest number of assets a single `list_assets` call returns. */
const MAX_LIST_LIMIT = 1000;

/** Message returned for both a malformed key and a key that was never stored. */
const NOT_FOUND = "Asset not found.";

/**
 * Build the tool that stores text or binary content as an asset.
 *
 * @remarks
 * Refuses keys in a reserved namespace so a generic upload can't overwrite a managed document.
 * Binary content is supplied base64-encoded with `isBase64: true`, and the key's extension
 * determines the content type.
 *
 * @returns The `upload_asset` tool definition.
 */
export const uploadAssetTool = () =>
  defineTool({
    description:
      "Store text or binary content as a durable asset and return its key. Use when the user " +
      "wants to save or publish an asset, such as an exported draft or an image. The key is a " +
      'relative path with an extension, e.g. "drafts/launch-post.md"; the extension sets the ' +
      "content type.",
    /**
     * Write the content to the assets directory.
     *
     * @param input - Validated tool input.
     * @returns The stored `key`, its `contentType`, and the byte `size`, or `success: false` with
     * an `error` message.
     */
    async execute({ key, content, isBase64, allowOverwrite }) {
      const reserved = reservedNamespaceForKey(key);
      if (reserved) {
        return {
          contentType: assetContentType(key),
          error: reservedWriteMessage(reserved),
          key,
          success: false,
        };
      }
      const path = assetPath(key);
      if (!path) {
        return {
          contentType: assetContentType(key),
          error: "That key is not a valid asset key. Use a relative path such as drafts/post.md.",
          key,
          success: false,
        };
      }
      try {
        const body = isBase64 ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
        await ensureAssetDirectory(path);
        await writeFile(path, body, { flag: allowOverwrite ? "w" : "wx" });
        return {
          contentType: assetContentType(key),
          key,
          size: body.byteLength,
          success: true,
        };
      } catch (error) {
        return {
          contentType: assetContentType(key),
          error: error instanceof Error ? error.message : "Upload failed",
          key,
          success: false,
        };
      }
    },
    inputSchema: z.object({
      allowOverwrite: z
        .boolean()
        .optional()
        .describe("Allow replacing an existing asset at the same key. Defaults to false."),
      content: z.string().describe("Raw text/JSON, or base64-encoded bytes when isBase64 is true."),
      isBase64: z
        .boolean()
        .optional()
        .describe("Set true when content is base64-encoded binary data. Defaults to false."),
      key: z
        .string()
        .min(1)
        .max(MAX_ASSET_KEY_LENGTH)
        .describe(
          'Relative path and filename including extension, e.g. "drafts/launch-post.md". Letters, digits, dots, dashes, underscores, and slashes only.',
        ),
    }),
    outputSchema: z.object({
      contentType: z.string(),
      error: z.string().optional(),
      key: z.string(),
      size: z.number().optional(),
      success: z.boolean(),
    }),
  });

/**
 * Build the tool that lists stored assets.
 *
 * @remarks
 * The prefix filters the results rather than selecting a directory to walk, so it never
 * contributes to a path. Keys in a reserved namespace are filtered out, so managed documents don't
 * show up as browsable files.
 *
 * @returns The `list_assets` tool definition.
 */
export const listAssetsTool = () =>
  defineTool({
    description:
      "List stored assets, optionally filtered by a key prefix. Returns each asset's key, size, " +
      "and last-modified date. Use to browse stored content or locate an asset.",
    /**
     * List matching assets.
     *
     * @param input - Validated tool input.
     * @returns The matching `assets`, their `count`, and a `hasMore` flag when the limit
     * truncated the list, or an empty list with an `error` message on failure.
     */
    async execute({ prefix, limit }) {
      const max = limit ?? MAX_LIST_LIMIT;
      try {
        const root = assetsDirectory();
        const entries = await readdir(root, { recursive: true, withFileTypes: true });
        const keys = entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
          .filter((key) => !reservedNamespaceForKey(key))
          .filter((key) => (prefix ? key.startsWith(prefix) : true))
          .sort();
        const assets = await Promise.all(
          keys.slice(0, max).map(async (key) => {
            const info = await stat(join(root, key));
            return { key, modifiedAt: info.mtime.toISOString(), size: info.size };
          }),
        );
        return { assets, count: assets.length, hasMore: keys.length > assets.length };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return { assets: [], count: 0, hasMore: false };
        }
        return {
          assets: [],
          count: 0,
          error: error instanceof Error ? error.message : "Failed to list assets",
          hasMore: false,
        };
      }
    },
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_LIST_LIMIT)
        .optional()
        .describe("Maximum number of assets to return. Defaults to 1000."),
      prefix: z
        .string()
        .max(MAX_ASSET_KEY_LENGTH)
        .optional()
        .describe('Filter by key prefix/folder, e.g. "drafts/". Omit to list everything.'),
    }),
    outputSchema: z.object({
      assets: z.array(
        z.object({
          key: z.string(),
          modifiedAt: z.string(),
          size: z.number(),
        }),
      ),
      count: z.number(),
      error: z.string().optional(),
      hasMore: z.boolean(),
    }),
  });

/**
 * Build the tool that reads an asset's metadata without reading its content.
 *
 * @remarks
 * A key that fails validation and a key that was never stored both return `exists: false` with the
 * same message, so a probe learns nothing from the difference. Only the reserved-namespace refusal
 * is distinguishable, because it names the tool to use instead.
 *
 * @returns The `get_asset_info` tool definition.
 */
export const getAssetInfoTool = () =>
  defineTool({
    description:
      "Get metadata (size, content type, last-modified date) for a stored asset without reading " +
      "it. Use to check whether an asset exists or inspect it before downloading.",
    /**
     * Look up the asset's metadata.
     *
     * @param input - Validated tool input.
     * @returns `exists: true` with the asset's metadata, or `exists: false` with an `error`.
     */
    async execute({ key }) {
      const reserved = reservedNamespaceForKey(key);
      if (reserved) {
        return { error: reservedReadMessage(reserved), exists: false, key };
      }
      const path = assetPath(key);
      if (!path) {
        return { error: NOT_FOUND, exists: false, key };
      }
      try {
        const info = await stat(path);
        if (!info.isFile()) {
          return { error: NOT_FOUND, exists: false, key };
        }
        return {
          contentType: assetContentType(key),
          exists: true,
          key,
          modifiedAt: info.mtime.toISOString(),
          size: info.size,
        };
      } catch {
        return { error: NOT_FOUND, exists: false, key };
      }
    },
    inputSchema: z.object({
      key: z
        .string()
        .min(1)
        .max(MAX_ASSET_KEY_LENGTH)
        .describe("The asset's key, e.g. drafts/post.md."),
    }),
    outputSchema: z.object({
      contentType: z.string().optional(),
      error: z.string().optional(),
      exists: z.boolean(),
      key: z.string(),
      modifiedAt: z.string().optional(),
      size: z.number().optional(),
    }),
  });

/**
 * Build the tool that reads an asset's contents.
 *
 * @remarks
 * Reads from the assets directory and fetches nothing, so there is no URL to validate and no way
 * to reach an address the agent was not meant to reach. Text content is returned raw; binary
 * content comes back base64-encoded with `isBase64: true`. Reads are capped at
 * {@link MAX_ASSET_BYTES} so one call cannot pull an unbounded payload into context.
 *
 * @returns The `download_asset` tool definition.
 */
export const downloadAssetTool = () =>
  defineTool({
    description:
      "Read and return the contents of a stored asset by its key. Use when the user wants to " +
      "read or reuse a stored file. Text is returned raw; binary files come back base64-encoded.",
    /**
     * Read and return the asset contents.
     *
     * @param input - Validated tool input.
     * @returns The asset `content` (raw text or base64) with its `contentType`, or
     * `success: false` with an `error` message.
     */
    async execute({ key }) {
      const reserved = reservedNamespaceForKey(key);
      if (reserved) {
        return { error: reservedReadMessage(reserved), key, success: false };
      }
      const path = assetPath(key);
      if (!path) {
        return { error: NOT_FOUND, key, success: false };
      }
      try {
        const info = await stat(path);
        if (!info.isFile()) {
          return { error: NOT_FOUND, key, success: false };
        }
        if (info.size > MAX_ASSET_BYTES) {
          return {
            error: `Asset is ${info.size} bytes, over the ${MAX_ASSET_BYTES} byte read limit.`,
            key,
            success: false,
          };
        }
        const contentType = assetContentType(key);
        const isText = isTextContentType(contentType);
        const bytes = await readFile(path);
        return {
          content: isText ? bytes.toString("utf8") : bytes.toString("base64"),
          contentType,
          isBase64: !isText,
          key,
          success: true,
        };
      } catch {
        return { error: NOT_FOUND, key, success: false };
      }
    },
    inputSchema: z.object({
      key: z
        .string()
        .min(1)
        .max(MAX_ASSET_KEY_LENGTH)
        .describe("The asset's key, e.g. drafts/post.md."),
    }),
    outputSchema: z.object({
      content: z.string().optional(),
      contentType: z.string().optional(),
      error: z.string().optional(),
      isBase64: z.boolean().optional(),
      key: z.string(),
      success: z.boolean(),
    }),
  });

/**
 * Build the tool that permanently deletes an asset.
 *
 * @remarks
 * Deletion is irreversible, so this tool is gated on human approval on every call. Reserved
 * namespaces are refused: a managed document is only removable through the tool that owns it. A
 * key that fails validation and a key that was never stored both report `deleted: false`.
 *
 * @returns The `delete_asset` tool definition.
 */
export const deleteAssetTool = () =>
  defineTool({
    approval: always(),
    description:
      "Permanently delete a stored asset by its key. Use only when the user explicitly asks to " +
      "remove a stored file. This is irreversible.",
    /**
     * Delete the asset.
     *
     * @param input - Validated tool input.
     * @returns `deleted: true` when a file was removed, `false` when there was nothing to remove,
     * or `success: false` with an `error`.
     */
    async execute({ key }) {
      const reserved = reservedNamespaceForKey(key);
      if (reserved) {
        return { deleted: false, error: reservedWriteMessage(reserved), key, success: false };
      }
      const path = assetPath(key);
      if (!path) {
        return { deleted: false, key, success: true };
      }
      try {
        await unlink(path);
        return { deleted: true, key, success: true };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return { deleted: false, key, success: true };
        }
        return {
          deleted: false,
          error: error instanceof Error ? error.message : "Delete failed",
          key,
          success: false,
        };
      }
    },
    inputSchema: z.object({
      key: z
        .string()
        .min(1)
        .max(MAX_ASSET_KEY_LENGTH)
        .describe("The asset's key, e.g. drafts/post.md."),
    }),
    outputSchema: z.object({
      deleted: z.boolean(),
      error: z.string().optional(),
      key: z.string(),
      success: z.boolean(),
    }),
  });
