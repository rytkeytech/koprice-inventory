"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/auth/actions";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

export function ResetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
      />
      <Field
        label="Type it again"
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        required
      />
      <FormAlert error={state.error} />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
