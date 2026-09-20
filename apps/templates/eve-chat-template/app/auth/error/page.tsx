import { AlertCircleIcon, ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

const SETUP_DOCS_URL =
  "https://github.com/vercel/eve/blob/main/apps/templates/eve-chat-template/docs/setup-and-deploy.md";

export default async function AuthErrorPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Suspense fallback={<AuthErrorCard message={getAuthErrorMessage()} />}>
        <AuthErrorContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AuthErrorContent({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = getParam(params.error);
  const errorDescription = getParam(params.error_description);
  const message = getAuthErrorMessage(error, errorDescription);

  return <AuthErrorCard error={error} message={message} />;
}

function AuthErrorCard({
  error,
  message,
}: {
  readonly error?: string;
  readonly message: ReturnType<typeof getAuthErrorMessage>;
}) {
  return (
    <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-destructive">
          <AlertCircleIcon className="size-4" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Authentication setup</p>
          <h1 className="text-2xl font-semibold tracking-normal">{message.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{message.body}</p>
          {error ? (
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild className="h-8 rounded-md px-3 text-sm">
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
            Back to chat
          </Link>
        </Button>
        <Button asChild className="h-8 rounded-md px-3 text-sm" variant="outline">
          <a href={SETUP_DOCS_URL} rel="noreferrer" target="_blank">
            Setup guide
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAuthErrorMessage(error?: string, description?: string) {
  if (error === "database_not_configured") {
    return {
      title: "Database is not configured",
      body: "Set DATABASE_URL to a Postgres connection string, then run database migrations and try signing in again.",
    };
  }

  if (error === "database_migrations_missing") {
    return {
      title: "Database migrations are missing",
      body: "Run production migrations with DATABASE_URL pointed at your production database: pnpm db:migrate. This creates the Better Auth and chat tables.",
    };
  }

  if (error === "auth_env_missing") {
    return {
      title: "Better Auth secret is missing",
      body: "Set BETTER_AUTH_SECRET to a random value, for example the output of openssl rand -base64 32, then redeploy or restart the dev server.",
    };
  }

  if (error === "email_not_found") {
    return {
      title: "The provider returned no email address",
      body: "Enable the email scope on the OAuth app behind AUTH_SOCIAL_PROVIDER and try again. Better Auth needs an email address to create the account. Email and password sign-in works without any provider.",
    };
  }

  if (error === "invalid_scope") {
    return {
      title: "OAuth scopes need attention",
      body: "The OAuth app behind AUTH_SOCIAL_PROVIDER rejected a requested scope. Enable the scopes that provider needs to return a profile and an email address, then try again.",
    };
  }

  if (description?.toLowerCase().includes("callback")) {
    return {
      title: "Callback URL is not allowed",
      body: "Add the exact callback URL you are using to the OAuth app: /api/auth/callback/<provider>, including the protocol, domain, and local port.",
    };
  }

  if (
    description?.toLowerCase().includes("relation") ||
    description?.toLowerCase().includes("table") ||
    description?.toLowerCase().includes("database")
  ) {
    return {
      title: "Database migrations may be missing",
      body: "Run production migrations with DATABASE_URL pointed at your production database: pnpm db:migrate, then retry sign-in. This creates the Better Auth and chat tables.",
    };
  }

  return {
    title: "Sign-in could not finish",
    body: "Check BETTER_AUTH_SECRET, the database migrations, and, if you configured a social provider, its callback URL and scopes. The setup guide has the exact values to verify.",
  };
}
