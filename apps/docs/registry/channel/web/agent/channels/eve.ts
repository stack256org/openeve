import { eveChannel } from "eve/channels/eve";
import { type AuthFn, httpBasic, localDev, placeholderAuth } from "eve/channels/auth";

const auth: AuthFn<Request>[] = [];

// Lets the eve TUI, CI, and other programmatic callers reach the deployed
// agent on any host. Registered only when EVE_API_PASSWORD is set: an empty
// password would accept `Basic base64("eve:")` from anyone.
const apiPassword = process.env.EVE_API_PASSWORD;
if (apiPassword) {
  auth.push(httpBasic({ password: apiPassword, username: process.env.EVE_API_USERNAME ?? "eve" }));
}

// Open on localhost for `eve dev` and the REPL; ignored in production.
auth.push(localDev());

// This placeholder will not allow browser requests in production.
// Replace it with your app's auth provider, like Auth.js or Clerk,
// or use none() for a public demo.
auth.push(placeholderAuth());

export default eveChannel({ auth });
