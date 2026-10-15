"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/app/auth/actions";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {!state.message && (
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.values?.email}
          required
        />
      )}
      <FormAlert error={state.error} message={state.message} />
      {!state.message && <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>}
      <p className="pt-1 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
