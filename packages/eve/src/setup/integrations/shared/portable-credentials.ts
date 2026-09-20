import { join } from "node:path";

import { appendEnv } from "#setup/append-env.js";
import { select } from "#setup/ask.js";

import type { SetupPrepareContext } from "../types.js";

/** Where an integration reads its credentials at runtime. */
export type CredentialChoice = "environment" | "vercel-connect";

/** The copy that distinguishes one integration's credential question from another's. */
export interface PortableCredentialsQuestion {
  /** Question key answers are addressed by, for example `slack-credentials`. */
  readonly key: string;
  /** Integration name as it reads inside the question, for example `Slack`. */
  readonly label: string;
  /** What Vercel Connect manages for this integration. */
  readonly connectHint: string;
  /** What the operator configures themselves on the portable branch. */
  readonly portableHint: string;
  /**
   * Option id of the Vercel Connect branch. Headless and agent-driven runs
   * address an answer by its option id, so an integration that already shipped
   * one keeps it rather than breaking every scripted run.
   */
  readonly connectOptionId?: string;
}

/** Effects used to write an integration's portable credentials. */
export interface PortableEnvDeps {
  appendEnv: typeof appendEnv;
}

const defaultDeps: PortableEnvDeps = { appendEnv };

/** An integration's portable credential keys and the project that receives them. */
export interface PortableEnvInput {
  /** Project root owning `.env.local` and `.env.example`. */
  readonly environmentRoot: string;
  /**
   * Credential keys to merge, preserving any value the project already holds.
   * A real secret lands in the ignored `.env.local`; an empty value is a
   * placeholder for the operator to fill in and lands in the committable
   * `.env.example`.
   */
  readonly values: Record<string, string>;
}

/**
 * Asks where an integration reads its credentials.
 *
 * Portable is the recommendation for every integration because environment
 * variables work on any host, while Vercel Connect requires a linked Vercel
 * project.
 */
export async function askPortableCredentials(
  context: SetupPrepareContext,
  question: PortableCredentialsQuestion,
): Promise<CredentialChoice> {
  return context.asker.ask(
    select({
      key: question.key,
      message: `How would you like to configure ${question.label}?`,
      options: [
        {
          id: "portable",
          value: "environment" as const,
          label: "Use portable credentials",
          hint: question.portableHint,
        },
        {
          id: question.connectOptionId ?? "vercel",
          value: "vercel-connect" as const,
          label: "Set up Vercel Connect",
          hint: question.connectHint,
        },
      ],
      recommended: "environment" as const,
      required: true,
    }),
  );
}

/**
 * Merges an integration's portable credentials into the project environment.
 *
 * Callers write the authored channel module first. A refused overwrite then
 * fails before the environment is touched, so no run leaves credentials behind
 * for a channel it never wrote.
 */
export async function writePortableEnv(
  input: PortableEnvInput,
  deps: PortableEnvDeps = defaultDeps,
): Promise<void> {
  const secrets: Record<string, string> = {};
  const placeholders: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.values)) {
    if (value === "") placeholders[key] = value;
    else secrets[key] = value;
  }
  if (Object.keys(secrets).length > 0) {
    await deps.appendEnv(join(input.environmentRoot, ".env.local"), secrets);
  }
  if (Object.keys(placeholders).length > 0) {
    await deps.appendEnv(join(input.environmentRoot, ".env.example"), placeholders);
  }
}
