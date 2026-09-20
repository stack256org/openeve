import { unlink } from "node:fs/promises";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { assetPath, MAX_ASSET_KEY_LENGTH } from "#lib/assets.js";
import { isReservedUserPath } from "#lib/user-preferences.js";

/**
 * Tool that permanently deletes a stored asset.
 *
 * @remarks
 * Deletion is irreversible, so this tool is gated on human approval — in Slack it renders as an
 * approve/deny button. A key that fails validation and a key that was never stored both report
 * `deleted: false` without an error, so a probe learns nothing from the difference.
 */
export default defineTool({
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
    if (isReservedUserPath(key)) {
      return {
        deleted: false,
        error: "User preferences can only be cleared with clear_user_preferences.",
        key,
        success: false,
      };
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
