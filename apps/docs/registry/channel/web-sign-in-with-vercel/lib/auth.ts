import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getAppUrlHost, getEffectiveAppUrl } from "@/lib/auth-url";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { getSocialProvider } from "@/lib/social-provider";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const DEVELOPMENT_ALLOWED_HOSTS = ["localhost:*", "127.0.0.1:*"];

function getAllowedHosts(): string[] {
  if (process.env.NODE_ENV === "development") {
    return DEVELOPMENT_ALLOWED_HOSTS;
  }
  const deploymentHosts = [
    getAppUrlHost(process.env.BETTER_AUTH_URL),
    getAppUrlHost(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    getAppUrlHost(process.env.VERCEL_BRANCH_URL),
    getAppUrlHost(process.env.VERCEL_URL),
  ].filter((host): host is string => Boolean(host));
  if (deploymentHosts.length === 0) {
    throw new Error(
      "Set BETTER_AUTH_URL to this app's public URL (for example https://agent.example.com) so sign-in can trust its own host.",
    );
  }
  return Array.from(new Set(deploymentHosts));
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "development") return `development-${name}`;
  throw new Error(`Missing required environment variable: ${name}`);
}

function getSocialProviders(): NonNullable<BetterAuthOptions["socialProviders"]> {
  const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  const social = getSocialProvider();
  if (social) {
    socialProviders[social.id] = { clientId: social.clientId, clientSecret: social.clientSecret };
  }
  return socialProviders;
}

// No `database` is configured, so Better Auth stores accounts in memory: they
// are gone on restart and are not shared between instances. Add a `database`
// adapter before you expect sign-ups to survive a deploy.
export const auth = betterAuth({
  baseURL: {
    allowedHosts: getAllowedHosts(),
    fallback: getEffectiveAppUrl(),
    // Derived, not pinned to https: a self-hosted deployment behind a plain
    // http origin would otherwise mint callback URLs it cannot serve.
    protocol: new URL(getEffectiveAppUrl()).protocol === "https:" ? "https" : "http",
  },
  secret: requireEnvironmentVariable("BETTER_AUTH_SECRET"),
  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    disableSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      refreshCache: false,
      strategy: "jwe",
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  socialProviders: getSocialProviders(),
});
