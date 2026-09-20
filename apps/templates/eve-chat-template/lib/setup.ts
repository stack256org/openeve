import type { SetupStatus, SocialProvider } from "@/lib/chat/types";
import { isDatabaseConfigured, isDatabaseSchemaReady } from "@/lib/db/client";
import { getSocialProvider } from "@/lib/social-provider";

const PASSWORD_ENV_KEY = "EVE_CHAT_PASSWORD";
const AUTH_SECRET_ENV_KEY = "BETTER_AUTH_SECRET";

const CONNECTION_ENV_KEYS = ["LINEAR_API_KEY", "NOTION_API_KEY", "SENTRY_AUTH_TOKEN"] as const;

const RATE_LIMIT_ENV_KEY = "REDIS_URL";

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function isAuthConfigured() {
  return hasEnv(AUTH_SECRET_ENV_KEY);
}

export function isPasswordConfigured() {
  return Boolean(process.env.EVE_CHAT_PASSWORD?.trim());
}

export function isRateLimitConfigured() {
  return hasEnv(RATE_LIMIT_ENV_KEY);
}

export function getInitialSetupStatus(): SetupStatus {
  return createSetupStatus({
    databaseSchemaReady: isDatabaseConfigured(),
  });
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const databaseConfigured = isDatabaseConfigured();
  const fullEnvironmentReady = databaseConfigured && isAuthConfigured() && isRateLimitConfigured();
  const databaseSchemaReady = fullEnvironmentReady ? await isDatabaseSchemaReady() : false;

  return createSetupStatus({ databaseSchemaReady });
}

export async function isAppConfigured() {
  const status = await getSetupStatus();

  return status.appReady;
}

function createSetupStatus({
  databaseSchemaReady,
}: {
  readonly databaseSchemaReady: boolean;
}): SetupStatus {
  const databaseConfigured = isDatabaseConfigured();
  const accountAuthReady = isAuthConfigured();
  const rateLimitReady = isRateLimitConfigured();
  const databaseReady = databaseConfigured && databaseSchemaReady;
  const fullEnvironmentReady = databaseConfigured && accountAuthReady && rateLimitReady;
  const passwordReady = isPasswordConfigured();
  const localDevReady = isLocalDevelopment();
  const connectionsAvailable = localDevReady || CONNECTION_ENV_KEYS.some(hasEnv);

  if (fullEnvironmentReady) {
    return {
      appReady: databaseReady,
      authMode: "account",
      authReady: accountAuthReady,
      connectionsAvailable,
      databaseConfigured,
      databaseReady,
      databaseSchemaReady,
      missing: databaseSchemaReady ? [] : ["database migrations"],
      rateLimitReady,
      socialProvider: getSocialProviderStatus(),
      storageMode: "database",
    };
  }

  if (passwordReady || localDevReady) {
    return {
      appReady: true,
      authMode: passwordReady ? "password" : "local-dev",
      authReady: true,
      connectionsAvailable,
      databaseConfigured,
      databaseReady,
      databaseSchemaReady,
      missing: [],
      rateLimitReady,
      socialProvider: null,
      storageMode: "browser",
    };
  }

  return {
    appReady: false,
    authMode: "unconfigured",
    authReady: false,
    connectionsAvailable,
    databaseConfigured,
    databaseReady,
    databaseSchemaReady,
    missing: [
      PASSWORD_ENV_KEY,
      `or DATABASE_URL, ${AUTH_SECRET_ENV_KEY}, and ${RATE_LIMIT_ENV_KEY}`,
    ],
    rateLimitReady,
    socialProvider: null,
    storageMode: "browser",
  };
}

// Only the public half of the provider config crosses to the browser; the
// client id and secret stay on the server.
function getSocialProviderStatus(): SocialProvider | null {
  const provider = getSocialProvider();

  if (!provider) {
    return null;
  }

  return { id: provider.id, label: provider.label };
}

function isLocalDevelopment() {
  return process.env.NODE_ENV === "development" && process.env.VERCEL !== "1";
}
