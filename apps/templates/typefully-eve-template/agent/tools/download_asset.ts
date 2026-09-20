import { readFile, stat } from "node:fs/promises";
import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  assetContentType,
  assetPath,
  isTextContentType,
  MAX_ASSET_BYTES,
  MAX_ASSET_KEY_LENGTH,
} from "#lib/assets.js";
import { isReservedUserPath } from "#lib/user-preferences.js";

/**
 * Tool that reads a stored asset's contents.
 *
 * @remarks
 * Reads from the assets directory and fetches nothing, so there is no URL to validate and no way
 * to reach an address the agent was not meant to reach. Text content is returned raw; binary
 * content comes back base64-encoded with `isBase64: true`. Reads are capped at
 * {@link MAX_ASSET_BYTES} so one call cannot pull an unbounded payload into context.
 */
export default defineTool({
  description:
    "Read and return the contents of a stored asset by its key. Use when the user wants to read " +
    "or reuse a stored file. Text is returned raw; binary files come back base64-encoded.",
  /**
   * Read and return the asset contents.
   *
   * @param input - Validated tool input.
   * @returns The asset `content` (raw text or base64) with its `contentType`, or
   * `success: false` with an `error` message.
   */
  async execute({ key }) {
    if (isReservedUserPath(key)) {
      return {
        error: "User preferences are private: use get_user_preferences.",
        key,
        success: false,
      };
    }
    const path = assetPath(key);
    if (!path) {
      return { error: "Asset not found.", key, success: false };
    }
    try {
      const info = await stat(path);
      if (!info.isFile()) {
        return { error: "Asset not found.", key, success: false };
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
      return { error: "Asset not found.", key, success: false };
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
