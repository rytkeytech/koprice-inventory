"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, type FormState } from "@/app/auth/actions";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  const linkError =
    useSearchParams().get("error") === "link"
      ? "That link has expired or was already used. Log in, or ask for a new link."
      : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormAlert error={state.error ?? linkError} />
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
      <div className="flex justify-between gap-4 pt-1 text-sm font-semibold">
        <Link href="/forgot-password" className="text-brand underline-offset-4 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-brand underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}
