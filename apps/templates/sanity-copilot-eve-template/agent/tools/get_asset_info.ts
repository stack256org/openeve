import { stat } from "node:fs/promises";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assetContentType, assetPath, MAX_ASSET_KEY_LENGTH } from "#lib/assets.js";
import { isReservedUserPath } from "#lib/user-preferences.js";

/**
 * Tool that reads an asset's metadata without reading its content.
 *
 * @remarks
 * A key that fails validation and a key that was never stored both return `exists: false` with
 * the same message, so a probe learns nothing from the difference. Only the reserved-prefix
 * refusal is distinguishable, because it names the tool to use instead.
 */
export default defineTool({
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
    if (isReservedUserPath(key)) {
      return {
        error: "User preferences are private: use get_user_preferences.",
        exists: false,
        key,
      };
    }
    const path = assetPath(key);
    if (!path) {
      return { error: "Asset not found.", exists: false, key };
    }
    try {
      const info = await stat(path);
      if (!info.isFile()) {
        return { error: "Asset not found.", exists: false, key };
      }
      return {
        contentType: assetContentType(key),
        exists: true,
        key,
        modifiedAt: info.mtime.toISOString(),
        size: info.size,
      };
    } catch {
      return { error: "Asset not found.", exists: false, key };
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
