const LOCAL_APP_URL = "http://localhost:3000";

// BETTER_AUTH_URL is the explicit answer and wins. The VERCEL_* variables are
// an extra source so a Vercel deploy still works with nothing configured, not
// the only source: off Vercel none of them are set.
export function getEffectiveAppUrl(): string {
  return (
    normalizeAppUrl(process.env.BETTER_AUTH_URL) ??
    normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeAppUrl(process.env.VERCEL_BRANCH_URL) ??
    normalizeAppUrl(process.env.VERCEL_URL) ??
    LOCAL_APP_URL
  );
}

export function getAppUrlHost(value: string | undefined): string | undefined {
  const url = normalizeAppUrl(value);
  if (!url) return undefined;

  return new URL(url).host;
}

// The VERCEL_* variables are bare hosts, BETTER_AUTH_URL is a full URL, and a
// hand-typed value may carry a path or a trailing slash. Normalize all of them
// to a bare origin before anything derives a host or a protocol from them.
function normalizeAppUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.pathname = "";
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}
