import { describe, expect, it, vi } from "vitest";

import { createFakePrompter } from "#internal/testing/fake-prompter.js";
import { headlessAsker, withAnswers, withPolicy } from "#setup/ask.js";

vi.mock("#setup/scaffold/index.js", () => ({
  deriveSlackConnectorSlug: vi.fn(async () => "agent"),
}));

import { applyLinqSetup, prepareLinqSetup, type LinqSetupDeps } from "./setup.js";
import { integrationSetupEnvironment } from "../shared/environment.js";
import { createSetupContexts } from "../shared/ui.js";

function deps(): LinqSetupDeps {
  return {
    appendEnv: vi.fn(async () => ({ written: [], skipped: [] })),
    listPhoneNumbers: vi.fn(async () => ["+14155550123", "+14155550124"]),
    writeTextFile: vi.fn(async () => {}),
  };
}

function contexts(answers: Record<string, unknown> = {}) {
  return createSetupContexts({
    appRoot: "/project",
    asker: withAnswers(answers)(withPolicy("assume")(headlessAsker())),
    environment: integrationSetupEnvironment("authenticated", { kind: "unresolved" }),
    prompter: createFakePrompter().prompter,
    resolveVercelProject: vi.fn(async () => ({ orgId: "team", projectId: "project" })),
  });
}

describe("Linq setup", () => {
  it("scaffolds portable credentials by default", async () => {
    const effects = deps();
    const ctx = contexts({ "linq-api-key": "key", "linq-signing-secret": "secret" });

    const plan = await prepareLinqSetup(ctx.prepare, effects);
    await applyLinqSetup(plan, ctx.apply, effects);

    expect(plan).toMatchObject({ credentials: "environment" });
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/linq.ts",
      expect.not.stringContaining("@vercel/connect"),
      { force: undefined },
    );
    expect(effects.appendEnv).toHaveBeenCalledWith("/project/.env.local", {
      LINQ_API_KEY: "key",
      LINQ_WEBHOOK_SECRET: "secret",
    });
  });

  it("prepares a managed Linq account for Vercel Connect", async () => {
    await expect(
      prepareLinqSetup(contexts({ "linq-credentials": "connect" }).prepare, deps()),
    ).resolves.toMatchObject({
      credentials: "vercel-connect",
      connectorSlug: "agent",
      project: { orgId: "team", projectId: "project" },
    });
  });

  it("fetches an existing Linq account's agent phone numbers", async () => {
    const context = contexts({
      "linq-credentials": "connect",
      "linq-account": "existing",
      "linq-existing-api-token": "linq-token",
      "linq-existing-phone-numbers": ["+14155550124"],
    });
    const setupDeps = deps();

    await expect(prepareLinqSetup(context.prepare, setupDeps)).resolves.toMatchObject({
      existingAccount: {
        apiToken: "linq-token",
        phoneNumbers: ["+14155550124"],
      },
    });
    expect(setupDeps.listPhoneNumbers).toHaveBeenCalledWith("linq-token", undefined);
  });
});
