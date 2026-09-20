import { defineSandbox } from "eve/sandbox";
import { docker } from "eve/sandbox/docker";

/**
 * Sandbox holding the bundled design corpus at `/workspace/knowledge`.
 *
 * @remarks
 * Pins the local Docker backend for both development and production, so the
 * same environment runs everywhere. It needs a Docker daemon reachable from
 * wherever the agent runs; swap in `microsandbox()` or `justbash()` from
 * `eve/sandbox/*` when that does not suit your host.
 *
 * `deny-all` runs the container with networking disabled, so the read, grep,
 * and glob tools reach the seeded corpus and nothing else. Docker applies it
 * to every session container at start, which is why there is no `onSession`
 * hook re-asserting it.
 */
export default defineSandbox({
  backend: docker({ networkPolicy: "deny-all" }),
});
