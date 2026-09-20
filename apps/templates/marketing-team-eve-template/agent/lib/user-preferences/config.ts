import { createHash } from "node:crypto";
import { USER_PREFERENCES_PREFIX } from "#lib/vercel-blob/config.js";

/**
 * Key derivation and size bound for per-user preference files.
 *
 * @remarks
 * Only the root agent's preference tools use this: preferences describe the person the root is
 * talking to, and specialists receive the ones that matter as constraints in their brief. The
 * prefix comes from the Blob namespace registry, which is what keeps the generic asset tools from
 * reaching these files.
 */

/**
 * Maximum size of a user-preferences document, in characters.
 *
 * @remarks
 * Preferences are a short, curated set of standing notes, not a transcript. The bound keeps the
 * file small and cheap to load into context at the start of every task.
 */
export const MAX_PREFERENCES_LENGTH = 20_000;

/**
 * The current user's principal, as projected onto a tool's `ctx.session.auth.current`.
 *
 * @remarks
 * Structural subset of eve's `SessionAuthContext`; kept narrow so this module doesn't depend on
 * the full tool-context type.
 */
type UserPrincipal =
  | { readonly principalId: string; readonly principalType: string }
  | null
  | undefined;

/**
 * Resolve the Blob key holding the current user's preferences.
 *
 * @remarks
 * The key is derived entirely from the framework-resolved principal, never from model input, so a
 * session can only ever read or write its own user's preferences. The principal id is hashed so
 * the stored path carries no raw user identifier. Only `principalType: "user"` principals get a
 * key; app/service/runtime callers return `null` so the tools can decline rather than share a
 * single anonymous file.
 *
 * @param principal - The value of `ctx.session.auth.current`.
 * @returns The reserved Blob key for this user, or `null` when there is no user principal.
 */
export const userPreferencesKey = (principal: UserPrincipal): string | null => {
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }
  const id = createHash("sha256").update(principal.principalId).digest("hex");
  return `${USER_PREFERENCES_PREFIX}${id}.md`;
};
