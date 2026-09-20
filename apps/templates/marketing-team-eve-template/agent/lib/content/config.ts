import { z } from "zod";

/**
 * Skill layout, input bounds, and pure helpers for the shared content tooling.
 *
 * @remarks
 * A style skill is the source of truth for how a surface writes, and this module owns the two
 * conventions that let a tool reach into one: the skill id a surface resolves to
 * ({@link styleSkillId}) and the reference file that holds its banned words
 * ({@link BANNED_WORDS_FILE}). A tool derives both from a fixed surface enum, never from free
 * model input, so renaming the convention is one edit here rather than a search across agents.
 *
 * The matching logic lives here too, because it is pure and it is where the safety properties sit:
 * {@link parseBannedWords} decides what a malformed list means and {@link findBannedWords} owns the
 * regex construction. `tools.ts` is then only the interface, and these helpers stay callable by
 * whatever content tooling lands next.
 */

/**
 * Maximum draft length accepted by a content tool, in characters.
 *
 * @remarks
 * Bounds both the accepted input and the work done per call: every banned word is evaluated
 * against the whole draft, so an unbounded `text` would let one call scale badly. Comfortably
 * larger than any realistic draft for the supported surfaces.
 *
 * @defaultValue 100_000
 */
export const MAX_DRAFT_LENGTH = 100_000;

/**
 * Path, within a style skill, of the file listing that surface's banned words.
 *
 * @remarks
 * Every `<surface>-style` skill carries this file, so the path is a convention rather than a
 * per-surface setting. A skill missing the file is not an error: the caller treats an unreadable
 * list as an empty one.
 */
export const BANNED_WORDS_FILE = "references/banned-words.json";

/**
 * Resolve the style skill id that owns a surface's conventions.
 *
 * @remarks
 * The naming convention is `<surface>-style`, matching the skill directories under each agent's
 * `skills/`. Callers pass a surface drawn from their own fixed enum, so the resolved id can never
 * be influenced by model input.
 *
 * @param surface - Content surface, e.g. `blog` or `x`.
 * @returns The skill id, e.g. `blog-style`.
 */
export const styleSkillId = (surface: string): string => `${surface}-style`;

/**
 * Schema for a `banned-words.json` file: a flat array of strings.
 *
 * @remarks
 * Content that does not match (a non-array, or non-string elements) is rejected rather than
 * trusted, since the entries are interpolated into regular expressions.
 */
const BANNED_WORDS_SCHEMA = z.array(z.string());

/**
 * Parse and normalize the raw contents of a `banned-words.json` file.
 *
 * @remarks
 * Returns an empty list for anything unusable: invalid JSON, a shape the schema rejects, or
 * entries that are blank once trimmed. Failing open is deliberate. A style skill that ships a
 * broken list should not break drafting, and the tool's own description tells the model that a
 * clean result is a floor rather than a verdict.
 *
 * @param raw - File contents as read from the skill.
 * @returns The trimmed, deduplicated entries, or an empty list when the file is unusable.
 */
export const parseBannedWords = (raw: string): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const result = BANNED_WORDS_SCHEMA.safeParse(parsed);
  if (!result.success) {
    return [];
  }
  return [...new Set(result.data.map((word) => word.trim()).filter(Boolean))];
};

/**
 * Escape regular-expression metacharacters so a banned word is matched literally.
 *
 * @remarks
 * Banned words come from a JSON file and are interpolated into a `RegExp`. Without escaping, an
 * entry containing metacharacters could raise a syntax error or, worse, a
 * catastrophic-backtracking pattern (ReDoS) evaluated against caller-supplied draft text.
 * Escaping forces a literal, linear-time match.
 *
 * @param value - Raw banned word.
 * @returns The word with all regex metacharacters backslash-escaped.
 */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STARTS_WITH_WORD_CHAR = /^\w/;
const ENDS_WITH_WORD_CHAR = /\w$/;

/**
 * Build a case-insensitive whole-word matcher for one banned entry.
 *
 * @remarks
 * A `\b` boundary is only added at an edge whose character is a word character. `\b` next to
 * punctuation (an entry like `"agree?"`) can never match, so such edges are left unanchored
 * instead of silently disabling the entry.
 *
 * @param value - Raw banned entry.
 * @returns A regex matching the entry literally, bounded where word boundaries exist.
 */
const toMatcher = (value: string): RegExp => {
  const leading = STARTS_WITH_WORD_CHAR.test(value) ? "\\b" : "";
  const trailing = ENDS_WITH_WORD_CHAR.test(value) ? "\\b" : "";
  return new RegExp(`${leading}${escapeRegExp(value)}${trailing}`, "i");
};

/**
 * Find which banned words appear in a draft.
 *
 * @remarks
 * Matching is case-insensitive and whole-word where the entry's edges allow it, so `"leverage"`
 * does not fire on `"leveraged"` but a phrase entry still matches inside a sentence. Each entry is
 * reported at most once however often it occurs, because the caller reports words to fix rather
 * than counting occurrences.
 *
 * @param text - Draft text to scan.
 * @param banned - Normalized entries, as returned by {@link parseBannedWords}.
 * @returns The matching entries, in the order the list declared them.
 */
export const findBannedWords = (text: string, banned: readonly string[]): string[] =>
  banned.filter((word) => toMatcher(word).test(text));
