import { defineSandbox, type SandboxSessionContext } from "eve/sandbox";
import { microsandbox } from "eve/sandbox/microsandbox";
import { FACTORY_SANDBOX_CREATE_OPTIONS } from "./lib/github/repo-sandbox.js";

/**
 * Root agent sandbox configuration.
 *
 * @remarks
 * Pins the microsandbox backend for both local development and production, so the same
 * environment runs everywhere and every sandbox stays on the host running the factory.
 * microsandbox is the only local backend that implements domain-level network policies and
 * credential brokering, which is what keeps `GITHUB_TOKEN` out of the sandbox; the Docker
 * backend accepts only `allow-all` and `deny-all` and would throw here. The price is a
 * narrower host requirement — macOS on Apple Silicon, or Linux (glibc) with KVM — documented
 * in the README.
 *
 * The `onSession` hook marks `/workspace` as a safe git directory before the GitHub channel's
 * built-in per-turn checkout runs there. Whenever the directory ends up owned by a different
 * uid than the session user, git aborts every command with "detected dubious ownership in
 * repository at '/workspace'", the channel swallows the failed checkout, and the turn runs
 * with no working tree; the guard costs one command and removes the whole failure mode. The
 * station sandboxes handle the same hazard for `/workspace/repo` in
 * `agent/lib/github/repo-sandbox.ts`.
 *
 * @see {@link https://eve.dev/docs/sandbox | eve sandbox backends}
 */
export default defineSandbox({
  backend: microsandbox(FACTORY_SANDBOX_CREATE_OPTIONS),
  async onSession({ use }: SandboxSessionContext): Promise<void> {
    const sandbox = await use();
    const result = await sandbox.run({
      command: "git config --global --add safe.directory /workspace",
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to mark /workspace as a safe git directory (exit ${result.exitCode}): ${String(
          result.stderr || result.stdout,
        ).trim()}`,
      );
    }
  },
});
