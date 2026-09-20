import { defineSandbox } from "eve/sandbox";
import { docker } from "eve/sandbox/docker";

/**
 * Subagent sandbox configuration.
 *
 * @remarks
 * Subagents inherit nothing from the root agent: an absent `sandbox.ts` falls back to the
 * framework default rather than the root's choice. This pins the same Docker backend the root
 * uses, which is what makes each skill's `references/` files readable — static
 * `SKILL.md` instructions load without a sandbox, but supporting files are materialized into one.
 */
export default defineSandbox({
  backend: docker(),
});
