import { APP_USER_ISSUER } from "#shared/app-session";

export function buildAppSessionAuth(
  appUserId: string,
  attributes: Record<string, string | undefined>,
) {
  const cleaned = Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string] => !!entry[1]),
  );

  return {
    attributes: cleaned,
    authenticator: APP_USER_ISSUER,
    issuer: APP_USER_ISSUER,
    principalId: appUserId,
    principalType: "user",
  };
}
