"use client";

import { LockKeyholeIcon, MailIcon } from "lucide-react";
import { EmailSignInForm } from "@/components/auth/email-sign-in-form";
import { PasswordSignInForm } from "@/components/auth/password-sign-in-form";
import { SocialSignInButton } from "@/components/auth/social-sign-in-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuthMode, SocialProvider } from "@/lib/chat/types";

export function SignInModal({
  authMode,
  callbackPath,
  disabled,
  onBeforeSignIn,
  onOpenChange,
  open,
  socialProvider,
}: {
  readonly authMode: AuthMode;
  readonly callbackPath?: string;
  readonly disabled?: boolean;
  readonly onBeforeSignIn?: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly socialProvider: SocialProvider | null;
}) {
  const usesPassword = authMode === "password";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full border border-border bg-muted">
            {usesPassword ? (
              <LockKeyholeIcon className="size-4 text-foreground" />
            ) : (
              <MailIcon className="size-4 text-foreground" />
            )}
          </div>
          <DialogTitle>
            {usesPassword ? "Enter chat password" : "Sign up or in to get started"}
          </DialogTitle>
          <DialogDescription>
            {usesPassword
              ? "Use the password configured by the person who deployed this agent."
              : "Use an email address and password to send messages and save sessions."}
          </DialogDescription>
        </DialogHeader>
        {usesPassword ? (
          <PasswordSignInForm callbackPath={callbackPath} onBeforeSignIn={onBeforeSignIn} />
        ) : (
          <div className="space-y-4">
            <EmailSignInForm
              callbackPath={callbackPath}
              disabled={disabled}
              onBeforeSignIn={onBeforeSignIn}
            />
            {socialProvider ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <SocialSignInButton
                  callbackPath={callbackPath}
                  className="h-11 w-full"
                  disabled={disabled}
                  onBeforeSignIn={onBeforeSignIn}
                  provider={socialProvider}
                  variant="outline"
                />
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
