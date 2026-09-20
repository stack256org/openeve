import { describe, expect, it, vi } from "vitest";
import { createFakePrompter } from "#internal/testing/fake-prompter.js";
import { headlessAsker, InteractionRequired, withAnswers } from "#setup/ask.js";
import { integrationSetupEnvironment } from "../shared/environment.js";
import { createSetupContexts } from "../shared/ui.js";
import { applyGitHubSetup, prepareGitHubSetup, type GitHubSetupDeps } from "./setup.js";

function deps(): GitHubSetupDeps {
  return {
    appendEnv: vi.fn(async () => ({ written: [], skipped: [] })),
    deriveConnectorSlug: vi.fn(async () => "agent" as never),
    provisionConnector: vi.fn(async () => ({ appSlug: "agent", id: "id", uid: "github/agent" })),
    writeTextFile: vi.fn(async () => {}),
  };
}
function contexts(
  answers: Record<string, unknown>,
  resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" })),
  auth: Parameters<typeof integrationSetupEnvironment>[0] = "authenticated",
) {
  return createSetupContexts({
    appRoot: "/project",
    asker: withAnswers(answers)(headlessAsker()),
    environment: integrationSetupEnvironment(auth, { kind: "unresolved" }),
    prompter: createFakePrompter().prompter,
    resolveVercelProject,
  });
}

describe("GitHub setup", () => {
  it("prepares before provisioning and scaffolding", async () => {
    const effects = deps();
    const ctx = contexts({
      "github-credentials": "vercel",
      "github-events": ["issue_comment", "issues"],
    });
    const plan = await prepareGitHubSetup(ctx.prepare, effects);
    expect(effects.provisionConnector).not.toHaveBeenCalled();
    await expect(applyGitHubSetup(plan, ctx.apply, effects)).resolves.toMatchObject({
      deploymentRequired: true,
    });
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/github.ts",
      expect.stringContaining("onIssue"),
      { force: undefined },
    );
  });
  it("refuses missing input before discovery", async () => {
    const effects = deps();
    await expect(prepareGitHubSetup(contexts({}).prepare, effects)).rejects.toBeInstanceOf(
      InteractionRequired,
    );
    expect(effects.provisionConnector).not.toHaveBeenCalled();
  });
  it("scaffolds portable credentials without a Vercel project", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" }));
    const ctx = contexts(
      { "github-credentials": "portable", "github-events": ["issue_comment"] },
      resolveVercelProject,
      "logged-out",
    );

    const plan = await prepareGitHubSetup(ctx.prepare, effects);
    await applyGitHubSetup(plan, ctx.apply, effects);

    expect(resolveVercelProject).not.toHaveBeenCalled();
    expect(effects.provisionConnector).not.toHaveBeenCalled();
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/github.ts",
      expect.not.stringContaining("@vercel/connect"),
      { force: undefined },
    );
    expect(effects.appendEnv).toHaveBeenCalledWith("/project/.env.example", {
      GITHUB_APP_ID: "",
      GITHUB_APP_PRIVATE_KEY: "",
      GITHUB_APP_SLUG: "",
      GITHUB_WEBHOOK_SECRET: "",
    });
  });
  it("requires a linked project", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => {
      throw new Error("eve link");
    });
    const ctx = contexts(
      { "github-credentials": "vercel", "github-events": ["issue_comment"] },
      resolveVercelProject,
    );
    await expect(prepareGitHubSetup(ctx.prepare, effects)).rejects.toThrow("eve link");
    expect(effects.provisionConnector).not.toHaveBeenCalled();
  });
  it("routes logged-out setup through the project resolver", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" }));

    await expect(
      prepareGitHubSetup(
        contexts(
          { "github-credentials": "vercel", "github-events": ["issue_comment"] },
          resolveVercelProject,
          "logged-out",
        ).prepare,
        effects,
      ),
    ).resolves.toMatchObject({ project: { orgId: "team", projectId: "project" } });
    expect(resolveVercelProject).toHaveBeenCalledWith("GitHub");
  });
});
