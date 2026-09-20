import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { assetsDirectory } from "#lib/assets.js";
import { isReservedUserPath } from "#lib/user-preferences.js";

/** Largest number of assets a single call returns. */
const MAX_LIST_LIMIT = 1000;

/**
 * Tool that lists stored assets, optionally filtered by key prefix.
 *
 * @remarks
 * Walks `<EVE_DATA_DIR>/assets`. The prefix filters the results rather than selecting a directory
 * to walk, so it never contributes to a path. Keys under a reserved prefix are filtered out, so
 * managed documents don't show up as browsable files.
 */
export default defineTool({
  description:
    "List stored assets, optionally filtered by a key prefix. Returns each asset's key, size, " +
    "and last-modified date. Use to browse stored content or locate an asset.",
  /**
   * List matching assets.
   *
   * @param input - Validated tool input.
   * @returns The matching `assets`, their `count`, and a `hasMore` flag when the limit truncated
   * the list, or an empty list with an `error` message on failure.
   */
  async execute({ prefix, limit }) {
    const max = limit ?? MAX_LIST_LIMIT;
    try {
      const root = assetsDirectory();
      const entries = await readdir(root, { recursive: true, withFileTypes: true });
      const keys = entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
        .filter((key) => !isReservedUserPath(key))
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
      .max(300)
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
