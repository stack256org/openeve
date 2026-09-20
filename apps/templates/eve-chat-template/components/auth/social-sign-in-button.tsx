"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { SocialProvider } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function SocialSignInButton({
  callbackPath,
  className,
  disabled,
  onBeforeSignIn,
  provider,
  variant = "default",
}: {
  readonly callbackPath?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onBeforeSignIn?: () => void;
  readonly provider: SocialProvider;
  readonly variant?: ComponentProps<typeof Button>["variant"];
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      aria-busy={pending}
      className={cn("gap-2", className)}
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true);

        try {
          onBeforeSignIn?.();

          const result = await authClient.signIn.social({
            provider: provider.id,
            callbackURL: resolveCallbackPath(callbackPath),
          });

          if (result?.error) {
            setPending(false);
          }
        } catch {
          setPending(false);
        }
      }}
      type="button"
      variant={variant}
    >
      {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
      {pending ? "Opening..." : `Continue with ${provider.label}`}
    </Button>
  );
}

function resolveCallbackPath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  return path;
}
