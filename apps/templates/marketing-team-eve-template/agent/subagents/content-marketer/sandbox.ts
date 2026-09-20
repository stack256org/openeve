import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * Subagent sandbox configuration.
 *
 * @remarks
 * Subagents inherit nothing from the root agent: an absent `sandbox.ts` falls back to the
 * framework default rather than the root's choice. This pins the same hosted Vercel Sandbox
 * backend the root uses, which is what makes each skill's `references/` files readable — static
 * `SKILL.md` instructions load without a sandbox, but supporting files are materialized into one.
 *
 * @see {@link https://vercel.com/docs/sandbox | Vercel Sandbox}
 */
export default defineSandbox({
  backend: vercel(),
});
