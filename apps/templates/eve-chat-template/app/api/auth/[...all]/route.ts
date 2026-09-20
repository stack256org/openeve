import { NextResponse } from "next/server";
import { parseSetCookieHeader, stripSecureCookiePrefix } from "better-auth/cookies";
import { getAuth } from "@/lib/auth";
import {
  AUTH_HINT_COOKIE_MAX_AGE,
  AUTH_HINT_COOKIE_NAME,
  AUTH_HINT_COOKIE_VALUE,
  isSecureAuthHintCookie,
} from "@/lib/auth-hint";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getSetupStatus } from "@/lib/setup";

const BETTER_AUTH_SESSION_COOKIE_NAME = "better-auth.session_token";

// Password endpoints are the credential-stuffing surface, so they are bounded
// per client before any database work happens.
const CREDENTIAL_PATHS = ["/sign-in/email", "/sign-up/email"];
const CREDENTIAL_ATTEMPT_LIMIT = 10;
const CREDENTIAL_WINDOW_SECONDS = 10 * 60;

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}

async function handleAuth(request: Request) {
  const rateLimited = await enforceCredentialRateLimit(request);

  if (rateLimited) {
    return rateLimited;
  }

  const setupStatus = await getSetupStatus();

  if (!setupStatus.databaseConfigured) {
    return redirectToAuthError(request, "database_not_configured");
  }

  if (!setupStatus.databaseSchemaReady) {
    return redirectToAuthError(request, "database_migrations_missing");
  }

  if (!setupStatus.authReady) {
    return redirectToAuthError(request, "auth_env_missing");
  }

  const response = await getAuth().handler(request);

  return withAuthHintCookie(response);
}

async function enforceCredentialRateLimit(request: Request) {
  if (request.method !== "POST" || !isCredentialRequest(request)) {
    return null;
  }

  try {
    await enforceRateLimit({
      key: getClientKey(request),
      limit: CREDENTIAL_ATTEMPT_LIMIT,
      prefix: "auth:credentials",
      windowSeconds: CREDENTIAL_WINDOW_SECONDS,
    });

    return null;
  } catch (error) {
    if (!(error instanceof RateLimitError)) {
      throw error;
    }

    return NextResponse.json(
      { message: "Too many sign-in attempts. Wait a few minutes and try again." },
      { headers: { "retry-after": String(error.retryAfter) }, status: 429 },
    );
  }
}

function isCredentialRequest(request: Request) {
  const { pathname } = new URL(request.url);

  return CREDENTIAL_PATHS.some((path) => pathname.endsWith(path));
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function redirectToAuthError(request: Request, error: string) {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("error", error);

  return NextResponse.redirect(url);
}

function withAuthHintCookie(response: Response) {
  const authState = getAuthStateFromSetCookie(response.headers.get("set-cookie"));

  if (!authState) {
    return response;
  }

  const nextResponse = new NextResponse(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });

  if (authState === "logged-in") {
    nextResponse.cookies.set(AUTH_HINT_COOKIE_NAME, AUTH_HINT_COOKIE_VALUE, {
      httpOnly: false,
      maxAge: AUTH_HINT_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: isSecureAuthHintCookie(),
    });
  } else {
    nextResponse.cookies.set(AUTH_HINT_COOKIE_NAME, "", {
      expires: new Date(0),
      httpOnly: false,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: isSecureAuthHintCookie(),
    });
  }

  return nextResponse;
}

function getAuthStateFromSetCookie(setCookie: string | null) {
  if (!setCookie) {
    return null;
  }

  const sessionCookie = [...parseSetCookieHeader(setCookie)].find(([name]) => {
    return stripSecureCookiePrefix(name) === BETTER_AUTH_SESSION_COOKIE_NAME;
  });

  if (!sessionCookie) {
    return null;
  }

  const [, attributes] = sessionCookie;

  return attributes.value && attributes["max-age"] !== 0 ? "logged-in" : "logged-out";
}
