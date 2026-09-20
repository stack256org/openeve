const SOCIAL_PROVIDER_LABELS = {
  discord: "Discord",
  github: "GitHub",
  gitlab: "GitLab",
  google: "Google",
  microsoft: "Microsoft",
  vercel: "Vercel",
} as const;

export type SocialProviderId = keyof typeof SOCIAL_PROVIDER_LABELS;

export type SocialProvider = {
  readonly id: SocialProviderId;
  readonly label: string;
};

export type SocialProviderCredentials = SocialProvider & {
  readonly clientId: string;
  readonly clientSecret: string;
};

const SUPPORTED_IDS = Object.keys(SOCIAL_PROVIDER_LABELS).join(", ");

const socialProvider = resolveSocialProvider();

export function getSocialProvider(): SocialProviderCredentials | null {
  return socialProvider;
}

// Only the public half of the provider config crosses to the browser; the
// client id and secret stay on the server.
export function getPublicSocialProvider(): SocialProvider | null {
  if (!socialProvider) return null;

  return { id: socialProvider.id, label: socialProvider.label };
}

// All or nothing: a half-configured provider stays off rather than producing a
// sign-in button that dead-ends on the OAuth callback.
function resolveSocialProvider(): SocialProviderCredentials | null {
  const id = process.env.AUTH_SOCIAL_PROVIDER?.trim().toLowerCase() ?? "";

  if (!id) {
    return null;
  }

  if (!isSocialProviderId(id)) {
    console.warn(
      `AUTH_SOCIAL_PROVIDER is set to an unsupported provider. Supported providers: ${SUPPORTED_IDS}. Social sign-in stays off.`,
    );

    return null;
  }

  const clientId = process.env.AUTH_SOCIAL_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.AUTH_SOCIAL_CLIENT_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret) {
    console.warn(
      "AUTH_SOCIAL_PROVIDER is set without AUTH_SOCIAL_CLIENT_ID and AUTH_SOCIAL_CLIENT_SECRET. Social sign-in stays off.",
    );

    return null;
  }

  return { clientId, clientSecret, id, label: SOCIAL_PROVIDER_LABELS[id] };
}

function isSocialProviderId(value: string): value is SocialProviderId {
  return value in SOCIAL_PROVIDER_LABELS;
}
