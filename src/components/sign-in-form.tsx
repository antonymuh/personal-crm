"use client";

import { useActionState } from "react";

import { requestSignInLink, type SignInState } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<
    SignInState | null,
    FormData
  >(requestSignInLink, null);

  return (
    <div className="grid gap-4">
      {state?.status === "sent" && (
        <p
          role="status"
          className="rounded-sketch-alt border-2 border-ink bg-card px-4 py-3 font-medium shadow-pop-green"
        >
          Ссылка для входа отправлена на {state.email}
        </p>
      )}
      {state?.status === "limited" && (
        <p
          role="alert"
          className="rounded-sketch-alt border-2 border-ink bg-card px-4 py-3 font-medium shadow-pop-pink"
        >
          {state.error}
        </p>
      )}

      {/* The server checks the address, so the browser's own check is off. */}
      <form action={formAction} noValidate className="grid gap-2">
        <Label htmlFor="email">Почта</Label>
        <Input
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          // The form resets after each submit; keep what was typed.
          key={state ? `${state.status}:${state.email}` : "empty"}
          defaultValue={state?.email ?? ""}
          aria-invalid={state?.status === "invalid"}
          aria-describedby={
            state?.status === "invalid" ? "email-error" : undefined
          }
        />
        {state?.status === "invalid" && (
          <p id="email-error" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}
        <div className="mt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Отправляю…" : "Получить ссылку"}
          </Button>
        </div>
      </form>
    </div>
  );
}
