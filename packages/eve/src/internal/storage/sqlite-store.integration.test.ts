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
