"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type FormState } from "@/app/auth/actions";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="space-y-4">
        <FormAlert message={state.message} />
        <Link
          href="/login"
          className="flex h-14 items-center justify-center rounded-control bg-brand text-lg font-bold text-white hover:bg-brand-dark"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Full name"
        name="full_name"
        autoComplete="name"
        defaultValue={state.values?.full_name}
        required
      />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="024 123 4567"
        defaultValue={state.values?.phone}
        required
      />
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
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
      />
      <FormAlert error={state.error} />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      <p className="pt-1 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
