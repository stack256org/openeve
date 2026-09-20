import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";

test("the public extension exposes only the intended non-search tools", async () => {
  const toolsUrl = new URL("../extension/tools/", import.meta.url);
  const toolFiles = (await readdir(toolsUrl)).sort();

  assert.deepEqual(toolFiles, [
    "create_asset.ts",
    "create_clip.ts",
    "get_asset.ts",
    "get_workflow_job.ts",
    "run_workflow.ts",
  ]);
});
