import type { ConnectorDef, ConnectorStatus } from "#shared/types/connector";

/**
 * Each integration authenticates with a token from the environment, so an
 * integration is "connected" exactly when its variable holds a value. The token
 * is shared by every signed-in user: there is no per-user grant to mint, so the
 * agent acts as one service account against Linear and GitHub.
 */
export function resolveToken(def: ConnectorDef): string | undefined {
  return process.env[def.envVar]?.trim() || undefined;
}

export function probeStatus(def: ConnectorDef): ConnectorStatus {
  if (resolveToken(def)) {
    return { state: "connected" };
  }

  return {
    state: "setup_required",
    message: `${def.name} is not configured.`,
    hint: `Set ${def.envVar} in your environment, then restart the app.`,
  };
}

/** Returns the integration's token, or fails the request when it is unset. */
export function requireToken(def: ConnectorDef): string {
  const token = resolveToken(def);

  if (!token) {
    throw createError({
      statusCode: 409,
      statusMessage: "Not configured",
      message: `Set ${def.envVar} before running a test.`,
    });
  }

  return token;
}
