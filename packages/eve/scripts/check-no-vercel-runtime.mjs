import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { loadNitroRolldownParseAst } from "./nitro-rolldown.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = join(packageRoot, "dist", "src");
const { parseAst } = await loadNitroRolldownParseAst();

const VENDORED_VERCEL = /^#compiled\/@vercel\//;

/**
 * Modules allowed to load vendored Vercel code when they are imported.
 *
 * Runtime modules must not appear here: a self-hosted deployment loads them
 * without ever authoring `host: vercel()`, so a static import there puts Vercel
 * code in memory on a machine that asked for none. Each entry states why the
 * module is not runtime-reachable.
 */
const ALLOWED = new Map([
  [
    "cli/agent-detection.js",
    "CLI only: runs on the author's machine, never in the deployed server.",
  ],
  [
    "public/sandbox/vercel.js",
    'Opt-in export: reachable only from `import ... from "eve/sandbox/vercel"`.',
  ],
]);

async function* walkJavaScriptFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "compiled") continue;
      yield* walkJavaScriptFiles(path);
    } else if (entry.isFile() && /\.(?:c|m)?js$/.test(entry.name)) {
      yield path;
    }
  }
}

function staticSpecifier(statement) {
  if (statement.type === "ImportDeclaration") {
    return statement.importKind === "type" ? undefined : statement.source?.value;
  }
  if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") {
    if (statement.source === null || statement.source === undefined) return undefined;
    return statement.exportKind === "type" ? undefined : statement.source.value;
  }
  return undefined;
}

const violations = [];
const unusedAllowances = new Set(ALLOWED.keys());

for await (const path of walkJavaScriptFiles(distRoot)) {
  const module = relative(distRoot, path);
  const source = await readFile(path, "utf8");
  const ast = parseAst(
    source,
    { astType: "ts", lang: "js", range: true, sourceType: "module" },
    relative(packageRoot, path),
  );

  for (const statement of ast.body ?? []) {
    const specifier = staticSpecifier(statement);
    if (typeof specifier !== "string" || !VENDORED_VERCEL.test(specifier)) continue;
    if (ALLOWED.has(module)) {
      unusedAllowances.delete(module);
      continue;
    }
    violations.push({ module, specifier });
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    process.stderr.write(
      `${violation.module} statically imports "${violation.specifier}", so a self-hosted ` +
        "deployment loads Vercel code it never asked for. Load it with a dynamic `import()` on " +
        "the branch that needs it, or add the module to ALLOWED in this script with the reason " +
        "it is not reachable at runtime.\n",
    );
  }
  process.exit(1);
}

if (unusedAllowances.size > 0) {
  for (const module of unusedAllowances) {
    process.stderr.write(
      `${module} is listed in ALLOWED but no longer imports vendored Vercel code. Remove the ` +
        "entry so the allowance list keeps naming real exceptions.\n",
    );
  }
  process.exit(1);
}

process.stdout.write("[eve:check-no-vercel-runtime] ok\n");
