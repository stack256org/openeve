# open-eve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `vercel/eve` fork into open-eve: a framework whose every default runs on a bare VPS with no Vercel service and no third-party call, while Vercel stays available as an explicit opt-in.

**Architecture:** Additive by default. New adapters land in new files, which never conflict on upstream merges. The only edits to upstream files are single-line seams — chiefly replacing 21 hardcoded `process.env.VERCEL` reads with one `resolveHostProvider()` call — plus flipping two default resolvers and seven scaffold templates. No file or directory is renamed.

**Tech Stack:** TypeScript (ESM, strict), Node >=24, vitest (unit / integration / scenario tiers), `node:sqlite`, `node:crypto`, nitro.

**Spec:** [`open-eve/DESIGN.md`](./DESIGN.md)

## Global Constraints

- **Node floor is `>=24`.** `node:sqlite` is Stability 1.2 (Release Candidate) there and runs without a flag since 22.13.0. Wrap it behind an eve-owned store interface so the dependency stays swappable.
- **Runtime dependencies stay `nitro` and `undici` only.** No new entry in `packages/eve/package.json#dependencies`. Anything else is vendored or built on node builtins.
- **Never rename a file or directory.** The package path stays `packages/eve/`. Rebranding is `name` and `bin` in `packages/eve/package.json` only.
- **Never reformat upstream files.** No formatter-config changes, no import reordering, no cosmetic sweeps.
- **Edit upstream files on one line where possible.** Prefer a call into new code over restructuring existing logic.
- **Vercel code is gated, never deleted.** All 55 Vercel-named files stay where upstream put them so upstream patches still apply.
- **Unit tier forbids filesystem writes.** `src/internal/testing/unit-guard.ts` replaces every `node:fs` write, `child_process` spawn, `process.chdir`, and real `fetch` with throwing stubs. Anything touching disk or network belongs in `*.integration.test.ts` or `*.scenario.test.ts`.
- **Run a single test with its tier config**, or `#*` imports resolve to stale `dist`:
  `pnpm --filter eve exec vitest run --config vitest.unit.config.ts <path>`
- **Integration-tier runs need `dist/` first on a fresh checkout.** Loading `vitest.integration.config.ts` itself imports through the `default` condition into `./dist/src/...`, so run `pnpm --filter eve run build:js` before any `--config vitest.integration.config.ts` command. The package's own `test:integration` script does exactly this.
- **Run `oxfmt` on new files before committing.** The literal code in this plan is not always wrapped to the repo's line width.
- **Style:** name definitions for the protocol they target; derive names from file paths; comment why, not what; no legacy fallback logic (pre-1.0 favours breaking changes).
- **Every commit** uses `git commit -s` for the DCO trailer.
- **Gate checks before any commit:** `pnpm guard:invariants` and `node ./scripts/check-docs.mjs` must both pass.

---

## Scope

Ten work items. Two spec items are deferred, each for a stated reason:

- **`s3()` memory backend → v2.** Runtime deps are capped at `nitro` + `undici`, so there is no AWS SDK; it needs ~120 lines of in-repo SigV4 signing. `sqlite()` is the local-first default, so nothing in the zero-Vercel promise depends on it.
- **Traces → SQLite → dropped.** `.eve/traces/` is already local and involves no Vercel service. Migrating it means rewriting `local-trace-reader.ts` (403 lines), `local-trace-retention.ts` (343 lines, built on directory mtime and `directorySize()`), and the TUI incremental cache that depends on segment-file immutability, across 6 consumers. Pure consolidation, zero Vercel removal.

## File Structure

**New files (additive — these never conflict on an upstream merge):**

| Path                                                                 | Responsibility                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/eve/src/internal/storage/sqlite-store.ts`                  | Opens `data/openeve.db` via `node:sqlite`, owns schema creation and migration. The only module importing `node:sqlite`.                    |
| `packages/eve/src/internal/storage/data-directory.ts`                | Resolves `<appRoot>/data`, honouring `EVE_DATA_DIR`.                                                                                       |
| `packages/eve/src/public/memory/file/backends/sqlite.ts`             | `sqlite()` — a `MemoryDocumentBackend` over the shared store.                                                                              |
| `packages/eve/src/public/channels/chat-sdk/state/sqlite.ts`          | `sqliteState()` — the 18-method Chat SDK `StateAdapter`.                                                                                   |
| `packages/eve/src/internal/host/provider.ts`                         | `resolveHostProvider()`, `HostProvider`, and the manifest-free environment fallback.                                                       |
| `packages/eve/src/public/hosts/vercel.ts`                            | `vercel()` host marker for `agent/agent.ts`.                                                                                               |
| `packages/eve/src/setup/integrations/shared/portable-credentials.ts` | Shared prompt + `.env` writer for portable credential branches.                                                                            |
| `packages/eve/scripts/check-no-vercel-runtime.mjs`                   | Fails if `@vercel/*` is reachable from the default runtime entrypoint. Separate script so `guard-invariants.mjs` stays at zero divergence. |
| `scripts/sync-upstream.sh`                                           | Fetch, merge on a branch, run gates, report.                                                                                               |

**Upstream files modified (single-line seams wherever possible):** 36 total. The host field alone requires 8 threading edits before any call site changes — miss one and the field is silently dropped by a `.strict()` schema or a whitelist literal.

---

## Milestone 1 — Foundation

Proves the thesis. Nothing else starts until `openeve build && openeve start` runs with no `@vercel/*` reachable at runtime.

### Task 1: SQLite store — DONE (`751c90c46`)

**Files:**

- Create: `packages/eve/src/internal/storage/data-directory.ts`
- Create: `packages/eve/src/internal/storage/sqlite-store.ts`
- Test: `packages/eve/src/internal/storage/sqlite-store.integration.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `resolveDataDirectory(appRoot: string): string`
  - `openSqliteStore(input: { readonly appRoot: string }): SqliteStore`
  - `interface SqliteStore { readonly db: DatabaseSync; close(): void; }`

**Why integration tier, not unit:** `src/internal/testing/unit-guard.ts` replaces every `node:fs` write with a throwing stub. On-disk SQLite cannot run in the unit tier.

- [ ] **Step 1: Write the failing test**

```ts
// packages/eve/src/internal/storage/sqlite-store.integration.test.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openSqliteStore } from "#internal/storage/sqlite-store.js";

describe("openSqliteStore", () => {
  let appRoot: string;
  beforeEach(async () => {
    appRoot = await mkdtemp(join(tmpdir(), "openeve-store-"));
  });
  afterEach(async () => {
    await rm(appRoot, { force: true, recursive: true });
  });

  it("creates data/openeve.db and applies the schema once", () => {
    const first = openSqliteStore({ appRoot });
    first.db.exec("INSERT INTO memory_documents (key, content, version) VALUES ('k', 'c', 'v1')");
    first.close();

    const second = openSqliteStore({ appRoot });
    const row = second.db
      .prepare("SELECT content, version FROM memory_documents WHERE key = ?")
      .get("k");
    expect(row).toEqual({ content: "c", version: "v1" });
    second.close();
  });

  it("is idempotent when opened twice", () => {
    const a = openSqliteStore({ appRoot });
    a.close();
    const b = openSqliteStore({ appRoot });
    expect(b.db.prepare("SELECT count(*) AS n FROM memory_documents").get()).toEqual({ n: 0 });
    b.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter eve exec vitest run --config vitest.integration.config.ts src/internal/storage/sqlite-store.integration.test.ts`
Expected: FAIL — cannot resolve `#internal/storage/sqlite-store.js`

- [ ] **Step 3: Write `data-directory.ts`**

```ts
import { join } from "node:path";

/**
 * Resolves the single directory holding every durable open-eve artifact.
 * One path to back up, one path to move between hosts.
 */
