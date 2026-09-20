#!/usr/bin/env node
/**
 * Publishes packages/eve to npm as @stack256org/openeve.
 *
 * The package keeps the name `eve` in the repository: the name is also the
 * import specifier, and `src/self-modification/**` imports `eve/...` through
 * Node's package self-reference, which only resolves while the manifest says
 * `eve`. Renaming it breaks `tsc -p tsconfig.build.json`. So the build runs
 * under the repository name, the manifest is swapped only for the upload, and
 * the swap is always undone.
 *
 * Consumers install the result under the `eve` alias
 * (`"eve": "npm:@stack256org/openeve@^x.y.z"`), which `eve init` writes for
 * them. pnpm does the publishing because `npm publish` leaves pnpm's
 * `catalog:` protocol in `peerDependencies`, which no consumer can install.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLISHED_PACKAGE_NAME = "@stack256org/openeve";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirectory = join(repositoryRoot, "packages", "eve");
const manifestPath = join(packageDirectory, "package.json");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status ?? result.signal}`);
  }
}

const originalManifest = readFileSync(manifestPath, "utf8");
const { name, version } = JSON.parse(originalManifest);

console.log(`Building ${name}@${version} before renaming it to ${PUBLISHED_PACKAGE_NAME}.`);
run("pnpm", ["--filter", "eve", "run", "build"], repositoryRoot);
run("pnpm", ["--filter", "eve", "run", "build:types"], repositoryRoot);

writeFileSync(
  manifestPath,
  `${JSON.stringify({ ...JSON.parse(originalManifest), name: PUBLISHED_PACKAGE_NAME }, null, 2)}\n`,
);

try {
  run(
    "pnpm",
    [
      "publish",
      "--access",
      "public",
      "--no-git-checks",
      "--ignore-scripts",
      ...process.argv.slice(2),
    ],
    packageDirectory,
  );
  console.log(`Published ${PUBLISHED_PACKAGE_NAME}@${version}.`);
} finally {
  writeFileSync(manifestPath, originalManifest);
  console.log(`Restored the manifest name to ${name}.`);
}
