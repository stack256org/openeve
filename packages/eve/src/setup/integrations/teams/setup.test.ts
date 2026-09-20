import { describe, expect, it, vi } from "vitest";

import { createFakePrompter } from "#internal/testing/fake-prompter.js";
import { headlessAsker, withAnswers } from "#setup/ask.js";
import { integrationSetupEnvironment } from "../shared/environment.js";
import { createSetupContexts } from "../shared/ui.js";
import { applyTeamsSetup, prepareTeamsSetup, type TeamsSetupDeps } from "./setup.js";

function deps(): TeamsSetupDeps {
  return {
    appendEnv: vi.fn(async () => ({ written: [], skipped: [] })),
    provisionConnector: vi.fn(async () => ({
      id: "scl_teams",
      uid: "microsoft-teams/agent",
    })),
    runVercel: vi.fn(),
    runVercelCaptureStdout: vi.fn(),
    writeTextFile: vi.fn(async () => {}),
  };
}

function contexts(
  answers: Record<string, unknown>,
  resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" })),
) {
  return createSetupContexts({
    appRoot: "/project",
    asker: withAnswers(answers)(headlessAsker()),
    environment: integrationSetupEnvironment("authenticated", { kind: "unresolved" }),
    prompter: createFakePrompter().prompter,
    resolveVercelProject,
  });
}

describe("Microsoft Teams setup", () => {
  it("delegates setup to the Connect CLI and scaffolds its connector", async () => {
    const effects = deps();
    const ctx = contexts({ "teams-credentials": "vercel", "teams.bot-name": " Agent " });

    const plan = await prepareTeamsSetup(ctx.prepare);
    expect(effects.provisionConnector).not.toHaveBeenCalled();
    await expect(applyTeamsSetup(plan, ctx.apply, effects)).resolves.toMatchObject({
      deploymentRequired: true,
    });

    expect(effects.provisionConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Agent",
        project: { orgId: "team", projectId: "project" },
      }),
    );
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/teams.ts",
      expect.stringContaining('connectTeamsCredentials("microsoft-teams/agent")'),
      { force: undefined },
    );
  });

  it("scaffolds portable credentials without a Vercel project", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" }));
    const ctx = contexts({ "teams-credentials": "portable" }, resolveVercelProject);

    const plan = await prepareTeamsSetup(ctx.prepare);
    await applyTeamsSetup(plan, ctx.apply, effects);

    expect(resolveVercelProject).not.toHaveBeenCalled();
    expect(effects.provisionConnector).not.toHaveBeenCalled();
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/teams.ts",
      expect.not.stringContaining("@vercel/connect"),
      { force: undefined },
    );
    expect(effects.appendEnv).toHaveBeenCalledWith("/project/.env.example", {
      MICROSOFT_APP_ID: "",
      MICROSOFT_APP_PASSWORD: "",
      MICROSOFT_TENANT_ID: "",
    });
  });
});
