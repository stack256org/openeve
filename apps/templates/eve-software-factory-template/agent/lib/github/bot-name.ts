/**
 * Name used where a resolution failure must not stop the work, like the
 * sandbox commit identity. Matches the template's default persona.
 */
export const FALLBACK_BOT_NAME = "Foreman";

/**
 * Upper bound on a resolved bot name before it is interpolated into a
 * regular expression; GitHub App slugs are far shorter in practice.
 */
const MAX_BOT_NAME_LENGTH = 80;

/**
 * The name the factory answers to in `@mentions`.
 *
 * @remarks
 * Read from `FACTORY_BOT_NAME`, then `GITHUB_APP_SLUG`: the GitHub App's own
 * slug, without the `[bot]` suffix, so the mention follows whatever the
 * deployer named their app. eve reads `GITHUB_APP_SLUG` for the channel's own
 * defaults too, so the usual deployment sets one variable.
 *
 * Throws when neither is set, and the failure is never cached. That contract
 * is what the channel's lazy `botName` resolution relies on: eve calls this on
 * first use inside request handling, caches a fulfilled name, and retries a
 * rejection on the next event, so a missing value at boot can't pin a wrong
 * name. Callers that need an answer no matter what catch and use
 * {@link FALLBACK_BOT_NAME}.
 *
 * A hardcoded name is wrong here because the app's slug is chosen by whoever
 * registers it, and a guessed handle can belong to a real GitHub user. The
 * length bound is what keeps a configured value safe to interpolate into
 * {@link mentionPattern}.
 */
export async function resolveBotName(): Promise<string> {
  const name = process.env.FACTORY_BOT_NAME ?? process.env.GITHUB_APP_SLUG;
  if (!name || name.length > MAX_BOT_NAME_LENGTH) {
    throw new Error(
      "Set FACTORY_BOT_NAME or GITHUB_APP_SLUG to the GitHub App's slug (without the [bot] suffix).",
    );
  }
  return name;
}

/**
 * Builds the mention matcher for a resolved bot name: `@<name>` on a word
 * boundary, the same shape the channel's built-in comment gate uses.
 *
 * @remarks
 * The name is escaped for literal matching before interpolation, and
 * {@link resolveBotName} bounds its length, so a configured value can never
 * change the pattern's meaning.
 */
export function mentionPattern(botName: string): RegExp {
  const escaped = botName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`@${escaped}(?=$|[^A-Za-z0-9_-])`, "iu");
}
