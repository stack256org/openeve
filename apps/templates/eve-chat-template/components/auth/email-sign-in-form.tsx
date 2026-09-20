"use client";

import { Loader2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 80;

// Sign-in and sign-up report one message each, so a failed attempt never tells
// the caller whether the address has an account.
const SIGN_IN_ERROR = "Incorrect email or password.";
const SIGN_UP_ERROR =
  "Could not create that account. Check the details, or sign in if you already have one.";
const RATE_LIMIT_ERROR = "Too many attempts. Wait a few minutes and try again.";

export function EmailSignInForm({
  callbackPath,
  disabled,
  onBeforeSignIn,
}: {
  readonly callbackPath?: string;
  readonly disabled?: boolean;
  readonly onBeforeSignIn?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email || !password || disabled || pending) {
      return;
    }

    setError(null);
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

      onBeforeSignIn?.();
      window.location.assign(resolveCallbackPath(callbackPath));
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {signingUp ? (
        <Input
          aria-label="Name"
          autoComplete="name"
          disabled={disabled || pending}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          value={name}
        />
      ) : null}
      <Input
        aria-label="Email"
        autoComplete="email"
        autoFocus
        disabled={disabled || pending}
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
        disabled={disabled || pending}
        maxLength={MAX_PASSWORD_LENGTH}
        minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        required
        type="password"
        value={password}
      />
      {signingUp ? (
        <p className="text-xs text-muted-foreground">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        aria-busy={pending}
        className="h-11 w-full"
        disabled={disabled || pending}
        type="submit"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {getSubmitLabel(pending, signingUp)}
      </Button>
      <button
        className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          setSigningUp(!signingUp);
        }}
        type="button"
      >
        {signingUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}

function getSubmitLabel(pending: boolean, signingUp: boolean) {
  if (pending) {
    return signingUp ? "Creating account..." : "Signing in...";
  }

  return signingUp ? "Create account" : "Sign in";
}

function getErrorMessage(status: number, signingUp: boolean) {
  if (status === 429) {
    return RATE_LIMIT_ERROR;
  }

  return signingUp ? SIGN_UP_ERROR : SIGN_IN_ERROR;
}

function resolveCallbackPath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  return path;
}
