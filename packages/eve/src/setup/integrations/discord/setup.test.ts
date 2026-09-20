import { describe, expect, it, vi } from "vitest";
import { createFakePrompter } from "#internal/testing/fake-prompter.js";
import { headlessAsker, withAnswers } from "#setup/ask.js";
import { integrationSetupEnvironment } from "../shared/environment.js";
import { createSetupContexts } from "../shared/ui.js";
import { applyDiscordSetup, prepareDiscordSetup, type DiscordSetupDeps } from "./setup.js";

const ANSWERS = {
  "discord-bot-token": " bot-token ",
  "discord-command-name": "ask",
  "discord-command-description": "Ask the eve agent",
  "discord-credentials": "vercel",
};
function deps(): DiscordSetupDeps {
  return {
    appendEnv: vi.fn(async () => ({ written: [], skipped: [] })),
    configureEndpoint: vi.fn(async () => {}),
    deriveConnectorSlug: vi.fn(async () => "agent" as never),
    provisionConnector: vi.fn(async () => ({ id: "connector", uid: "discord/agent" })),
    registerCommand: vi.fn(async () => {}),
    resolveApplication: vi.fn(async () => ({ id: "app", name: "Agent", publicKey: "key" })),
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

describe("Discord setup", () => {
  it("prepares all input before applying", async () => {
    const effects = deps();
    const ctx = contexts(ANSWERS);
    const plan = await prepareDiscordSetup(ctx.prepare, effects);
    expect(effects.resolveApplication).not.toHaveBeenCalled();
    await applyDiscordSetup(plan, ctx.apply, effects);
    expect(effects.resolveApplication).toHaveBeenCalledWith("bot-token");
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/discord.ts",
      expect.stringContaining("discord/agent"),
      { force: undefined },
    );
  });
  it("refuses missing input before mutation", async () => {
    const effects = deps();
    await expect(
      prepareDiscordSetup(contexts({ "discord-credentials": "vercel" }).prepare, effects),
    ).rejects.toMatchObject({
      prerequisite: { kind: "environment", variable: "DISCORD_BOT_TOKEN" },
    });
    expect(effects.resolveApplication).not.toHaveBeenCalled();
  });
  it("scaffolds portable credentials without a Vercel project", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" }));
    const ctx = contexts(
      { ...ANSWERS, "discord-credentials": "portable" },
      resolveVercelProject,
      "logged-out",
    );

    const plan = await prepareDiscordSetup(ctx.prepare, effects);
    await applyDiscordSetup(plan, ctx.apply, effects);

    expect(resolveVercelProject).not.toHaveBeenCalled();
    expect(effects.provisionConnector).not.toHaveBeenCalled();
    expect(effects.configureEndpoint).not.toHaveBeenCalled();
    expect(effects.writeTextFile).toHaveBeenCalledWith(
      "/project/agent/channels/discord.ts",
      expect.not.stringContaining("@vercel/connect"),
      { force: undefined },
    );
    expect(effects.appendEnv).toHaveBeenCalledWith("/project/.env.local", {
      DISCORD_APPLICATION_ID: "app",
      DISCORD_BOT_TOKEN: "bot-token",
      DISCORD_PUBLIC_KEY: "key",
    });
  });
  it("requires a linked project", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => {
      throw new Error("eve link");
    });
    await expect(
      prepareDiscordSetup(contexts(ANSWERS, resolveVercelProject).prepare, effects),
    ).rejects.toThrow("eve link");
    expect(effects.provisionConnector).not.toHaveBeenCalled();
  });
  it("routes logged-out setup through the project resolver", async () => {
    const effects = deps();
    const resolveVercelProject = vi.fn(async () => ({ orgId: "team", projectId: "project" }));

    await expect(
      prepareDiscordSetup(contexts(ANSWERS, resolveVercelProject, "logged-out").prepare, effects),
    ).resolves.toMatchObject({ project: { orgId: "team", projectId: "project" } });
    expect(resolveVercelProject).toHaveBeenCalledWith("Discord");
  });
});
