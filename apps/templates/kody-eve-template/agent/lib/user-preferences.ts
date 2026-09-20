import { createHash } from "node:crypto";

/**
 * Reserved asset key prefix for per-user preference files.
 *
 * @remarks
 * The user-preferences tools own this prefix exclusively. Any general-purpose asset tool must
 * treat it as off-limits (see {@link isReservedUserPath}) so it can't be used as a side channel
 * to read or overwrite another user's preferences — those files are only reachable through the
 * principal-scoped preference tools.
 */
export const USER_PREFERENCES_PREFIX = "user-preferences/";

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

/** Leading slashes stripped from a key before the reserved-prefix check. */
const LEADING_SLASHES = /^\/+/;

/**
 * Whether an asset key falls under the reserved user-preferences prefix.
 *
 * @param key - An asset key, e.g. `drafts/post.md`.
 * @returns `true` when the key is reserved for user preferences.
 */
export const isReservedUserPath = (key: string): boolean =>
  key.replace(LEADING_SLASHES, "").startsWith(USER_PREFERENCES_PREFIX);

/**
 * Resolve the asset key holding the current user's preferences.
 *
 * @remarks
 * The key is derived entirely from the framework-resolved principal — never from model input —
 * so a session can only ever read or write its own user's preferences. The principal id is
 * hashed so the stored path carries no raw user identifier. Only `principalType: "user"`
 * principals (a signed-in user on one of the channels) get a key; app/service/runtime callers return
 * `null` so the tools can decline rather than share a single anonymous file.
 *
 * @param principal - The value of `ctx.session.auth.current`.
 * @returns The reserved asset key for this user, or `null` when there is no user principal.
 */
export const userPreferencesKey = (principal: UserPrincipal): string | null => {
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }
  const id = createHash("sha256").update(principal.principalId).digest("hex");
  return `${USER_PREFERENCES_PREFIX}${id}.md`;
};
