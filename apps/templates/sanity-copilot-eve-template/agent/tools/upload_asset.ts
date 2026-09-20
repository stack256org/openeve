import { writeFile } from "node:fs/promises";
import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  assetContentType,
  assetPath,
  ensureAssetDirectory,
  MAX_ASSET_KEY_LENGTH,
} from "#lib/assets.js";
import { isReservedUserPath, USER_PREFERENCES_PREFIX } from "#lib/user-preferences.js";

/**
 * Tool that stores text or binary content in the agent's asset directory.
 *
 * @remarks
 * Assets live under `<EVE_DATA_DIR>/assets`, so they survive restarts and move with that one
 * directory. The key is model-supplied, so it is validated against an anchored pattern before any
 * path is built. Binary content is supplied base64-encoded with `isBase64: true`, and the key's
 * extension determines the content type.
 */
export default defineTool({
  description:
    "Store text or binary content as a durable asset and return its key. Use when the user wants " +
    "to save an asset, such as an exported draft or an image. The key is a relative path with an " +
    'extension, e.g. "drafts/launch-post.md"; the extension sets the content type.',
  /**
   * Write the content to the assets directory.
   *
   * @param input - Validated tool input.
   * @returns The stored `key`, its `contentType`, and the byte `size`, or `success: false` with
   * an `error` message.
   */
  async execute({ key, content, isBase64, allowOverwrite }) {
    if (isReservedUserPath(key)) {
      return {
        contentType: assetContentType(key),
        error: `"${USER_PREFERENCES_PREFIX}" is reserved: use save_user_preferences instead.`,
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
