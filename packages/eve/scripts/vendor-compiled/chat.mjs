import {
  buildOpaqueTypesStub,
  buildUniqueSymbolStub,
  createDeclarationCopier,
} from "./_shared.mjs";

/**
 * Type declarations for `chat` are copied verbatim from the installed
 * package at vendor time. The chat surface (Thread, Message, Author,
 * SentMessage, …) is reachable by consumer code as `ctx.thread.refresh()`
 * etc., so the public type contract has to be the *actual* chat shape —
 * hand-written stubs would drift on every version bump.
 *
 * Three transforms apply during the copy:
 *
 * 1. The sibling `jsx-runtime-<hash>.d.ts` chunk is co-copied so chat's
 *    relative import resolves locally. The chunk's filename has a content
 *    hash, so we discover it dynamically.
 * 2. `from '@workflow/serde'` is rewritten to a local stub that declares
 *    just the unique symbols chat references.
 * 3. `from 'mdast'` is rewritten to a local stub that aliases the names
 *    chat references to `unknown` — consumers don't need @types/mdast.
 */
export default {
  packageName: "chat",
  compiledPath: "chat",
  copyDeclarations: createDeclarationCopier({
    rewrites: {
      "@workflow/serde": {
        kind: "stub",
        stubBaseName: "_workflow-serde",
        build: buildUniqueSymbolStub,
      },
      mdast: {
        kind: "stub",
        stubBaseName: "_mdast",
        build: buildOpaqueTypesStub,
      },
    },
    // Every content-hashed sibling chunk, not one chunk by name. chat splits
    // its declarations across several of them and the split changes between
    // releases: 4.34.0 emits `messages-<hash>.d.ts` alongside
    // `jsx-runtime-<hash>.d.ts`. Missing one leaves an unresolved relative
    // import that `skipLibCheck` swallows, which silently degrades every type
    // re-exported through it to `any`.
    discoverExtraFiles: (distEntries) =>
      distEntries.filter((name) => /^[^.]+-[A-Za-z0-9_-]{8}\.d\.ts$/.test(name)),
  }),
};
