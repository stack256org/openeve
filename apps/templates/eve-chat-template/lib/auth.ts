import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getAppUrlHost, getEffectiveAppUrl } from "@/lib/auth-url";
import { db } from "@/lib/db/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { getSocialProvider } from "@/lib/social-provider";

let instance: ReturnType<typeof createAuth> | null = null;

// Built lazily so the starter, which never touches Better Auth, can boot
// without BETTER_AUTH_SECRET while account mode still fails loudly without it.
export function getAuth() {
  if (!instance) {
    instance = createAuth();
  }

  return instance;
}

function createAuth() {
  const authBaseUrl = getEffectiveAppUrl();
  const allowedHosts = [
    "localhost:3000",
    "localhost:3001",
    "127.0.0.1:3000",
    "127.0.0.1:3001",
    "*.vercel.app",
    getAppUrlHost(process.env.BETTER_AUTH_URL),
    getAppUrlHost(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    getAppUrlHost(process.env.VERCEL_URL),
  ].filter((host): host is string => Boolean(host));
  const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  const social = getSocialProvider();

  if (social) {
    socialProviders[social.id] = {
      clientId: social.clientId,
      clientSecret: social.clientSecret,
    };
  }

  return betterAuth({
    baseURL: {
      allowedHosts,
      fallback: authBaseUrl,
      protocol: new URL(authBaseUrl).protocol === "https:" ? "https" : "http",
    },
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
      },
    },
    secret: requireAuthSecret(),
    advanced: {
      database: {
        generateId: () => randomUUID(),
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    onAPIError: {
      errorURL: "/auth/error",
    },
    socialProviders,
    plugins: [nextCookies()],
  });
}

function requireAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required for account sign-in. Generate one with: openssl rand -base64 32",
    );
  }

  return secret;
}
