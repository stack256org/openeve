import { writeFile } from "node:fs/promises";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assetPath, ensureAssetDirectory } from "#lib/assets/config.js";
import { MAX_PREFERENCES_LENGTH, userPreferencesKey } from "#lib/user-preferences/config.js";

/**
 * Tool that saves the current user's style preferences.
 *
 * @remarks
 * The key is derived from the framework-resolved principal (`ctx.session.auth.current`),
 * never from model input, so a session can only ever write its own user's preferences. This
 * overwrites the whole document, so the caller should `get_user_preferences` first, integrate
 * the new standing preference, and save the merged result — keeping the file curated rather than
 * append-only.
 */
export default defineTool({
  description:
    "Save this user's standing preferences (Markdown). Overwrites the whole document, so " +
    "load the current preferences first, merge in the new one, then save. Use only for durable " +
    "preferences the user states, not one-off instructions for a single task.",
  /**
   * Write the current user's preferences file.
   *
   * @param input - Validated tool input.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   * @returns `success: true` with the stored `key`, or `success: false` with an `error`.
   */
  async execute({ preferences }, ctx) {
    const key = userPreferencesKey(ctx.session.auth.current);
    const path = key ? assetPath(key) : null;
    if (!(key && path)) {
      return {
        error: "No signed-in user to save preferences for.",
        success: false,
      };
    }
    try {
      await ensureAssetDirectory(path);
      await writeFile(path, preferences, "utf8");
      return { key, success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to save preferences",
        success: false,
      };
    }
  },
  inputSchema: z.object({
    preferences: z
      .string()
      .min(1)
      .max(MAX_PREFERENCES_LENGTH)
      .describe(
        "The full preferences document as Markdown: the merged result, not just the new note.",
      ),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    key: z.string().optional(),
    success: z.boolean(),
  }),
});
