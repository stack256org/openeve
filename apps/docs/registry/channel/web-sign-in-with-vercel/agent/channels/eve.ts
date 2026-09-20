import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev, type AuthFn, vercelOidc } from "eve/channels/auth";
import { auth } from "@/lib/auth";

const betterAuthSession: AuthFn<Request> = async (request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  const attributes: Record<string, string> = {
    email: session.user.email,
    name: session.user.name,
  };
  if (session.user.image) {
    attributes.picture = session.user.image;
  }

  return {
    attributes,
    authenticator: "better-auth:vercel",
    principalId: session.user.id,
    principalType: "user",
  };
};

const authPolicy: AuthFn<Request>[] = [betterAuthSession];

// The browser session above only covers browser callers. Set EVE_API_PASSWORD
// to let the eve TUI, CI, and other programmatic callers in on any host.
// Registered only when the password is set: an empty password would accept
// `Basic base64("eve:")` from anyone.
const apiPassword = process.env.EVE_API_PASSWORD;
if (apiPassword) {
  authPolicy.push(
    httpBasic({ password: apiPassword, username: process.env.EVE_API_USERNAME ?? "eve" }),
  );
}

authPolicy.push(vercelOidc(), localDev());

export default eveChannel({ auth: authPolicy });
