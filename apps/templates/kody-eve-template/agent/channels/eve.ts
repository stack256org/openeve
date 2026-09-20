import { type AuthFn, httpBasic, localDev } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

const localDevAuth = localDev();

/**
 * Dev-only: present a trusted local session as an authenticated user.
 *
 * @remarks
 * The user-preference tools key their storage on a `principalType: "user"` session. In
 * production the channels supply one; the eve dev TUI authenticates with `localDev()`,
 * whose `local-dev` principal is not a user, so user-scoped tool calls fail with
 * `principal_required`. This shim defers the trust decision to `localDev()` — returning `null`
 * for anything it would reject, so it never affects production — and only upgrades the resolved
 * principal to a user. Drop it if you don't exercise user-scoped tools from the dev TUI.
 */
const localDevUser: AuthFn<Request> = async (request) => {
  const local = await localDevAuth(request);
  return local ? { ...local, principalType: "user" } : null;
};

/**
 * Route auth for the HTTP API, newest first.
 *
 * @remarks
 * HTTP Basic is the smallest credential that works on any host. It is only registered when
 * `EVE_API_PASSWORD` is set, so an unset variable leaves the route closed rather than accepting an
 * empty password. Swap it for `jwtHmac()`, `jwtEcdsa()`, or `oidc()` from `eve/channels/auth` when
 * you already run an identity provider.
 */
const auth: AuthFn<Request>[] = [localDevUser];
const apiPassword = process.env.EVE_API_PASSWORD;
if (apiPassword) {
  auth.push(httpBasic({ password: apiPassword, username: process.env.EVE_API_USERNAME ?? "eve" }));
}

export default eveChannel({ auth });
