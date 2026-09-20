import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ensurePnpmWorkspaceIncludesProject } from "#setup/primitives/pm/pnpm.js";
import { useTemporaryDirectories } from "#internal/testing/use-temporary-app-roots.js";

const createScratchDirectory = useTemporaryDirectories();

async function workspaceWith(manifest: string): Promise<{ projectRoot: string; path: string }> {
  const workspaceRoot = await createScratchDirectory("pnpm-workspace-");
  const path = join(workspaceRoot, "pnpm-workspace.yaml");
  await writeFile(path, manifest, "utf8");
  const projectRoot = join(workspaceRoot, "my-agent");
  await mkdir(projectRoot, { recursive: true });
  return { path, projectRoot };
}

describe("ensurePnpmWorkspaceIncludesProject", () => {
  it("appends to a block sequence", async () => {
    const { path, projectRoot } = await workspaceWith("packages:\n  - apps/*\n");

    await expect(ensurePnpmWorkspaceIncludesProject(projectRoot)).resolves.toBe("written");
    await expect(readFile(path, "utf8")).resolves.toBe("packages:\n  - apps/*\n  - my-agent\n");
  });

  // A second `packages:` key makes the manifest invalid, and pnpm then sees
  // only one of the two lists.
  it("rewrites an empty inline sequence instead of adding a second key", async () => {
    const { path, projectRoot } = await workspaceWith("packages: []\n");

    await expect(ensurePnpmWorkspaceIncludesProject(projectRoot)).resolves.toBe("written");
    await expect(readFile(path, "utf8")).resolves.toBe("packages:\n  - my-agent\n");
  });

  it("keeps the entries already in an inline sequence", async () => {
    const { path, projectRoot } = await workspaceWith('packages: ["apps/*", other/*]\n');

    await expect(ensurePnpmWorkspaceIncludesProject(projectRoot)).resolves.toBe("written");
    await expect(readFile(path, "utf8")).resolves.toBe(
      'packages:\n  - "apps/*"\n  - other/*\n  - my-agent\n',
    );
  });

  it("leaves a manifest that already lists the project alone", async () => {
    const { path, projectRoot } = await workspaceWith("packages:\n  - my-agent\n");

    await expect(ensurePnpmWorkspaceIncludesProject(projectRoot)).resolves.toBe("skipped");
    await expect(readFile(path, "utf8")).resolves.toBe("packages:\n  - my-agent\n");
  });

  it("leaves a value it cannot rewrite faithfully alone", async () => {
    const { path, projectRoot } = await workspaceWith("packages: &shared [apps/*]\n");

    await expect(ensurePnpmWorkspaceIncludesProject(projectRoot)).resolves.toBe("skipped");
    await expect(readFile(path, "utf8")).resolves.toBe("packages: &shared [apps/*]\n");
  });
});