export function resolveDataDirectory(appRoot: string): string {
  const configured = process.env.EVE_DATA_DIR?.trim();
  return configured === undefined || configured === "" ? join(appRoot, "data") : configured;
}
```

- [ ] **Step 4: Write `sqlite-store.ts`**

```ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { resolveDataDirectory } from "#internal/storage/data-directory.js";

/** Open handle to the shared open-eve database. */
export interface SqliteStore {
  readonly db: DatabaseSync;
  close(): void;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS memory_documents (
     key TEXT PRIMARY KEY,
     content TEXT NOT NULL,
     version TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS channel_subscriptions (thread_id TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS channel_locks (
     thread_id TEXT PRIMARY KEY,
     token TEXT NOT NULL,
     expires_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS channel_kv (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     expires_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS channel_lists (
     key TEXT NOT NULL,
     seq INTEGER NOT NULL,
     value TEXT NOT NULL,
     expires_at INTEGER,
     PRIMARY KEY (key, seq)
   )`,
  `CREATE TABLE IF NOT EXISTS channel_queues (
     thread_id TEXT NOT NULL,
     seq INTEGER NOT NULL,
     entry TEXT NOT NULL,
     PRIMARY KEY (thread_id, seq)
   )`,
] as const;

/**
 * Opens `data/openeve.db`, creating the directory and schema on first use.
 *
 * `node:sqlite` is Stability 1.2 on the supported Node floor, so every import
 * of it is confined to this module: swapping the driver stays a one-file change.
 */
export function openSqliteStore(input: { readonly appRoot: string }): SqliteStore {
  const directory = resolveDataDirectory(input.appRoot);
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "openeve.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  for (const statement of SCHEMA) db.exec(statement);
  return {
    db,
    close() {
      db.close();
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter eve exec vitest run --config vitest.integration.config.ts src/internal/storage/sqlite-store.integration.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 6: Gates and commit**

```bash
pnpm guard:invariants && node ./scripts/check-docs.mjs
git add packages/eve/src/internal/storage
git commit -s -m "feat(open-eve): add the shared SQLite store behind data/openeve.db"
```

### Task 2: `sqlite()` memory backend — DONE (`79c9cdf0b`)

**Files:**

- Create: `packages/eve/src/public/memory/file/backends/sqlite.ts`
- Test: `packages/eve/src/public/memory/file/backends/sqlite.integration.test.ts`
- Modify: `packages/eve/src/public/memory/file/index.ts` (add two exports)

**Interfaces:**

- Consumes: `openSqliteStore`, `SqliteStore` from Task 1.
- Produces: `sqlite(options?: SqliteMemoryBackendOptions): MemoryDocumentBackend`, `interface SqliteMemoryBackendOptions { readonly appRoot?: string }`

**Contract to satisfy** (verbatim from `packages/eve/src/public/memory/file/backend.ts`):

```ts
export interface MemoryDocumentBackend {
  readonly read: (input: MemoryDocumentReadInput) => Promise<MemoryDocument | null>;
  readonly write: (input: MemoryDocumentWriteInput) => Promise<MemoryDocument>;
}
```

`MemoryDocument` is `{ content: string; version: string }`. `MemoryDocumentWriteInput` adds `content: string` and `expectedVersion: string | null` (`null` means create-only). The backend must raise `MemoryDocumentConflictError` on a stale or duplicate write — it must NOT retry, because `provider.ts` owns the retry loop (`MAX_CONFLICT_RETRIES = 8`). The provider also rejects any returned document whose `version` is empty or whose `content` does not round-trip byte-exact.

- [ ] **Step 1: Write the failing test**

```ts
// packages/eve/src/public/memory/file/backends/sqlite.integration.test.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryDocumentConflictError } from "#public/memory/file/backend.js";
import { sqlite } from "#public/memory/file/backends/sqlite.js";

const signal = new AbortController().signal;

describe("sqlite memory backend", () => {
  let appRoot: string;
  beforeEach(async () => {
    appRoot = await mkdtemp(join(tmpdir(), "openeve-memory-"));
  });
  afterEach(async () => {
    await rm(appRoot, { force: true, recursive: true });
  });

  it("returns null for an absent document", async () => {
    await expect(sqlite({ appRoot }).read({ key: "missing", signal })).resolves.toBeNull();
  });

  it("creates, reads back byte-exact, and conditionally replaces", async () => {
    const backend = sqlite({ appRoot });
    const created = await backend.write({
      content: "# hi\né",
      expectedVersion: null,
      key: "k",
      signal,
    });
    expect(created.version).not.toBe("");
    await expect(backend.read({ key: "k", signal })).resolves.toEqual(created);

    const replaced = await backend.write({
      content: "next",
      expectedVersion: created.version,
      key: "k",
      signal,
    });
    expect(replaced.version).not.toBe(created.version);
    expect((await backend.read({ key: "k", signal }))?.content).toBe("next");
  });

  it("rejects a stale replace and a duplicate create", async () => {
    const backend = sqlite({ appRoot });
    const created = await backend.write({ content: "a", expectedVersion: null, key: "k", signal });
    await backend.write({ content: "b", expectedVersion: created.version, key: "k", signal });

    await expect(
      backend.write({ content: "c", expectedVersion: created.version, key: "k", signal }),
    ).rejects.toSatisfy(MemoryDocumentConflictError.is);
    await expect(
      backend.write({ content: "d", expectedVersion: null, key: "k", signal }),
    ).rejects.toSatisfy(MemoryDocumentConflictError.is);
  });

  it("isolates keys and honours cancellation", async () => {
    const backend = sqlite({ appRoot });
    await backend.write({ content: "one", expectedVersion: null, key: "a", signal });
    await expect(backend.read({ key: "b", signal })).resolves.toBeNull();

    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(backend.read({ key: "a", signal: controller.signal })).rejects.toThrow(
      "cancelled",
    );
  });

  it("persists across backend instances", async () => {
    const created = await sqlite({ appRoot }).write({
      content: "kept",
      expectedVersion: null,
      key: "k",
      signal,
    });
    await expect(sqlite({ appRoot }).read({ key: "k", signal })).resolves.toEqual(created);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter eve exec vitest run --config vitest.integration.config.ts src/public/memory/file/backends/sqlite.integration.test.ts`
Expected: FAIL — cannot resolve `#public/memory/file/backends/sqlite.js`

- [ ] **Step 3: Write the backend**

```ts
import { randomUUID } from "node:crypto";

import { openSqliteStore, type SqliteStore } from "#internal/storage/sqlite-store.js";
import {
  MemoryDocumentConflictError,
  type MemoryDocument,
  type MemoryDocumentBackend,
} from "#public/memory/file/backend.js";

/** Location of the shared database backing {@link sqlite}. */
export interface SqliteMemoryBackendOptions {
  /** Application root holding `data/openeve.db`. Defaults to `process.cwd()`. */
  readonly appRoot?: string;
}

/** Creates a document backend stored in the shared `data/openeve.db`. */
export function sqlite(options: SqliteMemoryBackendOptions = {}): MemoryDocumentBackend {
  const appRoot = options.appRoot ?? process.cwd();
  const instanceId = randomUUID();
  let revision = 0;
  let store: SqliteStore | undefined;
  const open = () => (store ??= openSqliteStore({ appRoot }));

  const readRow = (key: string): MemoryDocument | null => {
    const row = open()
      .db.prepare("SELECT content, version FROM memory_documents WHERE key = ?")
      .get(key) as { content: string; version: string } | undefined;
    return row === undefined ? null : { content: row.content, version: row.version };
  };

  return {
    async read({ key, signal }) {
      signal.throwIfAborted();
      return readRow(key);
    },
    async write({ content, expectedVersion, key, signal }) {
      signal.throwIfAborted();
      const version = `sql_${instanceId}_${++revision}`;
      const db = open().db;
      // One statement per branch so the compare-and-set is atomic in SQLite.
      const changes =
        expectedVersion === null
          ? db
              .prepare(
                "INSERT OR IGNORE INTO memory_documents (key, content, version) VALUES (?, ?, ?)",
              )
              .run(key, content, version).changes
          : db
              .prepare(
                "UPDATE memory_documents SET content = ?, version = ? WHERE key = ? AND version = ?",
              )
              .run(content, version, key, expectedVersion).changes;
      if (changes === 0) throw new MemoryDocumentConflictError(key);
      return { content, version };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter eve exec vitest run --config vitest.integration.config.ts src/public/memory/file/backends/sqlite.integration.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Export it**

In `packages/eve/src/public/memory/file/index.ts`, add alongside the existing `inMemory` export:

```ts
export { sqlite, type SqliteMemoryBackendOptions } from "#public/memory/file/backends/sqlite.js";
```

`sqlite()` belongs on the index rather than a separate subpath (the way `vercelBlob` sits behind `eve/memory/file/vercel`), because it adds no dependency and is the default.

- [ ] **Step 6: Gates and commit**

```bash
pnpm guard:invariants && node ./scripts/check-docs.mjs
git add packages/eve/src/public/memory/file
git commit -s -m "feat(open-eve): add the sqlite() file-memory backend"
```

### Task 3: Make `sqlite()` the default backend off Vercel — DONE (`a89605520`)

**Files:**

- Modify: `packages/eve/src/public/memory/file/backends/default.ts:36-50`
- Test: `packages/eve/src/public/memory/file/backends/default.test.ts` (extend)

**Interfaces:**

- Consumes: `sqlite()` from Task 2.
- Produces: no new exports. Changes behaviour of `defaultFileMemoryBackend()`.

Current behaviour throws off Vercel and outside `eve dev`. New behaviour returns `sqlite()`, so a self-hosted deployment works with no configuration.

- [ ] **Step 1: Write the failing test**

Add to the existing describe block in `default.test.ts`:

```ts
it("selects the sqlite backend when not deployed on Vercel", async () => {
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("EVE_DEV", "");
  const backend = defaultFileMemoryBackend();
  await expect(
    backend.read({ key: "k", signal: new AbortController().signal }),
  ).resolves.toBeNull();
  expect(get).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter eve exec vitest run --config vitest.unit.config.ts src/public/memory/file/backends/default.test.ts`
Expected: FAIL — "requires an explicit backend outside Vercel and eve dev"

This test stays in the **unit** tier only because `sqlite()` defers opening the database until its first statement, and `lazyBackend` defers backend construction. If it trips the fs guard, move it to a new `default.integration.test.ts` instead of weakening the guard.

- [ ] **Step 3: Replace the trailing throw**

In `selectDefaultFileMemoryBackend`, replace the final `throw new Error("fileMemory() requires an explicit backend outside Vercel and eve dev. Pass fileMemory({ backend }).")` with:

```ts
return sqlite();
```

and add the import:

```ts
import { sqlite } from "#public/memory/file/backends/sqlite.js";
```

Leave the Vercel arm and its error message untouched — that path is still correct when the Vercel host is selected.

- [ ] **Step 4: Run the full memory suite**

Run: `pnpm --filter eve exec vitest run --config vitest.unit.config.ts src/public/memory/file`
Expected: PASS

- [ ] **Step 5: Gates and commit**

```bash
pnpm guard:invariants && node ./scripts/check-docs.mjs
git add packages/eve/src/public/memory/file/backends/default.ts packages/eve/src/public/memory/file/backends/default.test.ts
git commit -s -m "feat(open-eve): default file memory to sqlite() off Vercel"
```

### Task 4: Host provider — the `agent.ts` field and its resolver — DONE (`584161889`)

**Files:**

- Create: `packages/eve/src/internal/host/provider.ts`
- Create: `packages/eve/src/public/hosts/vercel.ts`
- Test: `packages/eve/src/internal/host/provider.test.ts`
- Modify (8 threading points, all required — a `.strict()` schema or whitelist literal silently drops the field if any is missed):
  1. `packages/eve/src/shared/agent-definition.ts:336-380` — add `readonly host?: HostProviderDefinition;` to `PublicAgentDefinitionBase`
  2. `packages/eve/src/shared/agent-definition.ts:314-327` — add `host?: HostProviderDefinition;` to `InternalAgentDefinition`
  3. `packages/eve/src/internal/authored-definition/core.ts:51-68` — add `"host"` to `expectOnlyKnownKeys`, plus a normalizer and assignment near `:102`
  4. `packages/eve/src/compiler/normalize-agent-config.ts:79-98` — add `host` to the staging literal and copy it
  5. `packages/eve/src/compiler/manifest.ts:600-614` — add `host: z.literal(["self", "vercel"]).optional()` to `compiledAgentConfigBaseFields`
  6. `packages/eve/src/compiler/manifest.ts:1175-1233` — add `host: config.host` to `cloneCompiledAgentDefinition`
  7. `packages/eve/src/runtime/resolve-agent.ts:182-199` — add `host` to the staging literal and copy it
  8. `packages/eve/src/compiler/normalize-manifest-helpers.ts:27-38` — extend `assertRootOnlyConfig`, since `host` is root-only exactly like `experimental.workflow.world`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type HostProviderDefinition = "self" | "vercel"`
  - `function resolveHostProvider(configured?: HostProviderDefinition): HostProviderDefinition`
  - `function vercel(): HostProviderDefinition` (from `open-eve/hosts/vercel`)

**Precedence — mirror `createWorkflowWorldPluginSource`'s `input.configuredWorld ?? input.defaultWorld`:** the authored value always wins; the environment is only a fallback. This matters because several call sites (notably `internal/application/paths.ts:42`) run with no manifest in hand and must still behave correctly.

- [ ] **Step 1: Write the failing test**

```ts
// packages/eve/src/internal/host/provider.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveHostProvider } from "#internal/host/provider.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveHostProvider", () => {
  it("defaults to self with no configuration and no environment", () => {
    vi.stubEnv("VERCEL", "");
    expect(resolveHostProvider()).toBe("self");
  });

  it("honours an authored host over the environment", () => {
    vi.stubEnv("VERCEL", "1");
    expect(resolveHostProvider("self")).toBe("self");
  });

  it("falls back to vercel when the environment says so and nothing is authored", () => {
    vi.stubEnv("VERCEL", "1");
    expect(resolveHostProvider()).toBe("vercel");
  });

  it("treats a whitespace-only VERCEL value as unset", () => {
    vi.stubEnv("VERCEL", "   ");
    expect(resolveHostProvider()).toBe("self");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter eve exec vitest run --config vitest.unit.config.ts src/internal/host/provider.test.ts`
Expected: FAIL — cannot resolve `#internal/host/provider.js`

- [ ] **Step 3: Write the resolver**

```ts
/** Which host operates the runtime services for this agent. */
export type HostProviderDefinition = "self" | "vercel";

/**
 * Resolves the active host.
 *
 * The authored `host` in `agent/agent.ts` always wins. The environment is only
 * consulted when nothing is authored, which keeps build-time call sites that
 * cannot reach the compiled manifest behaving correctly.
 */
export function resolveHostProvider(configured?: HostProviderDefinition): HostProviderDefinition {
  if (configured !== undefined) return configured;
  return Boolean(process.env.VERCEL?.trim()) ? "vercel" : "self";
}
```

- [ ] **Step 4: Write the public marker**

```ts
// packages/eve/src/public/hosts/vercel.ts
import type { HostProviderDefinition } from "#internal/host/provider.js";

/** Runs this agent's services on Vercel: Workflow, Sandbox, Blob, and Cron. */
export function vercel(): HostProviderDefinition {
  return "vercel";
}
```

Add the subpath to `packages/eve/package.json#exports` following the existing `"./channels/chat-sdk"` entry shape.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter eve exec vitest run --config vitest.unit.config.ts src/internal/host/provider.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Thread the field through all 8 points listed above**

Then prove it survives the round trip by extending the compiler suite:

```ts
it("carries an authored host into the compiled manifest", async () => {
  const compiled = await compileAgentConfig(
    manifestWith({ host: "vercel", model: "openai/gpt-5.6-luna-fast" }),
    context,
    options,
  );
  expect(compiled.host).toBe("vercel");
});
```

- [ ] **Step 7: Verify the whole compile path**

Run: `pnpm --filter eve exec vitest run --config vitest.unit.config.ts src/compiler src/internal/authored-definition src/runtime/resolve-agent`
Expected: PASS. A failure naming an unrecognized key means one of the 8 points was missed.

- [ ] **Step 8: Typecheck and commit**

```bash
pnpm --filter eve run typecheck
pnpm guard:invariants && node ./scripts/check-docs.mjs
git add packages/eve/src packages/eve/package.json
git commit -s -m "feat(open-eve): add the host provider field and resolver"
```

### Task 5: Flip the call sites to `resolveHostProvider()` — DONE (`76399ab78`)

**Files:** the 19 executable sites, one line each. The 2 doc-comment mentions (`sandbox/backends/default.ts:31`, `shared/sandbox-definition.ts:89`) are prose updates only.

**Interfaces:**

- Consumes: `resolveHostProvider` from Task 4.
- Produces: no new exports.

Highest-value sites, all defaulting to `"self"`:

| file:line                                             | current                                                  | becomes                                                             |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| `internal/application/paths.ts:42`                    | `return Boolean(process.env.VERCEL);`                    | `return resolveHostProvider() === "vercel";`                        |
| `sandbox/backends/probes.ts:13`                       | `isDeployedOnVercel: () => Boolean(process.env.VERCEL),` | `isDeployedOnVercel: () => resolveHostProvider() === "vercel",`     |
| `internal/nitro/host/prepare-application-host.ts:152` | `if (process.env.VERCEL) {`                              | `if (resolveHostProvider() === "vercel") {`                         |
| `internal/nitro/host/create-application-nitro.ts:81`  | `return process.env.VERCEL ? "vercel" : undefined;`      | `return resolveHostProvider() === "vercel" ? "vercel" : undefined;` |
| `execution/session-callback-request.ts:86`            | `if (process.env.VERCEL !== "1") return headers;`        | `if (resolveHostProvider() !== "vercel") return headers;`           |

Apply the same single-line transform at the remaining sites: `execution/sandbox/prewarm.ts:383`, `internal/invocation/workflow-execution.ts:512`, `internal/nitro/host/build-application.ts:94,289`, `internal/nitro/host/sandbox-shutdown-plugin.ts:44`, `internal/nitro/host/vercel-build-prewarm.ts:19`, `public/channels/auth.ts:831`, `public/definitions/workspace-agent.ts:100`, `public/next/vercel-output-config.ts:73`.

**Deliberately NOT changed** — these execute inside the host framework's own config, before eve compiles, so environment detection is correct there: `public/next/index.ts:238,454`, `public/next/server.ts:527`, `public/nuxt/module.ts:117`, `public/sveltekit/index.ts:121`.

- [ ] **Step 1: Change one site and prove the default flipped**

```ts
// extend packages/eve/src/sandbox/backends/default.test.ts
it("does not select the Vercel sandbox when no host is configured", () => {
  vi.stubEnv("VERCEL", "");
  expect(selectDefaultSandbox({}, SANDBOX_BACKEND_PROBES).name).not.toBe("vercel");
});
```

- [ ] **Step 2: Run it, expect FAIL, apply the `probes.ts:13` change, run again**

Run: `pnpm --filter eve exec vitest run --config vitest.unit.config.ts src/sandbox`

- [ ] **Step 3: Apply the remaining sites, then run the full unit suite**

Run: `pnpm --filter eve run test:unit`
Expected: PASS. Investigate every failure — a test asserting Vercel-by-default is now asserting the old contract and must be updated deliberately, not deleted.

- [ ] **Step 4: Gates and commit**

```bash
pnpm --filter eve run typecheck
pnpm guard:invariants && node ./scripts/check-docs.mjs
git add packages/eve/src
git commit -s -m "feat(open-eve): resolve the host through resolveHostProvider()"
```

### Task 6: Zero-Vercel runtime guard — DONE (`38b377d93`)

**Files:**

- Create: `packages/eve/scripts/check-no-vercel-runtime.mjs`
- Modify: `packages/eve/package.json` — `check:no-vercel-runtime`, chained into `build` after `build:js`

**The plan's premise here was wrong, and the correction matters.** This task was
written as "fail the build if any `@vercel/*` specifier is reachable at runtime".
No such specifier exists. eve's only runtime `dependencies` are `nitro` and
`undici`; every `@vercel/*` package is a `devDependency` whose code is **vendored**
into the repository and imported as `#compiled/@vercel/*`. A guard looking for
bare specifiers would have passed on day one and proved nothing.

The real invariant is about the vendored copies: **no module reachable from the
self-hosted runtime may statically import `#compiled/@vercel/*`.** A static import
loads the code at import time, so a VPS deployment that authored no Vercel
anything still had the Blob client, the OIDC reader, and the `@vercel/otel`
registrar resident in memory.

Ten modules imported vendored Vercel code statically; five were runtime-reachable
and are now lazy:

| module                                       | package | how it loads now                                                                                |
| -------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `public/agents/auth.ts`                      | oidc    | `readVercelOidcToken()` wrapper, dynamic import                                                 |
| `internal/nitro/routes/info.ts`              | oidc    | same wrapper                                                                                    |
| `internal/model-auth/gateway-credential.ts`  | oidc    | same wrapper                                                                                    |
| `public/memory/file/backends/vercel-blob.ts` | blob    | dynamic import inside the async `read`/`write`                                                  |
| `tracing/otel-registration.ts`               | otel    | `loadRegisterOTel()` in `tracing/vercel-otel.ts`, `require` because registration is synchronous |

Three more moved to the wrapper so they stopped needing an allowance at all
(`execution/sandbox/bindings/vercel-credentials.ts`,
`services/dev-client/request-headers.ts`,
`setup/flows/model-login-connection.ts`). Two are allowed by name with a written
reason: `cli/agent-detection.js` (CLI only) and `public/sandbox/vercel.js`
(reachable only through an explicit `eve/sandbox/vercel` import).

The script allows dynamic `import()` and type-only imports, and it also fails when
an allowance stops being needed, so the list keeps naming real exceptions rather
than accumulating stale ones.

Verified red-to-green: adding a static `#compiled/@vercel/blob` import back to a
built runtime module exits non-zero and names the module.

### Task 6b: Bind the authored host to the call sites — DONE (`7b6a9c18f`)

**Not in the original plan, and Milestone 1 does not hold without it.** Tasks 4
and 5 left the `host` field inert: it compiled into the manifest and resolved out
of it, but all fourteen call sites called `resolveHostProvider()` with no
argument, so every one still resolved purely from `process.env.VERCEL`.

Runtime call sites are deep utilities with no definition in scope, and some fire
outside any request, so parameter threading was not available. The host now
travels the way the agent-scoped Workflow queue namespace already does: the
generated compiled-artifacts bootstrap calls `installHostProvider()` once at cold
start. Resolution order is explicit argument, then installed host, then
environment; an unrecognized installed value is ignored.

Build-time sites cannot use that channel, since the bootstrap they generate has
not run yet. The three holding the manifest in the calling frame pass it
explicitly. `writeOptionalApplicationBuildProfile`'s `target` label still reads
the environment, because no manifest reaches that frame — a profile label, not a
behavior switch.

**Milestone 1 exit criteria — measured 2026-09-20 on `apps/fixtures/weather-agent`,
with `VERCEL`, `VERCEL_ENV`, `VERCEL_OIDC_TOKEN`, and `BLOB_READ_WRITE_TOKEN` all
unset:**

| criterion                        | result                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `eve build` completes            | yes, exit 0                                                   |
| `eve start` completes            | yes, `HTTP 200` on `/`, Docker sandbox template built locally |
| `check:no-vercel-runtime` passes | yes                                                           |
| a real agent turn succeeds       | **not proven**                                                |

The built server bundle is the direct evidence for the headline claim. It contains
no `@vercel/blob`, no `@vercel/otel`, and no `@vercel/sandbox` chunk at all: with
nothing importing them statically, the bundler drops them. One `vercel__oidc.mjs`
chunk survives, reachable only through `await import("../_8.mjs")` from the AI SDK
gateway module, which loads it solely to authenticate against Vercel AI Gateway.

The agent turn is unproven for a reason unrelated to hosting: `POST /eve/v1/session`
answers `401 unauthorized`, and no model-provider credential is available on the
machine this was measured on. The server is live and enforcing authorization;
finishing this check needs a model credential and a configured principal.

---

## Milestone 2 — Channel state

### Task 7: `sqliteState()` Chat SDK state adapter — DONE (`9114ed18e`)

**Files:**

- Create: `packages/eve/src/public/channels/chat-sdk/state/sqlite.ts`
- Test: `packages/eve/src/public/channels/chat-sdk/state/sqlite.integration.test.ts`
- Modify: `packages/eve/src/public/channels/linq/linqChannel.ts:11,103` and `packages/eve/src/public/channels/photon/photonIMessageChannel.ts:10,93` — the only two sites hardcoding `createMemoryState()`

**Interfaces:**

- Consumes: `openSqliteStore` from Task 1.
- Produces: `sqliteState(options?: { readonly appRoot?: string }): StateAdapter`

eve never calls a `StateAdapter` method itself — it only hands the adapter to `ThreadImpl` via `bot.getState()`. So this task is purely additive to `chatSdkChannel.ts`, which needs no change.

Import the types from the vendored copy, never the bare package:

```ts
import type { Lock, QueueEntry, StateAdapter } from "#compiled/chat/index.js";
```

**The 18 methods** (exact signatures, from `chat@4.34.0`): `acquireLock(threadId, ttlMs)`, `appendToList(key, value, options?)`, `connect()`, `delete(key)`, `dequeue(threadId)`, `disconnect()`, `enqueue(threadId, entry, maxSize)`, `extendLock(lock, ttlMs)`, `forceReleaseLock(threadId)`, `get<T>(key)`, `getList<T>(key)`, `isSubscribed(threadId)`, `queueDepth(threadId)`, `releaseLock(lock)`, `set<T>(key, value, ttlMs?)`, `setIfNotExists(key, value, ttlMs?)`, `subscribe(threadId)`, `unsubscribe(threadId)`.

`Lock` is `{ expiresAt: number; threadId: string; token: string }`. `QueueEntry` is `{ enqueuedAt: number; expiresAt: number; message: Message }`.

**Implement to the stricter `chat@4.41.0` `extendLock` contract**, which is forward-compatible: _"compare the lock token and only extend a lock that is still held with that token — never create or resurrect one. Returns false when the lock is no longer held with this token."_

**The lock is the only primitive with real correctness risk.** Implement acquire as a single atomic statement so two callers cannot both win:

```sql
INSERT INTO channel_locks (thread_id, token, expires_at) VALUES (?, ?, ?)
  ON CONFLICT(thread_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
  WHERE channel_locks.expires_at <= ?
```

- [ ] **Step 1: Write the failing test** — cover, at minimum:

```ts
it("grants a lock once and refuses a second holder until expiry", async () => {
  const state = sqliteState({ appRoot });
  const first = await state.acquireLock("t1", 60_000);
  expect(first).not.toBeNull();
  await expect(state.acquireLock("t1", 60_000)).resolves.toBeNull();
  await state.releaseLock(first!);
  await expect(state.acquireLock("t1", 60_000)).resolves.not.toBeNull();
});

it("refuses to extend a lock held under a different token", async () => {
  const state = sqliteState({ appRoot });
  const lock = await state.acquireLock("t2", 60_000);
  await state.forceReleaseLock("t2");
  const stolen = await state.acquireLock("t2", 60_000);
  await expect(state.extendLock(lock!, 60_000)).resolves.toBe(false);
  expect(stolen).not.toBeNull();
});

it("expires TTL'd values and survives a new adapter instance", async () => {
  await sqliteState({ appRoot }).set("k", { a: 1 });
  await expect(sqliteState({ appRoot }).get("k")).resolves.toEqual({ a: 1 });
});

it("dequeues in FIFO order and reports depth", async () => {
  const state = sqliteState({ appRoot });
  await state.enqueue("t3", entry("one"), 10);
  await state.enqueue("t3", entry("two"), 10);
  await expect(state.queueDepth("t3")).resolves.toBe(2);
  expect((await state.dequeue("t3"))?.message).toMatchObject({ text: "one" });
});

it("discards queue entries past expiresAt on dequeue", async () => {
  /* … */
});
it("trims appendToList to maxLength keeping newest", async () => {
  /* … */
});
it("setIfNotExists returns false for an existing key", async () => {
  /* … */
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter eve exec vitest run --config vitest.integration.config.ts src/public/channels/chat-sdk/state/sqlite.integration.test.ts`

- [ ] **Step 3: Implement all 18 methods.** `connect()` and `disconnect()` are no-ops beyond opening and closing the store. Values are JSON-serialized into the `channel_kv`, `channel_lists`, and `channel_queues` tables from Task 1's schema. Sweep expired rows lazily on read rather than with a timer.

- [ ] **Step 4: Run, confirm pass. Then switch the two call sites** from `createMemoryState()` to `sqliteState()` and run `pnpm --filter eve run test:unit`.

- [ ] **Step 5: Gates and commit**

```bash
pnpm guard:invariants && node ./scripts/check-docs.mjs
git commit -s -m "feat(open-eve): add the sqliteState() Chat SDK state adapter"
```

**Task 7 landed as `9114ed18e`.** Two findings came out of it that the plan did
not anticipate.

The first was a live bug in Task 1's store, fixed in the same commit:
`openSqliteStore` ran `PRAGMA journal_mode = WAL` before `PRAGMA busy_timeout`.
The journal-mode switch takes an exclusive lock, so a second process opening
`data/openeve.db` at the same moment failed outright with
`SQLITE_ERROR: database is locked` rather than waiting. This affected the
`sqlite()` memory backend equally. Pragma order is now busy_timeout first.

The second is Task 7b, below.

### Task 7b: Vendor chat's second declaration chunk — DONE (`178821fea`)

**Files:** `packages/eve/scripts/vendor-compiled/chat.mjs`

**The entire vendored `chat` type surface is `any` today.** chat@4.34.0 emits two
content-hashed declaration chunks, `jsx-runtime-_JEEAotp.d.ts` and
`messages-BSoJG691.d.ts`. The copier's `discoverExtraFiles` filter matches only
`/^jsx-runtime-[^./]+\.d\.ts$/`, so the messages chunk is never copied.
`.generated/compiled/chat/index.d.ts` re-exports `StateAdapter`, `Lock`,
`QueueEntry`, `Message`, `Thread`, and `Author` from that missing file, and
`skipLibCheck` swallows the unresolved import, so every one of them degrades to
`any`. Verified with a probe asserting `0 extends 1 & StateAdapter`, which
compiles clean.

This defeats the copier's own stated purpose, quoted from its docblock: "the
public type contract has to be the _actual_ chat shape — hand-written stubs
would drift on every version bump." It is a bug in eve, not in open-eve, and is
a good upstream PR candidate.

The fix is to match any content-hashed sibling chunk rather than one chunk by
name. Hardcoding `jsx-runtime-` is what broke: the hash changes every release,
and so does the set of chunks.

**Consequence to handle in the same commit.** Restoring real types surfaces
roughly nine pre-existing errors, eight of them a missing `Author.fullName` in
linq and photon test fixtures, and one a `Thread<unknown, unknown>` variance
issue at `chatSdkChannel.ts:283`. Typecheck must be green before commit, so
these are part of the task, not follow-up.

**Sequencing.** Do this when no other agent is working in the tree. Regenerating
`.generated/` mid-flight makes an unrelated agent's `typecheck` gate fail with
errors it did not cause.

---

## Milestone 3 — Scaffolds

### Task 8: Portable credentials for every integration — DONE (`9c2567a04`)

**Files:**

- Create: `packages/eve/src/setup/integrations/shared/portable-credentials.ts`
- Modify: `discord/setup.ts:47-55`, `github/setup.ts:65-94`, `linear/setup.ts:42-50`, `teams/setup.ts:29-37` — these four are **Vercel-Connect-only today and have no portable branch at all**
- Modify: `slack/setup.ts:96-103,130-171,173-250`, `linq/setup.ts`, `photon/setup-flow.ts` — flip the existing branch so portable is the default
- Modify: `setup/scaffold/create/project.ts:203` and `setup/scaffold/create/add-to-project.ts:143` — stop pinning `@vercel/connect` unconditionally

**Interfaces:**

- Produces: `askPortableCredentials(context, input): Promise<CredentialChoice>` and `writePortableEnv(input): Promise<void>`

Slack is the reference implementation: on `"environment"` it returns immediately with no `resolveVercelProject`, no connector inspection, and no network, then writes `SLACK_BOT_TOKEN=` / `SLACK_SIGNING_SECRET=` as empty placeholders into `.env.example` with rollback if the channel write throws.

**Three inconsistencies to unify, carefully:**

1. **Discriminant names differ.** slack and photon use `"environment" | "vercel-connect"`; linq uses `"portable" | "connect"`. Unify the internal type — but **do not change the prompt option `id` values** (`"vercel"` / `"portable"`), because headless setup keys answers off `id` and changing them breaks scripted and agent-driven runs.
2. **Env targets differ.** slack writes empty placeholders to `.env.example`; linq, photon, and shopify write real secrets to `.env.local`. Keep each integration's existing target; only the choice mechanism is shared.
3. **`@vercel/connect` is pinned unconditionally** in every scaffold regardless of credential choice, with comments at `project.ts:456` and `add-to-project.ts:124` explaining it avoids a reinstall on later `eve add` runs. Make the pin conditional on the Connect branch being chosen. **Integration tests assert the exact pinned string** and will need updating.

- [ ] **Step 1** — Write a failing test per integration asserting the generated `agent/channels/<name>.ts` contains no `@vercel/connect` import on the portable branch. Follow the standard integration test shape already used in the suite.
- [ ] **Step 2** — Run, confirm failure.
- [ ] **Step 3** — Add the shared helper, then the portable branch to discord, github, linear, teams.
- [ ] **Step 4** — Flip the default to portable for all seven.
- [ ] **Step 5** — Make the `@vercel/connect` pin conditional; update the tests asserting the pinned string.
- [ ] **Step 6** — `pnpm --filter eve run test:unit && pnpm --filter eve run test:integration`, gates, commit.

### Task 9: `openeve init` model flow — DROPPED

**Files:**

- Modify: `packages/eve/src/setup/boxes/select-model.ts`, `setup/flows/model-login.ts:74`, `setup/provider-settings.ts`, and the `--model` default in `cli/run.ts`

Replace the AI Gateway model-ID default (`openai/gpt-5.6-luna-fast`) with provider detection: offer a locally detected Ollama endpoint first, then a self-hosted LiteLLM proxy, then direct providers. Local and proxy options generate an AI SDK provider with a `baseURL` override rather than a bespoke helper:

```ts
import { createOpenAI } from "@ai-sdk/openai";

const local = createOpenAI({ baseURL: "http://127.0.0.1:11434/v1", apiKey: "ollama" });

export default defineAgent({ model: local("qwen3:8b") });
```

**Dropped 2026-09-20.** This task assumed eve needed a change before a
self-hosted model could be used. It does not.
`PublicAgentStaticModelDefinition` is `string | LanguageModel`
(`src/shared/agent-definition.ts:59`), so any AI SDK provider object already
works:

```ts
import { createOpenAI } from "@ai-sdk/openai";

const local = createOpenAI({ apiKey: "ollama", baseURL: "http://127.0.0.1:11434/v1" });

export default defineAgent({ model: local("qwen3:8b") });
```

Ollama, LiteLLM, vLLM, and anything else OpenAI-compatible are reachable today
with no framework code. What Task 9 would have added is an interactive picker
in `openeve init` plus local-endpoint detection — convenience, not capability,
and it carried the four `provider/model`-shape branches below as its cost. Not
worth it. The remaining work is a documentation page showing the pattern above.

The partial implementation was reverted rather than committed.

**Two traps (no longer relevant):**

- `model-login.ts:74` hardcodes `"openai/gpt-5.6-luna-fast"` instead of importing `DEFAULT_AGENT_MODEL_ID`. Both must change together.
- The gateway `provider/model` shape is load-bearing in four places beyond the picker: `validateModelSlug` (`!slug.includes("/")` plus a catalog lookup), `modelProviderSlug`, `byokProviderEnvVar`, and `select-model.ts`'s `m.id.split("/")[0]` provider label. A provider object has no slug, so each needs an explicit branch.

- [ ] **Step 1-6** — Failing test on generated `agent/agent.ts` source, implement, verify, gates, commit.

---

## Milestone 4 — Gate Vercel, rebrand, registry

### Task 10: Gate the Vercel path

Move `@vercel/*` from `dependencies`/`devDependencies` to `optionalDependencies` where required, and make `openeve link` / `openeve deploy` appear only when the Vercel host is selected. All 55 Vercel-named files stay in place, gated — never deleted.

### Task 11: Rebrand

`packages/eve/package.json` only: `"name": "open-eve"`, `"bin": { "openeve": "./bin/eve.js", "eve": "./bin/eve.js" }`. **No file or directory is renamed.**

### Task 12: Registry

Publish the open-eve registry as static shadcn JSON generated from the fork, and change `DEFAULT_OFFICIAL_REGISTRY_URL` at `packages/eve/src/cli/commands/registry.ts:111`. Users can still point elsewhere with `openeve registry add`.

---

## Milestone 5 — Templates

### Task 13: De-Vercelize all 12 templates

One repeatable recipe per template, in `apps/templates/`:

| Coupling             | Affected        | Replacement              |
| -------------------- | --------------- | ------------------------ |
| `@vercel/connect`    | 7 of 8 external | portable credentials     |
| `@vercel/blob`       | 6 of 8 external | `sqlite()`               |
| AI Gateway model IDs | 16 occurrences  | provider plus `baseURL`  |
| Neon, Upstash Redis  | chat            | local Postgres and Redis |

`mux-video-agent` already carries no `@vercel/*`. These 12 are independent of one another and parallelize cleanly.

---

## Deferred to v2

- **`s3()` memory backend** — needs ~120 lines of in-repo SigV4 (`node:crypto` HMAC chain, canonical request construction) since no AWS SDK may be added. Security-sensitive; warrants its own review.
- **Traces into SQLite** — ~750 lines rewritten across `local-trace-reader.ts`, `local-trace-retention.ts`, the TUI incremental cache, and 6 consumers, for zero Vercel removal.
- **Upstream PR for `resolveHostProvider()`** — propose to `vercel/eve` once v1 works. If accepted, Task 5's 19 edits disappear from the fork permanently.
