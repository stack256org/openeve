#!/usr/bin/env node
/**
 * Publishes packages/eve to npm as @stack256org/openeve.
 *
 * The package keeps the name `eve` in the repository: the name is also the
 * import specifier, and `src/self-modification/**` imports `eve/...` through
 * Node's package self-reference, which only resolves while the manifest says
 * `eve`. Renaming it breaks `tsc -p tsconfig.build.json`. So the build runs
 * under the repository name, the manifest is swapped only long enough to pack,
 * and the swap is always undone.
 *
 * Consumers install the result under the `eve` alias
 * (`"eve": "npm:@stack256org/openeve@^x.y.z"`), which `eve init` writes for
 * them.
 *
 * pnpm packs and npm uploads, because each does one half of the job:
 * `npm pack` leaves pnpm's `catalog:` protocol in `peerDependencies`, which no
 * consumer can install, and `pnpm publish` cannot authenticate with OIDC
 * trusted publishing (pnpm/pnpm#9812).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
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
const tarballName = `${PUBLISHED_PACKAGE_NAME.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
const tarballPath = join(packageDirectory, tarballName);

console.log(`Building ${name}@${version} before renaming it to ${PUBLISHED_PACKAGE_NAME}.`);
run("pnpm", ["--filter", "eve", "run", "build"], repositoryRoot);
run("pnpm", ["--filter", "eve", "run", "build:types"], repositoryRoot);

writeFileSync(
  manifestPath,
  `${JSON.stringify({ ...JSON.parse(originalManifest), name: PUBLISHED_PACKAGE_NAME }, null, 2)}\n`,
);

try {
  run("pnpm", ["pack", "--ignore-scripts"], packageDirectory);
} finally {
  writeFileSync(manifestPath, originalManifest);
  console.log(`Restored the manifest name to ${name}.`);
}

try {
  run(
    "npm",
    ["publish", tarballName, "--access", "public", ...process.argv.slice(2)],
    packageDirectory,
  );
  console.log(`Published ${PUBLISHED_PACKAGE_NAME}@${version}.`);
} finally {
  rmSync(tarballPath, { force: true });
}
