import { defineSandbox } from "eve/sandbox";
import { docker } from "eve/sandbox/docker";

/**
 * Agent sandbox configuration.
 *
 * @remarks
 * Pins the Docker backend for both local development and production, so the same environment
 * runs everywhere. It needs a Docker daemon reachable from wherever the agent runs; swap in
 * `microsandbox()` or `justbash()` from `eve/sandbox/*` when that does not suit your host.
 */
export default defineSandbox({
  backend: docker(),
});
