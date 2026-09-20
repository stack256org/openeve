"use client";

import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import type { SocialProvider } from "@/lib/social-provider";

const AGENT_NAME = "__EVE_INIT_APP_NAME__";

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 128;

// Sign-in and sign-up report one message each, so a failed attempt never tells
// the caller whether the address has an account.
const SIGN_IN_ERROR = "Incorrect email or password.";
const SIGN_UP_ERROR =
  "Could not create that account. Check the details, or sign in if you already have one.";
const RATE_LIMIT_ERROR = "Too many attempts. Wait a few minutes and try again.";

export function SignIn({ socialProvider }: { readonly socialProvider: SocialProvider | null }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-8 text-foreground">
      <div className="flex w-full max-w-[22rem] flex-col gap-5">
        <div className="text-foreground opacity-[0.08] dark:opacity-[0.12]">
          <EveWordmark className="h-auto w-[4.875rem]" />
        </div>
        <section aria-label="Sign in" className="flex flex-col gap-2">
          <h1 className="max-w-full break-words font-medium text-sm leading-6">{AGENT_NAME}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm leading-6">
            <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              Ready
            </span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span>Sign in to start a session</span>
          </p>
          <div className="mt-3 flex flex-col gap-4">
            <EmailSignInForm />
            {socialProvider ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-muted-foreground text-xs">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <SocialSignInButton provider={socialProvider} />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password || pending) return;

    setError(undefined);
    setPending(true);

    try {
      const result = signingUp
        ? await authClient.signUp.email({
            email,
            name: name.trim() || email.split("@")[0] || "eve user",
            password,
          })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(getErrorMessage(result.error.status, signingUp));
        setPending(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {signingUp ? (
        <Input
          aria-label="Name"
          autoComplete="name"
          disabled={pending}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          value={name}
        />
      ) : null}
      <Input
        aria-label="Email"
        autoComplete="email"
        disabled={pending}
        maxLength={MAX_EMAIL_LENGTH}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        required
        type="email"
        value={email}
      />
      <Input
        aria-label="Password"
        autoComplete={signingUp ? "new-password" : "current-password"}
        disabled={pending}
        maxLength={MAX_PASSWORD_LENGTH}
        minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        required
        type="password"
        value={password}
      />
      {signingUp ? (
        <p className="text-muted-foreground text-xs">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button aria-busy={pending} className="w-full gap-2" disabled={pending} type="submit">
        {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
        <span className="leading-5">{getSubmitLabel(pending, signingUp)}</span>
      </Button>
      <button
        className="w-full text-center text-muted-foreground text-xs transition-colors hover:text-foreground"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          setSigningUp(!signingUp);
        }}
        type="button"
      >
        {signingUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}

function SocialSignInButton({ provider }: { readonly provider: SocialProvider }) {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        callbackURL: "/",
        provider: provider.id,
      });
      if (result.error) setPending(false);
    } catch {
      setPending(false);
    }
  }

  return (
    <Button
      aria-busy={pending}
      className="w-full gap-2 text-sm"
      disabled={pending}
      onClick={signIn}
      type="button"
      variant="outline"
    >
      {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
      <span className="leading-5">
        {pending ? "Redirecting…" : `Continue with ${provider.label}`}
      </span>
    </Button>
  );
}

function getSubmitLabel(pending: boolean, signingUp: boolean): string {
  if (pending) {
    return signingUp ? "Creating account…" : "Signing in…";
  }
  return signingUp ? "Create account" : "Sign in";
}

function getErrorMessage(status: number, signingUp: boolean): string {
  if (status === 429) {
    return RATE_LIMIT_ERROR;
  }
  return signingUp ? SIGN_UP_ERROR : SIGN_IN_ERROR;
}

function EveWordmark({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 169 53"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M169 8.47h-51.39L81.73 53H70.36L113 0H169zM169 44.51v8.47h-45.87V44.5zM45.87 52.98H0V44.5h45.87zM38.66 30.55H0v-8.47h38.66z"
        fill="currentColor"
      />
      <path d="M169 30.55h-38.66v-8.47H169zM75.52 8.47H0V0h75.52z" fill="currentColor" />
    </svg>
  );
}

export function AccountControl({
  email,
  image,
  name,
}: {
  readonly email: string;
  readonly image?: string | null;
  readonly name: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const initials = getInitials(name, email);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut({
        fetchOptions: {
          onError: () => setPending(false),
          onSuccess: () => window.location.assign("/"),
        },
      });
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="fixed top-3 left-4 z-30 flex h-8 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open account menu for ${name}`}
            className="relative size-7 cursor-pointer overflow-hidden rounded-full p-0"
            size="icon-sm"
            variant="ghost"
          >
            {image && !imageFailed ? (
              <img
                alt=""
                className="size-full object-cover"
                onError={() => setImageFailed(true)}
                src={image}
              />
            ) : (
              <span aria-hidden="true" className="font-medium text-xs">
                {initials}
              </span>
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border border-black/20 dark:border-white/25"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="min-w-0 px-2 py-1.5 text-sm">
            <span className="block truncate font-medium leading-5" title={name}>
              {name}
            </span>
            <span className="block truncate text-muted-foreground leading-5" title={email}>
              {email}
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer justify-between"
            disabled={pending}
            onSelect={signOut}
          >
            {pending ? "Logging out…" : "Log out"}
            <LogOutIcon aria-hidden="true" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? email[0] ?? "?").toUpperCase();
}
