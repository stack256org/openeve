import { type AuthFn, httpBasic, localDev } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

/**
 * Route auth for the HTTP API, newest first.
 *
 * @remarks
 * HTTP Basic is the smallest credential that works on any host. It is registered only when
 * `EVE_API_PASSWORD` is set, so an unset variable leaves the route closed rather than accepting
 * an empty password. Swap it for `jwtHmac()`, `jwtEcdsa()`, or `oidc()` from `eve/channels/auth`
 * when you already run an identity provider.
 */
const auth: AuthFn<Request>[] = [localDev()];
const apiPassword = process.env.EVE_API_PASSWORD;
if (apiPassword) {
  auth.push(httpBasic({ password: apiPassword, username: process.env.EVE_API_USERNAME ?? "eve" }));
}

export default eveChannel({ auth });
